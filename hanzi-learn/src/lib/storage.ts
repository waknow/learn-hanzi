/**
 * localStorage 封装
 *
 * 所有读写包裹 try/catch，
 * 应对 SSR 环境（服务端无 localStorage）和隐私模式（不可写）。
 */

import type { WeightData, StudyStats, ParentConfig } from './types';

/* ========== 通用 ========== */

const KEYS = {
  WEIGHT_DATA: 'hanzi_weight_data',
  STUDY_STATS: 'hanzi_study_stats',
  PARENT_CONFIG: 'hanzi_parent_config',
} as const;

function safeGetItem<T>(key: string, fallback: T): T {
  if (typeof window === 'undefined') return fallback;
  try {
    const raw = localStorage.getItem(key);
    if (raw === null) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function safeSetItem(key: string, value: unknown): boolean {
  if (typeof window === 'undefined') return false;
  try {
    localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch {
    return false;
  }
}

/* ========== 权重数据 ========== */

export function loadWeightData(): WeightData {
  return safeGetItem<WeightData>(KEYS.WEIGHT_DATA, {});
}

export function saveWeightData(data: WeightData): boolean {
  return safeSetItem(KEYS.WEIGHT_DATA, data);
}

/* ========== 学习统计 ========== */

export function loadStats(): StudyStats {
  return safeGetItem<StudyStats>(KEYS.STUDY_STATS, {
    totalCalls: 0,
    todayCalls: 0,
    todayDate: '',
    weeklyCalls: 0,
    history: {},
    sentenceHistory: [],
    charUsage: {},
  });
}

export function saveStats(stats: StudyStats): boolean {
  return safeSetItem(KEYS.STUDY_STATS, stats);
}

/* ========== 家长配置 ========== */

export function loadConfig(): ParentConfig {
  return safeGetItem<ParentConfig>(KEYS.PARENT_CONFIG, {
    password: '1234',
    enabledBanks: [],
    customBanks: [],
  });
}

export function saveConfig(config: ParentConfig): boolean {
  return safeSetItem(KEYS.PARENT_CONFIG, config);
}
