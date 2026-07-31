/**
 * 客户端启动同步
 *
 * 应用挂载时调用 syncOnce()：
 * 1. 首次使用且本地有数据、服务端为空 → 把本地数据推送到服务端（老用户平滑迁移，不丢进度）
 * 2. 其余情况 → 以服务端为准，拉取覆盖本地（换浏览器/设备后恢复进度）
 *
 * 网络失败时静默，保持本地缓存可用，下次挂载自动重试。
 */

import {
  KEYS,
  loadWeightData,
  saveWeightData,
  loadStats,
  saveStats,
  loadConfig,
  saveConfig,
} from './storage';
import type { WeightData, StudyStats, ParentConfig } from './types';

/** 已与服务器完成过同步的标记（避免重复执行首次迁移） */
const SYNCED_FLAG = 'hanzi_state_synced';

function hasLocalData(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    return (
      localStorage.getItem(KEYS.WEIGHT_DATA) !== null ||
      localStorage.getItem(KEYS.STUDY_STATS) !== null ||
      localStorage.getItem(KEYS.PARENT_CONFIG) !== null
    );
  } catch {
    return false;
  }
}

function isNonEmpty(obj: object | undefined | null): boolean {
  return !!obj && Object.keys(obj).length > 0;
}

/**
 * 与服务端同步一次。幂等，可在应用挂载时安全调用。
 */
export async function syncOnce(): Promise<void> {
  if (typeof window === 'undefined') return;

  try {
    const res = await fetch('/api/state', { cache: 'no-store' });
    if (!res.ok) return;
    const state = (await res.json()) as {
      weightData?: WeightData;
      stats?: StudyStats;
      config?: ParentConfig;
      updatedAt?: string | null;
    };

    const alreadySynced = localStorage.getItem(SYNCED_FLAG) === '1';
    const serverHasData = !!state.updatedAt;

    // 首次迁移：本地有数据、服务端为空 → 推送本地
    if (!alreadySynced && hasLocalData() && !serverHasData) {
      const payload: Record<string, unknown> = {};
      const w = loadWeightData();
      if (isNonEmpty(w)) payload.weightData = w;
      const s = loadStats();
      if (s.totalCalls > 0 || s.sentenceHistory.length > 0 || isNonEmpty(s.charUsage)) {
        payload.stats = s;
      }
      const c = loadConfig();
      if (c.customBanks.length > 0 || c.enabledBanks.length > 0 || c.password !== '1234') {
        payload.config = c;
      }
      await fetch('/api/state', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      localStorage.setItem(SYNCED_FLAG, '1');
      return;
    }

    // 服务端为准：拉取覆盖本地
    if (isNonEmpty(state.weightData)) saveWeightData(state.weightData as WeightData);
    if (state.stats) saveStats(state.stats as StudyStats);
    if (state.config) saveConfig(state.config as ParentConfig);
    localStorage.setItem(SYNCED_FLAG, '1');
  } catch {
    // 网络失败：保持本地缓存，静默，下次挂载重试
  }
}
