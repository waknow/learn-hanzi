/**
 * localStorage 封装
 *
 * 所有读写包裹 try/catch，
 * 应对 SSR 环境（服务端无 localStorage）和隐私模式（不可写）。
 *
 * 同步读写仍在本地完成（hooks 零改动）；保存时后台防抖同步到服务端
 * （/api/state），换浏览器/设备后可恢复进度（见 src/lib/stateSync.ts）。
 */

import type { WeightData, StudyStats, ParentConfig } from "./types";

/* ========== 通用 ========== */

export const KEYS = {
  WEIGHT_DATA: "hanzi_weight_data",
  STUDY_STATS: "hanzi_study_stats",
  PARENT_CONFIG: "hanzi_parent_config",
} as const;

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

function safeSetItem(key: string, value: unknown): boolean {
  if (typeof window === "undefined") return false;
  try {
    localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch {
    return false;
  }
}

/* ========== 服务端同步（防抖推送） ========== */

type SyncBlock = "weightData" | "stats" | "config";

let syncTimer: ReturnType<typeof setTimeout> | null = null;
let pendingBlocks = new Set<SyncBlock>();

/** 保存后调度一次防抖推送（500ms 合并多次写入） */
function scheduleServerSync(kind: SyncBlock) {
  if (typeof window === "undefined") return;
  pendingBlocks.add(kind);
  if (syncTimer) clearTimeout(syncTimer);
  syncTimer = setTimeout(() => {
    void flushServerSync(false);
  }, 500);
}

/**
 * 立即推送所有待同步块（从 localStorage 读取最新值）。
 * keepalive=true 时用于页面卸载场景（beforeunload），尽量不丢最后一次变更。
 */
export function flushServerSync(keepalive = false): void {
  if (pendingBlocks.size === 0) return;
  const blocks = [...pendingBlocks];
  pendingBlocks.clear();

  const payload: Record<string, unknown> = {};
  if (blocks.includes("weightData")) payload.weightData = loadWeightData();
  if (blocks.includes("stats")) payload.stats = loadStats();
  if (blocks.includes("config")) payload.config = loadConfig();

  try {
    void fetch("/api/state", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      keepalive,
    }).catch(() => {
      // 同步失败静默：本地缓存仍可用，下次保存会再次推送
    });
  } catch {
    // 同上
  }
}

// 页面卸载时尽量推送未同步的变更
if (typeof window !== "undefined") {
  window.addEventListener("beforeunload", () => flushServerSync(true));
}

/* ========== 权重数据 ========== */

export function loadWeightData(): WeightData {
  return safeGetItem<WeightData>(KEYS.WEIGHT_DATA, {});
}

export function saveWeightData(data: WeightData): boolean {
  const ok = safeSetItem(KEYS.WEIGHT_DATA, data);
  scheduleServerSync("weightData");
  return ok;
}

/* ========== 学习统计 ========== */

export function loadStats(): StudyStats {
  return safeGetItem<StudyStats>(KEYS.STUDY_STATS, {
    totalCalls: 0,
    todayCalls: 0,
    todayDate: "",
    weeklyCalls: 0,
    history: {},
    sentenceHistory: [],
    charUsage: {},
  });
}

export function saveStats(stats: StudyStats): boolean {
  const ok = safeSetItem(KEYS.STUDY_STATS, stats);
  scheduleServerSync("stats");
  return ok;
}

/* ========== 家长配置 ========== */

export function loadConfig(): ParentConfig {
  return safeGetItem<ParentConfig>(KEYS.PARENT_CONFIG, {
    password: "1234",
    enabledBanks: [],
    customBanks: [],
  });
}

export function saveConfig(config: ParentConfig): boolean {
  const ok = safeSetItem(KEYS.PARENT_CONFIG, config);
  scheduleServerSync("config");
  return ok;
}
