/**
 * 服务端状态存储层（仅 Node 环境使用，勿在客户端 import）
 *
 * v2 起数据按类别落在三个文件（见 docs/superpowers/bank-store-v2-design.md）：
 *   data/config.json   配置类：密码 / 模型
 *   data/stats.json    统计类：调用统计 + 历史 + 字频 + 权重进度 progress
 *   data/banks.json    词库类：初始化默认值 + 自定义字库 + 启停
 *
 * 数据生命周期（三个互不相同的事件）：
 *   E1 初始化  ensureInitialized()      —— 文件不存在 → 写入默认值（含内置字库）
 *   E2 迁移    migrateLegacyIfNeeded()  —— v1 单文件 state.json → 三份 + state.json.v1.bak
 *   E3 升级补种 reconcileBanks()        —— 默认值版本/指纹变化 → 只更新内置条目
 *
 * 路径规则（STATE_DIR 优先；兼容旧的 STATE_FILE —— 取其所在目录作为状态目录）：
 *   - 本地开发: <cwd>/data/
 *   - Docker:   /app/data/（compose 挂载 volume 持久化）
 *
 * 降级约定：
 *   - 初始化/读取失败（只读卷、权限、文件损坏）一律不抛，返回内存中的默认值，不白屏
 *   - 显式写入（PUT /api/state）失败则抛出，由路由转成 500
 */

import fs from "fs";
import path from "path";

import {
  LEGACY_BACKUP_SUFFIX,
  LEGACY_STATE_FILE_NAME,
  SCHEMA_VERSION,
  STATE_FILE_NAMES,
  type StatePartName,
} from "../schema";
import { createBanksSectionFromLegacy, createEmptyBanksSection, reconcileBanks } from "../banks";
import { DEFAULT_PASSWORD, defaultConfig, emptyStats, latestUpdatedAt } from "../stateShape";
import type {
  AppState,
  BanksSection,
  ConfigSection,
  StatsSection,
  StudyStats,
  WeightData,
  WordBank,
} from "../types";

/** v1 单文件结构（仅迁移时读取） */
interface LegacyStateFile {
  weightData?: WeightData;
  stats?: Partial<StudyStats>;
  config?: {
    password?: string;
    model?: string;
    enabledBanks?: string[];
    customBanks?: WordBank[];
  };
  updatedAt?: string | null;
}

/**
 * 写入请求（局部更新）。
 * 字段刻意声明为 unknown：内容来自 HTTP 请求体或客户端，由本模块统一校验与清洗。
 */
export interface StateWriteInput {
  config?: unknown;
  stats?: unknown;
  banks?: unknown;
  /** 权重进度（等价于 stats.progress）；默认按 bankId 合并 */
  progress?: unknown;
  /** "replace" = 整体替换 progress（权重重置用），否则按 bankId 合并 */
  progressMode?: unknown;
  /** v1 旧客户端的块名，兼容映射到 stats.progress */
  weightData?: unknown;
}

/* ========== 路径 ========== */

/** 状态目录（STATE_DIR 优先；兼容旧的 STATE_FILE —— 取其所在目录） */
export function getStateDir(): string {
  const dir = process.env.STATE_DIR;
  if (dir && dir.trim()) return dir;
  const legacy = process.env.STATE_FILE;
  if (legacy && legacy.trim()) return path.dirname(legacy);
  return path.join(process.cwd(), "data");
}

/** v1 单文件路径（迁移时使用；测试用 STATE_FILE 指路） */
export function getStateFilePath(): string {
  const legacy = process.env.STATE_FILE;
  if (legacy && legacy.trim()) return legacy;
  return path.join(getStateDir(), LEGACY_STATE_FILE_NAME);
}

/** 分区文件路径 */
export function getPartPath(part: StatePartName): string {
  return path.join(getStateDir(), STATE_FILE_NAMES[part]);
}

