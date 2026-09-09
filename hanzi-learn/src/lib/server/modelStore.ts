/**
 * 服务端模型目录获取与选择持久化（仅 Node 环境使用，勿在客户端 import）
 *
 * 职责：
 * 1. 用 DEEPSEEK_API_KEY 调 `GET https://api.deepseek.com/models` 自动获取账号可用模型
 * 2. 结果带 TTL 缓存（默认 10 分钟）+ 在途请求合并，避免家长页反复刷新打爆上游
 * 3. 上游不可用 / 无 Key 时降级为内置兜底目录（页面仍可操作，只是标注"离线目录"）
 * 4. 家长的模型选择持久化到 data/state.json 的 config.model
 */

import { readState, writeState } from "./stateStore";
import {
  AUTO_MODEL,
  FALLBACK_MODELS,
  describeModel,
  isValidModelId,
  normalizeModelList,
  resolveEffectiveModel,
  sortModels,
  type ModelInfo,
  type ModelSource,
} from "../modelCatalog";

/** 模型列表缓存有效期（毫秒）；可用 DEEPSEEK_MODEL_CACHE_MS 覆盖 */
const DEFAULT_CACHE_MS = 10 * 60 * 1000;

/** 拉取上游模型列表的超时（毫秒）；可用 DEEPSEEK_MODEL_TIMEOUT_MS 覆盖 */
const DEFAULT_FETCH_TIMEOUT_MS = 8000;

/** 模型列表来源 */
export type ModelListSource = "api" | "fallback";

/** 模型列表接口返回结构 */
export interface ModelListResult {
  /** 候选模型（已按推荐度排序） */
  models: ModelInfo[];
  /** 列表来源：api=实时获取，fallback=内置兜底 */
  listSource: ModelListSource;
  /** 当前生效模型 */
  current: string;
  /** 当前模型的来源 */
  currentSource: ModelSource;
  /** 家长手动选择的模型（空串 = 自动） */
  selected: string;
  /** 当前模型是否在候选列表中（手动选了已下线的模型时为 false） */
  currentAvailable: boolean;
  /** 是否可用（有 API Key） */
  hasApiKey: boolean;
  /** 降级/失败原因（成功时为 null） */
  error: string | null;
  /** 列表缓存时间（ISO，实时获取时才有） */
  fetchedAt: string | null;
}

/** 缓存的模型列表 */
interface CacheEntry {
  models: ModelInfo[];
  fetchedAt: string;
}

// 缓存挂在 globalThis 上：Next dev 的热重载会重建模块，模块级变量会丢
const globalCache = globalThis as typeof globalThis & {
  __hanziModelCache?: CacheEntry;
  __hanziModelInflight?: Promise<CacheEntry | null> | null;
};

/** 读取毫秒级环境变量（非法值回退默认） */
function envMs(name: string, fallback: number): number {
  const raw = process.env[name];
  const n = raw ? Number(raw) : NaN;
  return Number.isFinite(n) && n >= 0 ? n : fallback;
}

/** 取 DeepSeek API Key（占位值视为未配置） */
export function getApiKey(): string | null {
  const key = process.env.DEEPSEEK_API_KEY;
  if (!key || key === "your_deepseek_api_key_here") return null;
  return key;
}

/** 清空缓存（测试用） */
export function clearModelCache(): void {
  globalCache.__hanziModelCache = undefined;
  globalCache.__hanziModelInflight = null;
}

/** 缓存是否仍在有效期内 */
function readFreshCache(now: number, ttl: number): CacheEntry | null {
  const cached = globalCache.__hanziModelCache;
  if (!cached) return null;
  const age = now - new Date(cached.fetchedAt).getTime();
  if (!Number.isFinite(age) || age > ttl) return null;
  return cached;
}

/**
 * 拉取（或复用缓存的）账号可用模型列表。
 * 失败时返回 null，由调用方决定降级方式。
 */
