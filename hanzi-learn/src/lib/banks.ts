/**
 * 词库分区（banks.json）的纯函数逻辑 —— 服务端与客户端共用
 *
 * 数据生命周期三个事件（见 docs/superpowers/bank-store-v2-design.md §6）：
 * - E1 初始化：分区缺失 / items 为空 → 全量写入默认值
 * - E2 迁移：v1 的自定义字库 + enabledBanks → v2 条目
 * - E3 升级补种：seedRevision / seedFingerprint 变化 → 只更新内置且未被家长改过的条目
 *
 * ⚠️ 规则只写在这一份，禁止服务端/客户端各写一套；也不要在别处再实现一遍判定。
 */

import type { BankRecord, BanksSection, WordBank } from "./types";
import { SCHEMA_VERSION } from "./schema";
import { BUILTIN_BANK_SEED, BUILTIN_SEED_REVISION } from "./seed/builtinBanks";

/** FNV-1a 32 位哈希（无依赖、浏览器可用；不能用 node:crypto，客户端会打包本模块） */
function fnv1a(input: string): string {
  let hash = 0x811c9dc5;
  for (let i = 0; i < input.length; i += 1) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash.toString(16).padStart(8, "0");
}

/** 初始化默认值的内容指纹（8 位十六进制）：内容变化即变化，兜住"忘记 +1 seedRevision" */
export function seedFingerprint(seed: WordBank[] = BUILTIN_BANK_SEED): string {
  return fnv1a(seed.map((b) => [b.id, b.name, b.emoji, b.chars.join("")].join("|")).join("\n"));
}

/** 把默认字库转成持久化条目（防御性拷贝：调用方拿到的不是默认值对象本身） */
export function createSeedRecords(
  seed: WordBank[] = BUILTIN_BANK_SEED,
  now: string = new Date().toISOString(),
): BankRecord[] {
  return seed.map((b) => ({
    id: b.id,
    name: b.name,
    emoji: b.emoji,
    chars: [...b.chars],
    origin: "builtin",
    enabled: true,
    createdAt: now,
    updatedAt: now,
  }));
}

/** 构造全新的词库分区（E1 初始化用） */
export function createBanksSection(now: string = new Date().toISOString()): BanksSection {
  return {
    schemaVersion: SCHEMA_VERSION,
    updatedAt: now,
    seedRevision: BUILTIN_SEED_REVISION,
    seedFingerprint: seedFingerprint(),
    seededAt: now,
    items: createSeedRecords(BUILTIN_BANK_SEED, now),
  };
}

/**
 * 空词库分区：只有默认值条目、未落盘（updatedAt/seededAt 为 null）
 * 用于"文件不存在时"的内存默认视图（defaultState / 客户端空镜像）
 */
export function createEmptyBanksSection(): BanksSection {
  return {
    schemaVersion: SCHEMA_VERSION,
    updatedAt: null,
    seedRevision: BUILTIN_SEED_REVISION,
    seedFingerprint: seedFingerprint(),
    seededAt: null,
    items: createSeedRecords(),
  };
}

/** 深拷贝条目（chars 也拷贝），避免调用方改动回流到入参/默认值 */
function copyRecords(items: BankRecord[]): BankRecord[] {
  return items.map((i) => ({ ...i, chars: [...i.chars] }));
}

/** 按 v1 的 enabledBanks 规则（空数组 = 全部启用）设置启停 */
export function applyEnabledBanks(items: BankRecord[], enabledBanks: string[]): BankRecord[] {
  const allEnabled = enabledBanks.length === 0;
  return items.map((i) => ({ ...i, enabled: allEnabled || enabledBanks.includes(i.id) }));
}

/** E2 迁移：内置默认值 + 家长自定义字库，并按旧 enabledBanks 规则设置启停 */
export function createMigratedBankRecords(
  customBanks: WordBank[],
  enabledBanks: string[],
  now: string = new Date().toISOString(),
  seed: WordBank[] = BUILTIN_BANK_SEED,
): BankRecord[] {
  const builtin = createSeedRecords(seed, now);
  const custom: BankRecord[] = customBanks.map((b) => ({
    id: b.id,
    name: b.name,
    emoji: b.emoji,
    chars: [...b.chars],
    origin: "custom",
    enabled: true,
    createdAt: now,
    updatedAt: now,
  }));
  return applyEnabledBanks([...builtin, ...custom], enabledBanks);
}

/**
 * 直接构造一个完整词库分区（E2 迁移 / 客户端本地镜像初始化用）
 * 与 reconcileBanks(null) 的区别：条目来自 v1 的 customBanks + enabledBanks
 */