/* ========== 文件读写 ========== */

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function num(value: unknown, fallback: number): number {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

/** 损坏文件另存 *.corrupt.<ts>，便于排查（best-effort，失败忽略） */
function quarantine(filePath: string): void {
  try {
    if (!fs.existsSync(filePath)) return;
    fs.renameSync(filePath, `${filePath}.corrupt.${Date.now()}`);
  } catch {
    /* 只读卷等：忽略 */
  }
}

/** 读取 JSON 文件；不存在或损坏返回 null */
function readJsonFile<T>(filePath: string): T | null {
  try {
    if (!fs.existsSync(filePath)) return null;
    return JSON.parse(fs.readFileSync(filePath, "utf-8")) as T;
  } catch {
    quarantine(filePath);
    return null;
  }
}

/** 原子写（临时文件 + rename）；失败抛出 */
function atomicWriteJson(filePath: string, value: unknown): void {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  const tmpPath = `${filePath}.tmp`;
  fs.writeFileSync(tmpPath, JSON.stringify(value, null, 2), "utf-8");
  fs.renameSync(tmpPath, filePath);
}

/** 尽力写（初始化/自愈路径）：失败不抛，保证应用不白屏 */
function safeWriteJson(filePath: string, value: unknown): boolean {
  try {
    atomicWriteJson(filePath, value);
    return true;
  } catch {
    return false;
  }
}

/* ========== 分区读取（不做初始化，避免递归） ========== */

function readConfigInternal(): ConfigSection {
  const raw = readJsonFile<Partial<ConfigSection>>(getPartPath("config")) ?? {};
  return {
    schemaVersion: SCHEMA_VERSION,
    updatedAt: typeof raw.updatedAt === "string" ? raw.updatedAt : null,
    // 空串是合法值（PasswordGate 的"首次设置密码"分支），不做默认值兜底
    password: typeof raw.password === "string" ? raw.password : DEFAULT_PASSWORD,
    model: typeof raw.model === "string" ? raw.model : "",
  };
}

function readStatsInternal(): StatsSection {
  const raw = readJsonFile<Partial<StatsSection>>(getPartPath("stats")) ?? {};
  const base = emptyStats();
  return {
    schemaVersion: SCHEMA_VERSION,
    updatedAt: typeof raw.updatedAt === "string" ? raw.updatedAt : null,
    totalCalls: num(raw.totalCalls, base.totalCalls),
    todayCalls: num(raw.todayCalls, base.todayCalls),
    todayDate: typeof raw.todayDate === "string" ? raw.todayDate : base.todayDate,
    weeklyCalls: num(raw.weeklyCalls, base.weeklyCalls),
    history: isPlainObject(raw.history) ? (raw.history as Record<string, number>) : {},
    sentenceHistory: Array.isArray(raw.sentenceHistory) ? raw.sentenceHistory : [],
    charUsage: isPlainObject(raw.charUsage) ? (raw.charUsage as Record<string, number>) : {},
    progress: isPlainObject(raw.progress) ? (raw.progress as WeightData) : {},
  };
}

/** 读词库分区并顺带完成 E1/E3：缺失或版本变化时落盘（这是"本地没有就写入"的入口） */
function readBanksInternal(): BanksSection {
  const filePath = getPartPath("banks");
  const raw = readJsonFile<BanksSection>(filePath);
  const { section, changed } = reconcileBanks(raw);
  if (changed) safeWriteJson(filePath, section);
  return section;
}

/* ========== E1 初始化 / E2 迁移 ========== */

/**
 * 初始化（幂等）：迁移 v1 → 补齐三份文件。
 * 由启动钩子 src/instrumentation.ts 与读路径共同调用；
 * 健康状态下只有几次 existsSync 判断，不会写入。
 */
export function ensureInitialized(): void {
  try {
    migrateLegacyIfNeeded();
    ensureConfigOrStats("config");
    ensureConfigOrStats("stats");
    readBanksInternal();
  } catch {
    // 只读卷 / 权限不足：降级为内存默认值，不阻断应用启动
  }
}

/** 文件缺失则写默认值；结构版本过旧则归一化落盘（缺字段在读取时按默认值补齐） */
function ensureConfigOrStats(part: "config" | "stats"): void {
  const filePath = getPartPath(part);
  const raw = readJsonFile<Record<string, unknown>>(filePath);
  if (!raw) {
    safeWriteJson(
      filePath,
      part === "config"
        ? defaultConfig(new Date().toISOString())
        : emptyStats(new Date().toISOString()),
    );
    return;
  }
  if (raw.schemaVersion !== SCHEMA_VERSION) {
    safeWriteJson(filePath, part === "config" ? readConfigInternal() : readStatsInternal());
  }
}

/**
 * v1 单文件 → 三份 v2 文件（E2）
 *
 * 顺序保证可自愈：先写全三份、最后才把 v1 改名备份；
 * 若中途崩溃（三份只写了一部分），下次启动只从 v1 补齐缺失的分区，不覆盖已有 v2。
 */
function migrateLegacyIfNeeded(): void {
  const legacyPath = getStateFilePath();
  if (!fs.existsSync(legacyPath)) return;

  const parts: StatePartName[] = ["config", "stats", "banks"];
  const missing = parts.filter((part) => !fs.existsSync(getPartPath(part)));
  const legacy = readJsonFile<LegacyStateFile>(legacyPath);

  // 三份齐全（迁移完成）或 v1 无法解析 → 只留备份，交给默认值/已有 v2 数据
  if (missing.length === 0 || !legacy) {
    backupLegacy(legacyPath);
    return;
  }

  const built = buildFromLegacy(legacy, new Date().toISOString());
  for (const part of missing) {
    atomicWriteJson(getPartPath(part), built[part]);
  }
  backupLegacy(legacyPath);
}

/** v1 字段映射（见设计稿 §6.3） */
function buildFromLegacy(
  legacy: LegacyStateFile,
  now: string,
): Record<StatePartName, ConfigSection | StatsSection | BanksSection> {
  const legacyConfig = isPlainObject(legacy.config) ? legacy.config : {};
  const customBanks = Array.isArray(legacyConfig.customBanks) ? legacyConfig.customBanks : [];
  const enabledBanks = Array.isArray(legacyConfig.enabledBanks) ? legacyConfig.enabledBanks : [];
  const legacyStats = isPlainObject(legacy.stats) ? legacy.stats : {};

  const config: ConfigSection = {
    schemaVersion: SCHEMA_VERSION,
    updatedAt: now,
    password: typeof legacyConfig.password === "string" ? legacyConfig.password : DEFAULT_PASSWORD,
    model: typeof legacyConfig.model === "string" ? legacyConfig.model : "",
  };

  const stats: StatsSection = {
    ...emptyStats(now),
    ...(legacyStats as Partial<StatsSection>),
    schemaVersion: SCHEMA_VERSION,
    updatedAt: now,
    history: isPlainObject(legacyStats.history)
      ? (legacyStats.history as Record<string, number>)
      : {},
    sentenceHistory: Array.isArray(legacyStats.sentenceHistory) ? legacyStats.sentenceHistory : [],
    charUsage: isPlainObject(legacyStats.charUsage)
      ? (legacyStats.charUsage as Record<string, number>)
      : {},
    // v1 的 weightData → v2 的 stats.progress
    progress: isPlainObject(legacy.weightData) ? legacy.weightData : {},
  };

  // 内置默认值 + 家长自定义字库，并按旧的 enabledBanks 规则（空数组 = 全部启用）设置启停
  const banks = createBanksSectionFromLegacy(customBanks as WordBank[], enabledBanks, now);

  return { config, stats, banks };
}

/** 备份 v1 文件；已存在备份则不覆盖（避免二次迁移覆盖唯一副本） */
function backupLegacy(legacyPath: string): void {
  try {
    const backupPath = `${legacyPath}${LEGACY_BACKUP_SUFFIX}`;
    if (fs.existsSync(backupPath)) return;
    fs.renameSync(legacyPath, backupPath);
  } catch {
    /* 只读卷：保留原文件，下次启动再试 */
  }
}

/* ========== 读取（对外） ========== */

export function readConfig(): ConfigSection {
  ensureInitialized();
  return readConfigInternal();
}

export function readStats(): StatsSection {
  ensureInitialized();
  return readStatsInternal();
}

export function readBanks(): BanksSection {
  ensureInitialized();
  return readBanksInternal();
}

/** 三份文件的聚合视图（/api/state 的 GET 返回体、跨设备同步的数据源） */
export function readState(): AppState {
  ensureInitialized();
  const config = readConfigInternal();
  const stats = readStatsInternal();
  const banks = readBanksInternal();
  return {
    schemaVersion: SCHEMA_VERSION,
    config,
    stats,
    banks,
    updatedAt: latestUpdatedAt([config.updatedAt, stats.updatedAt, banks.updatedAt]),
    updatedAtByPart: {
      config: config.updatedAt,
      stats: stats.updatedAt,
      banks: banks.updatedAt,
    },
  };
}

/** 文件不存在时的内存默认视图（不发 IO、不落盘） */
export function defaultState(): AppState {
  return {
    schemaVersion: SCHEMA_VERSION,
    config: defaultConfig(),
    stats: emptyStats(),
    banks: createEmptyBanksSection(),
    updatedAt: null,
    updatedAtByPart: { config: null, stats: null, banks: null },
  };
}

/* ========== 写入（对外） ========== */

/** 写配置分区（未传的字段保留现值） */
export function writeConfig(patch: Partial<ConfigSection>): ConfigSection {
  const current = readConfigInternal();
  const next: ConfigSection = {
    schemaVersion: SCHEMA_VERSION,
    updatedAt: new Date().toISOString(),
    password: typeof patch.password === "string" ? patch.password : current.password,
    model: typeof patch.model === "string" ? patch.model : current.model,
  };
  atomicWriteJson(getPartPath("config"), next);
  return next;
}

/**
 * 写统计分区。
 * progress 默认按 bankId 合并（客户端只推自己有的字库，避免覆盖其他设备进度）；
 * replaceProgress = true 时整体替换（"权重重置"必须走这条，否则重置会被合并吃掉）。
 */
export function writeStats(
  patch: Partial<StatsSection>,
  opts: { replaceProgress?: boolean } = {},
): StatsSection {
  const current = readStatsInternal();
  const next: StatsSection = {
    ...current,
    schemaVersion: SCHEMA_VERSION,
    updatedAt: new Date().toISOString(),
  };
  if (typeof patch.totalCalls === "number") next.totalCalls = patch.totalCalls;
  if (typeof patch.todayCalls === "number") next.todayCalls = patch.todayCalls;
  if (typeof patch.todayDate === "string") next.todayDate = patch.todayDate;
  if (typeof patch.weeklyCalls === "number") next.weeklyCalls = patch.weeklyCalls;
  if (isPlainObject(patch.history)) next.history = patch.history as Record<string, number>;
  if (Array.isArray(patch.sentenceHistory)) next.sentenceHistory = patch.sentenceHistory;
  if (isPlainObject(patch.charUsage)) next.charUsage = patch.charUsage as Record<string, number>;
  if (isPlainObject(patch.progress)) {
    next.progress = opts.replaceProgress
      ? (patch.progress as WeightData)
      : { ...current.progress, ...(patch.progress as WeightData) };
  }
  atomicWriteJson(getPartPath("stats"), next);
  return next;
}

/**
 * 写词库分区。
 *
 * 落盘前强制走一次 reconcileBanks：即使客户端传来缺了内置条目的数据，
 * 也会被补齐（内置字库不可被删除，家长只能改自定义字库与启停）。
 */
export function writeBanks(incoming: Partial<BanksSection>): BanksSection {
  const normalized: BanksSection = {
    schemaVersion: SCHEMA_VERSION,
    updatedAt: new Date().toISOString(),
    seedRevision: typeof incoming.seedRevision === "number" ? incoming.seedRevision : 0,
    seedFingerprint: typeof incoming.seedFingerprint === "string" ? incoming.seedFingerprint : "",
    seededAt: typeof incoming.seededAt === "string" ? incoming.seededAt : null,
    items: Array.isArray(incoming.items) ? incoming.items : [],
  };
  const { section } = reconcileBanks(normalized);
  atomicWriteJson(getPartPath("banks"), section);
  return section;
}

/**
 * 局部更新（PUT /api/state 的落点）：只写传入的分区，其余保持不动。
 * 写入失败会抛出，由路由转成 500（初始化/自愈路径才降级）。
 */
export function writeState(partial: StateWriteInput): AppState {
  ensureInitialized();

  if (isPlainObject(partial.config)) {
    writeConfig(partial.config as Partial<ConfigSection>);
  }

  const statsPatch: Partial<StatsSection> = {};
  if (isPlainObject(partial.stats)) {
    Object.assign(statsPatch, partial.stats as Partial<StatsSection>);
  }
  const progress = isPlainObject(partial.progress)
    ? partial.progress
    : isPlainObject(partial.weightData)
      ? partial.weightData
      : null;
  if (progress) {
    statsPatch.progress = { ...(statsPatch.progress ?? {}), ...(progress as WeightData) };
  }
  if (Object.keys(statsPatch).length > 0) {
    writeStats(statsPatch, { replaceProgress: partial.progressMode === "replace" });
  }

  if (isPlainObject(partial.banks)) {
    writeBanks(partial.banks as Partial<BanksSection>);
  }

  return readState();
}