export async function fetchAvailableModels(apiKey: string): Promise<CacheEntry | null> {
  const ttl = envMs("DEEPSEEK_MODEL_CACHE_MS", DEFAULT_CACHE_MS);
  const now = Date.now();
  const fresh = readFreshCache(now, ttl);
  if (fresh) return fresh;

  // 在途请求合并：并发调用共享同一次上游请求
  const inflight = globalCache.__hanziModelInflight;
  if (inflight) return inflight;

  const task = (async (): Promise<CacheEntry | null> => {
    const controller = new AbortController();
    const timer = setTimeout(
      () => controller.abort(),
      envMs("DEEPSEEK_MODEL_TIMEOUT_MS", DEFAULT_FETCH_TIMEOUT_MS),
    );
    try {
      const res = await fetch("https://api.deepseek.com/models", {
        method: "GET",
        headers: { Authorization: `Bearer ${apiKey}` },
        signal: controller.signal,
      });
      if (!res.ok) {
        console.warn(`[model] 获取模型列表失败: HTTP ${res.status}`);
        return null;
      }
      const models = normalizeModelList(await res.json());
      if (models.length === 0) {
        console.warn("[model] 获取模型列表为空");
        return null;
      }
      const entry: CacheEntry = { models, fetchedAt: new Date().toISOString() };
      globalCache.__hanziModelCache = entry;
      return entry;
    } catch (err) {
      console.warn(`[model] 获取模型列表异常: ${err instanceof Error ? err.message : String(err)}`);
      return null;
    } finally {
      clearTimeout(timer);
      globalCache.__hanziModelInflight = null;
    }
  })();

  globalCache.__hanziModelInflight = task;
  return task;
}

/** 组装模型列表 + 当前选择（供 GET /api/model 使用） */
export async function getModelList(): Promise<ModelListResult> {
  const state = readState();
  const selected = typeof state.config.model === "string" ? state.config.model.trim() : "";
  const { model: current, source: currentSource } = resolveEffectiveModel(
    selected,
    process.env.DEEPSEEK_MODEL,
  );

  const apiKey = getApiKey();
  let models: ModelInfo[] = [];
  let listSource: ModelListSource = "fallback";
  let error: string | null = null;
  let fetchedAt: string | null = null;

  if (apiKey) {
    const entry = await fetchAvailableModels(apiKey);
    if (entry) {
      models = entry.models;
      listSource = "api";
      fetchedAt = entry.fetchedAt;
    } else {
      error = "无法从 DeepSeek 获取模型列表，已显示内置目录";
    }
  } else {
    error = "未配置 DEEPSEEK_API_KEY，无法自动获取模型列表";
  }

  if (models.length === 0) models = sortModels(FALLBACK_MODELS);

  // 手动选中但已不在候选列表（模型下线）时，仍展示出来以便家长改选
  const known = new Set(models.map((m) => m.id));
  const currentAvailable = known.has(current);
  if (!currentAvailable) models = sortModels([...models, { ...describeUnknown(current) }]);

  return {
    models,
    listSource,
    current,
    currentSource,
    selected,
    currentAvailable,
    hasApiKey: !!apiKey,
    error,
    fetchedAt,
  };
}

/** 当前模型不在候选列表时的展示信息（仅用于 UI 展示，不参与请求校验） */
function describeUnknown(id: string): ModelInfo {
  const info = describeModel(id);
  return { ...info, description: "当前选中的模型不在账号可用列表中" };
}

/** 句子生成实际使用的模型（generate 路由调用；每次请求都读最新选择） */
export function getEffectiveModel(): { model: string; source: ModelSource } {
  const state = readState();
  const selected = typeof state.config.model === "string" ? state.config.model : "";
  return resolveEffectiveModel(selected, process.env.DEEPSEEK_MODEL);
}

/** 当前选中模型是否被账号支持（网络不可用时不拦截，交由上游判定） */
export async function isModelAvailable(model: string): Promise<boolean> {
  const apiKey = getApiKey();
  if (!apiKey) return true;
  const entry = await fetchAvailableModels(apiKey);
  if (!entry) return true;
  return entry.models.some((m) => m.id === model);
}

/** 保存家长的模型选择（空串 = 自动），返回保存后的结果 */
export async function saveSelectedModel(selected: string): Promise<ModelListResult> {
  const value = typeof selected === "string" ? selected.trim() : "";
  if (value && !isValidModelId(value)) {
    throw new Error("invalid_model");
  }
  const state = readState();
  writeState({ config: { ...state.config, model: value || AUTO_MODEL } });
  return getModelList();
}
