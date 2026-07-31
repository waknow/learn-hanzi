/**
 * 服务端状态存储层（仅 Node 环境使用，勿在客户端 import）
 *
 * 数据持久化到 data/state.json，采用原子写（临时文件 + rename），
 * 文件损坏时回退默认值，不影响应用启动。
 *
 * 路径规则（可用环境变量 STATE_FILE 覆盖）：
 *   - 本地开发: <cwd>/data/state.json  → hanzi-learn/data/state.json
 *   - Docker:   <cwd>/data/state.json  → /app/data/state.json（compose 挂载 volume 持久化）
 */

import fs from 'fs';
import path from 'path';

import type { WeightData, StudyStats, ParentConfig } from '../types';

export interface StateFile {
  weightData: WeightData;
  stats: StudyStats;
  config: ParentConfig;
  /** 最近一次写入时间（ISO），用于判断服务端是否已有数据 */
  updatedAt: string | null;
}

const DEFAULT_STATS: StudyStats = {
  totalCalls: 0,
  todayCalls: 0,
  todayDate: '',
  weeklyCalls: 0,
  history: {},
  sentenceHistory: [],
  charUsage: {},
};

const DEFAULT_CONFIG: ParentConfig = {
  password: '1234',
  enabledBanks: [],
  customBanks: [],
};

export function getStateFilePath(): string {
  return process.env.STATE_FILE || path.join(process.cwd(), 'data', 'state.json');
}

export function defaultState(): StateFile {
  return {
    weightData: {},
    stats: { ...DEFAULT_STATS },
    config: { ...DEFAULT_CONFIG },
    updatedAt: null,
  };
}

/** 读取状态（文件不存在 / 损坏时返回默认，不抛异常） */
export function readState(): StateFile {
  try {
    const filePath = getStateFilePath();
    const raw = fs.readFileSync(filePath, 'utf-8');
    const parsed = JSON.parse(raw) as Partial<StateFile>;
    const base = defaultState();
    return {
      // 权重按 bank 合并：保留服务端已有但本次未推送的字库
      weightData: { ...base.weightData, ...(parsed.weightData ?? {}) },
      stats: { ...base.stats, ...(parsed.stats ?? {}) },
      config: { ...base.config, ...(parsed.config ?? {}) },
      updatedAt: parsed.updatedAt ?? null,
    };
  } catch {
    return defaultState();
  }
}

/**
 * 合并写入（局部更新），原子写。
 * weightData 按 bankId 合并（客户端只推自己有的字库，避免覆盖其他字库的权重）。
 */
export function writeState(
  partial: Partial<Pick<StateFile, 'weightData' | 'stats' | 'config'>>
): StateFile {
  const current = readState();
  const next: StateFile = {
    weightData: { ...current.weightData, ...(partial.weightData ?? {}) },
    stats: partial.stats ?? current.stats,
    config: partial.config ?? current.config,
    updatedAt: new Date().toISOString(),
  };

  const filePath = getStateFilePath();
  const tmpPath = `${filePath}.tmp`;
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(tmpPath, JSON.stringify(next, null, 2), 'utf-8');
  fs.renameSync(tmpPath, filePath);
  return next;
}
