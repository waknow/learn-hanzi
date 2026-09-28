/**
 * 状态数据的共享判定（服务端与客户端共用；不依赖 fs / localStorage）
 *
 * 这里只放"跨分区"的规则，分区内部的规则见 lib/banks.ts。
 */

import type { BanksSection, ConfigSection, StatsSection, StudyStats } from "./types";
import { SCHEMA_VERSION } from "./schema";

/** 默认家长密码（与 PasswordGate / docs/known-issues.md 的说明一致） */
export const DEFAULT_PASSWORD = "1234";

/** 空统计（所有计数归零） */
export const EMPTY_STUDY_STATS: StudyStats = {
  totalCalls: 0,
  todayCalls: 0,
  todayDate: "",
  weeklyCalls: 0,
  history: {},
  sentenceHistory: [],
  charUsage: {},
};

/** 默认配置分区 */
export function defaultConfig(now: string | null = null): ConfigSection {
  return {
    schemaVersion: SCHEMA_VERSION,
    updatedAt: now,
    password: DEFAULT_PASSWORD,
    model: "",
  };
}

/** 空统计分区（progress 为空） */
export function emptyStats(now: string | null = null): StatsSection {
  return {
    schemaVersion: SCHEMA_VERSION,
    updatedAt: now,
    ...EMPTY_STUDY_STATS,
    progress: {},
  };
}

/** 取最新的更新时间戳（ISO 字符串可直接比较）；全为空时返回 null */
export function latestUpdatedAt(values: (string | null | undefined)[]): string | null {
  let latest: string | null = null;
  for (const value of values) {
    if (typeof value !== "string" || value.length === 0) continue;
    if (latest === null || value > latest) latest = value;
  }
  return latest;
}

/** 跨分区、可能来自网络或磁盘的松散数据 */
export interface PartialState {
  config?: Partial<ConfigSection> | null;
  stats?: Partial<StatsSection> | null;
  banks?: Partial<BanksSection> | null;
}

/**
 * 是否包含"用户数据"（区别于初始化默认值）
 *
 * 用途：首次迁移判断"服务端是否为空"。⚠️ 不能用 updatedAt 判断——
 * v2 初始化会立刻写入 banks.json 并带上时间戳，用时间戳会导致
 * "服务端永远非空"，老用户的本地进度就再也推不上去了。
 */
export function hasUserData(state: PartialState | null | undefined): boolean {
  if (!state) return false;

  const config = state.config ?? {};
  if (typeof config.password === "string" && config.password !== DEFAULT_PASSWORD) return true;
  if (typeof config.model === "string" && config.model.trim() !== "") return true;

  const stats = state.stats ?? {};
  if (typeof stats.totalCalls === "number" && stats.totalCalls > 0) return true;
  if (Array.isArray(stats.sentenceHistory) && stats.sentenceHistory.length > 0) return true;
  if (stats.charUsage && Object.keys(stats.charUsage).length > 0) return true;
  if (stats.history && Object.keys(stats.history).length > 0) return true;
  if (stats.progress && Object.keys(stats.progress).length > 0) return true;

  const items = state.banks?.items ?? [];
  if (items.some((item) => item?.origin === "custom")) return true;
  // 家长关掉过某个字库也算用户数据（默认值全为启用）
  if (items.some((item) => item?.enabled === false)) return true;
  // 在内容维护页禁用过汉字、或给内置字库补过字也算用户数据（默认值两者都没有）
  if (items.some((item) => (item?.disabledChars?.length ?? 0) > 0)) return true;
  if (items.some((item) => item?.origin === "builtin" && item?.customized === true)) return true;

  return false;
}
