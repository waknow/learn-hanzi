/**
 * DeepSeek 模型目录（纯数据 + 纯函数，客户端/服务端均可 import）
 *
 * 职责：
 * - 定义「自动 / 手动」模型选择的类型与常量
 * - 维护内置兜底目录（网络或 API Key 不可用时仍可让家长看到候选模型）
 * - 归一化上游 /models 返回值，并按用途（句子生成）排序
 *
 * 真正的网络获取在 `lib/server/modelStore.ts`（仅服务端，含 API Key 与缓存）。
 */

/** 模型选择来源 */
export type ModelSource =
  /** 家长在设置页手动选定 */
  | "manual"
  /** 未手动指定，取环境变量 DEEPSEEK_MODEL */
  | "env"
  /** 未手动指定且无环境变量，取内置默认 */
  | "default";

/** 单个模型的可展示信息 */
export interface ModelInfo {
  /** 模型 id，直接用于 chat/completions 的 model 字段 */
  id: string;
  /** 展示名称 */
  label: string;
  /** 上下文窗口（token），未知为 null */
  contextWindow: number | null;
  /** 一句话说明（用途/特点） */
  description: string;
  /** 是否适合本应用的「短句生成」场景（适合的排在前面） */
  recommended: boolean;
}

/** 未手动选择时使用的内置默认模型 */
export const DEFAULT_MODEL = "deepseek-v4-flash";

/** 「自动」选项的存储值（空串表示交给服务端按 env/默认解析） */
export const AUTO_MODEL = "";

/** 内置兜底目录：上游不可用时的候选列表（id 为 DeepSeek 常用模型） */
export const FALLBACK_MODELS: ModelInfo[] = [
  {
    id: "deepseek-v4-flash",
    label: "DeepSeek V4 Flash",
    contextWindow: 128000,
    description: "速度快、成本低，适合日常短句生成（推荐）",
    recommended: true,
  },
  {
    id: "deepseek-v4-pro",
    label: "DeepSeek V4 Pro",
    contextWindow: 128000,
    description: "能力更强、稍慢稍贵，适合要求更高的表达",
    recommended: true,
  },
  {
    id: "deepseek-v4-flash-vision-exp",
    label: "DeepSeek V4 Flash Vision（实验）",
    contextWindow: 128000,
    description: "多模态实验模型，纯文本生成非首选",
    recommended: false,
  },
];

/** 已知模型的展示元数据（上游只返回 id，其余信息在这里补齐） */
const KNOWN_MODEL_META: Record<string, Omit<ModelInfo, "id">> = {
  "deepseek-v4-flash": {
    label: "DeepSeek V4 Flash",
    contextWindow: 128000,
    description: "速度快、成本低，适合日常短句生成（推荐）",
    recommended: true,
  },
  "deepseek-v4-pro": {
    label: "DeepSeek V4 Pro",
    contextWindow: 128000,
    description: "能力更强、稍慢稍贵，适合要求更高的表达",
    recommended: true,
  },
  "deepseek-v4-flash-vision-exp": {
    label: "DeepSeek V4 Flash Vision（实验）",
    contextWindow: 128000,
    description: "多模态实验模型，纯文本生成非首选",
    recommended: false,
  },
  "deepseek-chat": {
    label: "DeepSeek Chat（旧名）",
    contextWindow: 64000,
    description: "旧模型名，官方已计划停用",
    recommended: false,
  },
  "deepseek-reasoner": {
    label: "DeepSeek Reasoner（旧名）",
    contextWindow: 64000,
    description: "推理模型，输出较慢，不适合短句生成",
    recommended: false,
  },
};

/** 是否为可用的模型 id（非空字符串、无空格） */
export function isValidModelId(value: unknown): value is string {
  return typeof value === "string" && /^[A-Za-z0-9._:-]{2,64}$/.test(value.trim());
}

/** 补全单个模型的展示信息（已知模型用内置元数据，未知模型用通用文案） */
export function describeModel(id: string): ModelInfo {
  const meta = KNOWN_MODEL_META[id];
  if (meta) return { id, ...meta };
  return {
    id,
    label: id,
    contextWindow: null,
    description: "DeepSeek 账号可用的模型",
    recommended: false,
  };
}

/**
 * 归一化上游 /models 响应 → 模型列表。
 * 只保留合法 id、去重；未知模型保留（账号可能已开放新模型）。
 */
export function normalizeModelList(raw: unknown): ModelInfo[] {
  const data =
    raw && typeof raw === "object" && Array.isArray((raw as { data?: unknown }).data)
      ? ((raw as { data: unknown[] }).data ?? [])
      : [];

  const seen = new Set<string>();
  const result: ModelInfo[] = [];
  for (const item of data) {
    const id = (item as { id?: unknown })?.id;
    if (!isValidModelId(id)) continue;
    const trimmed = id.trim();
    if (seen.has(trimmed)) continue;
    seen.add(trimmed);
    result.push(describeModel(trimmed));
  }
  return sortModels(result);
}

/** 排序：适合短句生成的优先，其次按 id 稳定排序 */
export function sortModels(models: ModelInfo[]): ModelInfo[] {
  return [...models].sort((a, b) => {
    if (a.recommended !== b.recommended) return a.recommended ? -1 : 1;
    return a.id.localeCompare(b.id);
  });
}

/**
 * 解析「实际使用的模型」。
 *
 * 优先级：手动选择 > 环境变量 DEEPSEEK_MODEL > 内置默认。
 * 手动选择被清空（空串）时视为「自动」。
 */
export function resolveEffectiveModel(
  selected?: string | null,
  envModel?: string | null,
): { model: string; source: ModelSource } {
  const manual = typeof selected === "string" ? selected.trim() : "";
  if (manual) return { model: manual, source: "manual" };
  const env = typeof envModel === "string" ? envModel.trim() : "";
  if (env) return { model: env, source: "env" };
  return { model: DEFAULT_MODEL, source: "default" };
}
