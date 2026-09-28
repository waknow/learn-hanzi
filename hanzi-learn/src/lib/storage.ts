/**
 * localStorage 封装（服务端 data/*.json 的离线镜像）
 *
 * 角色：唯一真相是服务端的三个分区文件
 *   data/config.json  配置类
 *   data/stats.json   统计类（含权重进度 progress）
 *   data/banks.json   词库类
 * 本模块持有它们的浏览器副本；启动/聚焦时由 stateSync 以服务端为准刷新（见 stateSync.ts）。
 *
 * 键位：
 *   hanzi_parent_config → config 分区（密码 / 模型）
 *   hanzi_study_stats   → stats 分区（统计 + progress）
 *   hanzi_banks         → banks 分区（字库定义 + 启停）
 *   hanzi_weight_data   → v1 遗留键，仅用于一次性迁移（见 ensureLocalMigration）
 *
 * 所有读写包裹 try/catch，应对 SSR 与隐私模式（不可写）；保存时后台防抖推送到 /api/state。
 */

import type { BanksSection, ConfigSection, StatsSection, WeightData } from "./types";
import { SCHEMA_VERSION } from "./schema";
import { createBanksSectionFromLegacy, createEmptyBanksSection, reconcileBanks } from "./banks";
import { DEFAULT_PASSWORD } from "./stateShape";

/* ========== 通用 ========== */

export const KEYS = {
  /** v1 遗留：权重进度；v2 起进度存在 STUDY_STATS.progress，此键仅用于迁移 */
  WEIGHT_DATA: "hanzi_weight_data",
  STUDY_STATS: "hanzi_study_stats",
  PARENT_CONFIG: "hanzi_parent_config",
  /** v2 新增：词库分区 */
  BANKS: "hanzi_banks",
} as const;

/** 本地镜像结构版本（v1 缓存 → v2 的一次性迁移标记） */
const LOCAL_CACHE_VERSION_KEY = "hanzi_cache_version";
const LOCAL_CACHE_VERSION = "2";

function safeGetItem<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  try {
    const raw = localStorage.getItem(key);
    if (raw === null) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

/** 读取原始 JSON（失败返回 null），迁移时用 */
function safeGetRaw<T>(key: string): T | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(key);
    return raw === null ? null : (JSON.parse(raw) as T);
  } catch {
    return null;
  }
}