export function createBanksSectionFromLegacy(
  customBanks: WordBank[],
  enabledBanks: string[],
  now: string = new Date().toISOString(),
): BanksSection {
  return {
    schemaVersion: SCHEMA_VERSION,
    updatedAt: now,
    seedRevision: BUILTIN_SEED_REVISION,
    seedFingerprint: seedFingerprint(),
    seededAt: now,
    items: createMigratedBankRecords(customBanks, enabledBanks, now),
  };
}

export interface ReconcileOptions {
  /** 默认字库（测试注入用；生产用内置默认值） */
  seed?: WordBank[];
  /** 默认字库版本号 */
  revision?: number;
  /** 写入时间戳（测试注入用） */
  now?: string;
}

export interface ReconcileResult {
  section: BanksSection;
  /** 是否需要落盘：false 时调用方不应写文件（避免每次启动刷新 updatedAt） */
  changed: boolean;
}

/**
 * E1 + E3：初始化 / 升级补种（幂等）
 *
 * - 分区缺失或 items 为空 → 全量写入默认值，changed = true
 * - seedRevision 或 seedFingerprint 与代码不一致 → 增量补种：
 *   补新增的内置字库；对 origin === "builtin" 且未被家长改过（customized）的条目更新内容；
 *   origin === "custom" 与 customized 的条目**永不覆盖**
 * - 两者都一致 → 原样返回，changed = false（不刷新 updatedAt）
 */
export function reconcileBanks(
  current: BanksSection | null | undefined,
  options: ReconcileOptions = {},
): ReconcileResult {
  const seed = options.seed ?? BUILTIN_BANK_SEED;
  const revision = options.revision ?? BUILTIN_SEED_REVISION;
  const now = options.now ?? new Date().toISOString();
  const fingerprint = seedFingerprint(seed);

  // E1：分区缺失 / 结构损坏 / items 为空 → 全量初始化
  if (!current || !Array.isArray(current.items) || current.items.length === 0) {
    return {
      section: {
        schemaVersion: SCHEMA_VERSION,
        updatedAt: now,
        seedRevision: revision,
        seedFingerprint: fingerprint,
        seededAt: now,
        items: createSeedRecords(seed, now),
      },
      changed: true,
    };
  }

  const items = copyRecords(current.items);
  const section: BanksSection = {
    schemaVersion: SCHEMA_VERSION,
    updatedAt: current.updatedAt ?? null,
    seedRevision: current.seedRevision ?? 0,
    seedFingerprint: current.seedFingerprint ?? "",
    seededAt: current.seededAt ?? null,
    items,
  };

  // 版本与指纹都一致 → 不写文件；仅结构版本过旧时才需要落盘归一化
  if (section.seedRevision === revision && section.seedFingerprint === fingerprint) {
    return { section, changed: current.schemaVersion !== SCHEMA_VERSION };
  }

  // E3：升级补种 —— 内置可升级，家长成果免疫
  const byId = new Map(items.map((i) => [i.id, i]));
  const additions: BankRecord[] = [];
  for (const b of seed) {
    const existing = byId.get(b.id);
    if (!existing) {
      const record = createSeedRecords([b], now)[0];
      additions.push(record);
      byId.set(record.id, record);
      continue;
    }
    if (existing.origin !== "builtin" || existing.customized) continue;
    existing.name = b.name;
    existing.emoji = b.emoji;
    existing.chars = [...b.chars];
    existing.updatedAt = now;
  }

  section.items = [...items, ...additions];
  section.seedRevision = revision;
  section.seedFingerprint = fingerprint;
  section.seededAt = section.seededAt ?? now;
  section.updatedAt = now;
  return { section, changed: true };
}

/** 按 id 查找字库 */
export function findBank(items: readonly BankRecord[], id: string): BankRecord | undefined {
  return items.find((b) => b.id === id);
}

/** 取已启用的字库（儿童端只展示这些） */
export function getEnabledBanks(items: readonly BankRecord[]): BankRecord[] {
  return items.filter((b) => b.enabled);
}

/**
 * 合并字库汉字（综合字库用，按 items 顺序去重）
 *
 * enabledOnly 默认 true：停用的字库不应出现在"综合"里
 * （v1 的综合字库无视启停、且不含自定义字库，v2 起统一为"已启用字库的并集"）
 */
export function mergeBankChars(
  items: readonly BankRecord[],
  opts: { enabledOnly?: boolean } = {},
): string[] {
  const enabledOnly = opts.enabledOnly ?? true;
  const merged = new Set<string>();
  for (const bank of items) {
    if (enabledOnly && !bank.enabled) continue;
    for (const c of bank.chars) merged.add(c);
  }
  return [...merged];
}
