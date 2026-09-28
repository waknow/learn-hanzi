/**
 * 持久化结构版本与文件名常量
 *
 * v1 = 旧的单文件 data/state.json（weightData + stats + config 混合）
 * v2 = 三个分区文件（config.json / stats.json / banks.json）
 *
 * 设计见 docs/superpowers/bank-store-v2-design.md
 */

/** 当前持久化结构版本（三份文件共享） */
export const SCHEMA_VERSION = 2;

/** 数据目录下的三个分区文件名 */
export const STATE_FILE_NAMES = {
  config: "config.json",
  stats: "stats.json",
  banks: "banks.json",
} as const;

export type StatePartName = keyof typeof STATE_FILE_NAMES;

/** v1 单文件文件名与迁移备份后缀（迁移后改名 state.json.v1.bak） */
export const LEGACY_STATE_FILE_NAME = "state.json";
export const LEGACY_BACKUP_SUFFIX = ".v1.bak";