function safeSetItem(key: string, value: unknown): boolean {
  if (typeof window === "undefined") return false;
  try {
    localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch {
    return false;
  }
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function numOr(value: unknown, fallback: number): number {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

const nowIso = () => new Date().toISOString();

/* ========== 本地镜像迁移（v1 → v2，一次性） ========== */

/**
 * 把 v1 的浏览器缓存整理成 v2 三个分区：
 * 1. config.customBanks / enabledBanks → hanzi_banks
 * 2. hanzi_weight_data → hanzi_study_stats.progress（随后删除旧键）
 * 3. config 瘦身为 { password, model }
 *
 * 幂等（用 hanzi_cache_version 标记），失败静默（隐私模式下不可写）。
 */
function ensureLocalMigration(): void {
  if (typeof window === "undefined") return;

  try {
    if (localStorage.getItem(LOCAL_CACHE_VERSION_KEY) === LOCAL_CACHE_VERSION) return;

    const legacyConfig = safeGetRaw<Record<string, unknown>>(KEYS.PARENT_CONFIG);

    // 1) 词库分区
    if (localStorage.getItem(KEYS.BANKS) === null) {
      const customBanks = Array.isArray(legacyConfig?.customBanks)
        ? (legacyConfig.customBanks as {
            id: string;
            name: string;
            emoji: string;
            chars: string[];
          }[])
        : [];
      const enabledBanks = Array.isArray(legacyConfig?.enabledBanks)
        ? (legacyConfig.enabledBanks as string[])
        : [];
      const hadLegacyBanks = customBanks.length > 0 || enabledBanks.length > 0;
      safeSetItem(
        KEYS.BANKS,
        hadLegacyBanks
          ? createBanksSectionFromLegacy(customBanks, enabledBanks)
          : createEmptyBanksSection(),
      );
    }

    // 2) 旧权重键 → stats.progress
    const legacyWeight = safeGetRaw<WeightData>(KEYS.WEIGHT_DATA);
    if (isPlainObject(legacyWeight)) {
      const stats = safeGetRaw<Record<string, unknown>>(KEYS.STUDY_STATS) ?? {};
      const existingProgress = isPlainObject(stats.progress) ? stats.progress : {};
      if (Object.keys(existingProgress).length === 0 && Object.keys(legacyWeight).length > 0) {
        safeSetItem(KEYS.STUDY_STATS, { ...stats, progress: legacyWeight });
      }
      try {
        localStorage.removeItem(KEYS.WEIGHT_DATA);
      } catch {
        /* 忽略 */
      }
    }

    // 3) config 瘦身
    if (legacyConfig) {
      safeSetItem(KEYS.PARENT_CONFIG, {
        schemaVersion: SCHEMA_VERSION,
        updatedAt: typeof legacyConfig.updatedAt === "string" ? legacyConfig.updatedAt : null,
        password:
          typeof legacyConfig.password === "string" ? legacyConfig.password : DEFAULT_PASSWORD,
        model: typeof legacyConfig.model === "string" ? legacyConfig.model : "",
      });
    }

    localStorage.setItem(LOCAL_CACHE_VERSION_KEY, LOCAL_CACHE_VERSION);
  } catch {
    // 隐私模式 / 存储满：保持内存默认值，静默
  }
}

/* ========== 服务端同步（防抖推送） ========== */

type SyncBlock = "config" | "stats" | "banks";

let syncTimer: ReturnType<typeof setTimeout> | null = null;
let pendingBlocks = new Set<SyncBlock>();

/** 同步抑制计数（>0 时所有 save* 都不再调度推送） */
let suppressSyncDepth = 0;

/** 是否请求"整体替换服务端 progress"（权重重置用；默认按 bankId 合并） */
let pendingProgressReplace = false;

/**
 * 在回调期间抑制服务端推送。
 *
 * 用途：启动同步把服务端数据写回 localStorage 时（见 stateSync.ts），
 * 若不加抑制会立刻把刚拉下来的同一份数据再 PUT 回服务端——一次无意义的
 * 往返 + 服务端整文件重写，还会把 updatedAt 刷成"刚改过"。
 * 嵌套调用安全（计数式）。
 */
export function withSuppressedServerSync<T>(fn: () => T): T {
  suppressSyncDepth += 1;
  try {
    return fn();
  } finally {
    suppressSyncDepth -= 1;
  }
}

/** 保存后调度一次防抖推送（500ms 合并多次写入） */
function scheduleServerSync(kind: SyncBlock) {
  if (typeof window === "undefined") return;
  if (suppressSyncDepth > 0) return;
  pendingBlocks.add(kind);
  if (syncTimer) clearTimeout(syncTimer);
  syncTimer = setTimeout(() => {
    void flushServerSync(false);
  }, 500);
}

/** 推送到期但失败的块重新入队（避免离线期间的改动被服务端旧值覆盖） */
function requeue(blocks: SyncBlock[]): void {
  for (const block of blocks) pendingBlocks.add(block);
}

/** 是否有未同步到服务端的本地改动 */
export function hasPendingServerSync(): boolean {
  return pendingBlocks.size > 0;
}

/**
 * 立即推送所有待同步块（从 localStorage 读取最新值）。
 * keepalive=true 时用于页面卸载场景（beforeunload），尽量不丢最后一次变更。
 *
 * 失败（离线 / 5xx）时把这些块重新入队：下次保存、next syncOnce 或网络恢复时重推，
 * 防止"离线改的字库被服务端旧值覆盖"。
 */
export function flushServerSync(keepalive = false): void {
  if (pendingBlocks.size === 0) return;
  const blocks = [...pendingBlocks];
  pendingBlocks.clear();

  const payload: Record<string, unknown> = {};
  if (blocks.includes("config")) payload.config = loadConfig();
  if (blocks.includes("stats")) {
    payload.stats = loadStats();
    if (pendingProgressReplace) payload.progressMode = "replace";
  }
  if (blocks.includes("banks")) payload.banks = loadBanks();

  const hadReplace = pendingProgressReplace;
  try {
    void fetch("/api/state", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      keepalive,
    })
      .then((res) => {
        if (res.ok) {
          if (hadReplace) pendingProgressReplace = false;
        } else {
          requeue(blocks);
        }
      })
      .catch(() => {
        requeue(blocks);
      });
  } catch {
    requeue(blocks);
  }
}

// 页面卸载时尽量推送未同步的变更；网络恢复时重推积压的块
if (typeof window !== "undefined") {
  window.addEventListener("beforeunload", () => flushServerSync(true));
  window.addEventListener("online", () => flushServerSync(false));
}

/* ========== 配置分区 ========== */

export function loadConfig(): ConfigSection {
  ensureLocalMigration();
  const raw = safeGetItem<Partial<ConfigSection>>(KEYS.PARENT_CONFIG, {});
  return {
    schemaVersion: SCHEMA_VERSION,
    updatedAt: typeof raw.updatedAt === "string" ? raw.updatedAt : null,
    password: typeof raw.password === "string" ? raw.password : DEFAULT_PASSWORD,
    model: typeof raw.model === "string" ? raw.model : "",
  };
}

export function saveConfig(patch: Partial<ConfigSection>): boolean {
  ensureLocalMigration();
  const current = loadConfig();
  const next: ConfigSection = {
    schemaVersion: SCHEMA_VERSION,
    updatedAt: nowIso(),
    password: typeof patch.password === "string" ? patch.password : current.password,
    model: typeof patch.model === "string" ? patch.model : current.model,
  };
  const ok = safeSetItem(KEYS.PARENT_CONFIG, next);
  scheduleServerSync("config");
  return ok;
}

/* ========== 统计分区（含权重进度） ========== */

export function loadStats(): StatsSection {
  ensureLocalMigration();
  const raw = safeGetItem<Partial<StatsSection>>(KEYS.STUDY_STATS, {});
  return {
    schemaVersion: SCHEMA_VERSION,
    updatedAt: typeof raw.updatedAt === "string" ? raw.updatedAt : null,
    totalCalls: numOr(raw.totalCalls, 0),
    todayCalls: numOr(raw.todayCalls, 0),
    todayDate: typeof raw.todayDate === "string" ? raw.todayDate : "",
    weeklyCalls: numOr(raw.weeklyCalls, 0),
    history: isPlainObject(raw.history) ? (raw.history as Record<string, number>) : {},
    sentenceHistory: Array.isArray(raw.sentenceHistory) ? raw.sentenceHistory : [],
    charUsage: isPlainObject(raw.charUsage) ? (raw.charUsage as Record<string, number>) : {},
    progress: isPlainObject(raw.progress) ? (raw.progress as WeightData) : {},
  };
}

/** 局部更新统计（未传字段保留现值）；progress 传入时整体替换 */
export function saveStats(patch: Partial<StatsSection>): boolean {
  ensureLocalMigration();
  const next: StatsSection = {
    ...loadStats(),
    ...patch,
    schemaVersion: SCHEMA_VERSION,
    updatedAt: nowIso(),
  };
  const ok = safeSetItem(KEYS.STUDY_STATS, next);
  scheduleServerSync("stats");
  return ok;
}

/** 权重进度（stats 分区的一个视图，键为 bankId） */
export function loadWeightData(): WeightData {
  return loadStats().progress;
}

/** 保存权重进度（局部字库；服务端按 bankId 合并） */
export function saveWeightData(data: WeightData): boolean {
  return saveStats({ progress: data });
}

/**
 * 整体替换权重进度（权重重置）
 *
 * 与 saveWeightData 的区别：显式告诉服务端"别再按 bankId 合并，直接覆盖"，
 * 否则重置后服务端仍保留旧进度，下次同步又会被拉回来。
 */
export function replaceWeightData(data: WeightData): boolean {
  pendingProgressReplace = true;
  return saveStats({ progress: data });
}

/* ========== 词库分区 ========== */

/**
 * 读取词库镜像；镜像为空时用默认值做一次"本地初始化"（离线首启兜底）。
 * 只写镜像、不推服务端——服务端有数据时会被同步覆盖（见 stateSync）。
 */
export function loadBanks(): BanksSection {
  ensureLocalMigration();
  const raw = safeGetItem<BanksSection | null>(KEYS.BANKS, null);
  const { section, changed } = reconcileBanks(raw);
  if (changed) safeSetItem(KEYS.BANKS, section);
  return section;
}

/** 保存词库分区（新增/编辑/删除自定义字库、切换启停） */
export function saveBanks(patch: Partial<BanksSection>): boolean {
  ensureLocalMigration();
  const next: BanksSection = {
    ...loadBanks(),
    ...patch,
    schemaVersion: SCHEMA_VERSION,
    updatedAt: nowIso(),
  };
  const ok = safeSetItem(KEYS.BANKS, next);
  scheduleServerSync("banks");
  return ok;
}
