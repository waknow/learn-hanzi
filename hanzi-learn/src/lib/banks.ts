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

/** 深拷贝条目（chars / disabledChars 也拷贝），避免调用方改动回流到入参/默认值 */
function copyRecords(items: BankRecord[]): BankRecord[] {
  return items.map((i) => {
    const chars = [...i.chars];
    const disabled = normalizeDisabledChars(chars, i.disabledChars);
    return disabled.length > 0
      ? { ...i, chars, disabledChars: disabled }
      : { ...i, chars, disabledChars: undefined };
  });
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

  // 再归一化一次：本次补种可能删掉了原本存在的汉字，disabledChars 里的残留要一并清掉
  section.items = copyRecords([...items, ...additions]);
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
 *
 * ⚠️ 只合并"生效字"：被家长在内容维护页禁用过的汉字不参与合并。
 */
export function mergeBankChars(
  items: readonly BankRecord[],
  opts: { enabledOnly?: boolean } = {},
): string[] {
  const enabledOnly = opts.enabledOnly ?? true;
  const merged = new Set<string>();
  for (const bank of items) {
    if (enabledOnly && !bank.enabled) continue;
    for (const c of getActiveChars(bank)) merged.add(c);
  }
  return [...merged];
}

/* ========== 字库内容维护（添加 / 删除 / 禁用汉字） ==========
 *
 * 这里的规则只在纯函数里写一份，UI（家长设置页 / 内容维护页）与服务端共用：
 * - 生效字 = chars - disabledChars；所有"用字"的地方都必须走 getActiveChars()
 * - 「内置字」= origin 为 builtin 且出现在初始化默认值里的字 → 只能禁用，不能删除
 * - 家长新增到内置字库的字属于"自定义内容"，可以删除（会置 customized 保护，见下）
 * - 至少保留 MIN_ACTIVE_CHARS 个生效字，避免留下一个用不了的空字库
 */

/** 至少保留的生效汉字数（否则字库无法用于生成与打印） */
export const MIN_ACTIVE_CHARS = 1;

/** 单个汉字（CJK 基本区），与 lib/validator.ts 的用字范围一致 */
export function isHanziChar(char: string): boolean {
  return /^[\u4e00-\u9fff]$/.test(char);
}

/** 从任意文本里抽取汉字，去重保序（内容维护页的输入解析用） */
export function extractHanziChars(input: string): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const ch of input) {
    if (!isHanziChar(ch) || seen.has(ch)) continue;
    seen.add(ch);
    out.push(ch);
  }
  return out;
}

/** 归一化禁用列表：只保留仍存在于 chars 中的字，去重保序（吃掉升级补种留下的残留） */
export function normalizeDisabledChars(
  chars: readonly string[],
  disabledChars: readonly string[] | undefined,
): string[] {
  if (!disabledChars || disabledChars.length === 0) return [];
  const present = new Set(chars);
  const seen = new Set<string>();
  const out: string[] = [];
  for (const c of disabledChars) {
    if (!present.has(c) || seen.has(c)) continue;
    seen.add(c);
    out.push(c);
  }
  return out;
}

/** 被家长禁用的汉字（按 chars 顺序） */
export function getDisabledChars(bank: Pick<BankRecord, "chars" | "disabledChars">): string[] {
  const disabled = new Set(normalizeDisabledChars(bank.chars, bank.disabledChars));
  return bank.chars.filter((c) => disabled.has(c));
}

/**
 * 字库的"生效汉字"：chars 去掉被禁用的字，保持原顺序
 *
 * ⚠️ 儿童端生成、打印、字库选择页与"综合"合并都必须用它，不能用 bank.chars
 */
export function getActiveChars(bank: Pick<BankRecord, "chars" | "disabledChars">): string[] {
  const disabled = new Set(normalizeDisabledChars(bank.chars, bank.disabledChars));
  return bank.chars.filter((c) => !disabled.has(c));
}

/** 初始化默认值里某个字库的内置汉字集合（非内置 id 返回空集合） */
export function getBuiltinCharSet(
  bankId: string,
  seed: WordBank[] = BUILTIN_BANK_SEED,
): Set<string> {
  const bank = seed.find((b) => b.id === bankId);
  return new Set(bank ? bank.chars : []);
}

/**
 * 是否"内置字"：仅内置字库中来自初始化默认值的字
 *
 * 内置字只能禁用、不能删除；家长后续新增的字可以删除。
 * （seed 中不存在的自定义字库 → 全部可删除）
 */
export function isBuiltinChar(
  bank: BankRecord,
  char: string,
  seed: WordBank[] = BUILTIN_BANK_SEED,
): boolean {
  if (bank.origin !== "builtin") return false;
  return getBuiltinCharSet(bank.id, seed).has(char);
}

/** 内容维护操作的结果：新条目 + 本次实际发生的改动（UI 用于给家长反馈） */
export interface BankContentResult {
  bank: BankRecord;
  changed: boolean;
  /** 本次新增的汉字 */
  added: string[];
  /** 本次被删除的汉字 */
  removed: string[];
  /** 本次被重新启用（原为禁用）的汉字 */
  restored: string[];
  /** 因"内置字不可删除"被拒绝的汉字 */
  rejected: string[];
  /** 本次启用状态发生切换（启用↔禁用）的汉字 */
  toggled: string[];
}

function contentResult(
  bank: BankRecord,
  patch: Partial<Omit<BankContentResult, "bank" | "changed">> = {},
): BankContentResult {
  const added = patch.added ?? [];
  const removed = patch.removed ?? [];
  const restored = patch.restored ?? [];
  const toggled = patch.toggled ?? [];
  return {
    bank,
    changed: added.length > 0 || removed.length > 0 || restored.length > 0 || toggled.length > 0,
    added,
    removed,
    restored,
    rejected: patch.rejected ?? [],
    toggled,
  };
}

/** 内容被家长改动后的落盘时间戳 */
function touch(bank: BankRecord, now: string): BankRecord {
  return { ...bank, updatedAt: now };
}

/**
 * 添加汉字到字库（去重；已在字库中但被禁用的字会被重新启用）
 *
 * - 家长往**内置字库**里添加新字 → 置 customized，避免升级补种把新增内容冲掉
 *   （见 reconcileBanks：内置且未被改过的条目会被 seed 覆盖）
 * - 只接受 CJK 基本区汉字，其余字符静默忽略
 */
export function addBankChars(
  bank: BankRecord,
  input: string | readonly string[],
  now: string = new Date().toISOString(),
): BankContentResult {
  const candidates = extractHanziChars(typeof input === "string" ? input : input.join(""));
  const existing = new Set(bank.chars);
  const added = candidates.filter((c) => !existing.has(c));

  const disabled = new Set(getDisabledChars(bank));
  const restored = candidates.filter((c) => existing.has(c) && disabled.has(c));

  if (added.length === 0 && restored.length === 0) {
    return contentResult(bank);
  }

  const nextDisabled = normalizeDisabledChars(bank.chars, bank.disabledChars).filter(
    (c) => !restored.includes(c),
  );
  const next: BankRecord = {
    ...touch(bank, now),
    chars: added.length > 0 ? [...bank.chars, ...added] : [...bank.chars],
    disabledChars: nextDisabled.length > 0 ? nextDisabled : undefined,
  };
  // 内置字库一旦被家长补充了内容，升级补种就不能再整体覆盖它
  if (added.length > 0 && bank.origin === "builtin") next.customized = true;

  return contentResult(next, { added, restored });
}

/**
 * 从字库删除汉字
 *
 * ⚠️ 内置字不可删除（记入 rejected），家长新增的字与自定义字库可以删除。
 * 至少保留 MIN_ACTIVE_CHARS 个生效字，否则整批删除都不生效。
 */
export function removeBankChars(
  bank: BankRecord,
  chars: readonly string[],
  now: string = new Date().toISOString(),
): BankContentResult {
  const targets = [...new Set(chars)];
  const present = new Set(bank.chars);
  const deletable = targets.filter((c) => present.has(c) && !isBuiltinChar(bank, c));
  const rejected = targets.filter((c) => present.has(c) && isBuiltinChar(bank, c));

  if (deletable.length === 0) return contentResult(bank, { rejected });

  const removeSet = new Set(deletable);
  const nextChars = bank.chars.filter((c) => !removeSet.has(c));
  const nextDisabled = getDisabledChars(bank).filter((c) => !removeSet.has(c));

  // 删除后一个字都不剩 → 拒绝（应改为删除整个字库）
  if (nextChars.length - nextDisabled.length < MIN_ACTIVE_CHARS) {
    return contentResult(bank, { rejected });
  }

  const next: BankRecord = {
    ...touch(bank, now),
    chars: nextChars,
    disabledChars: nextDisabled.length > 0 ? nextDisabled : undefined,
  };
  return contentResult(next, { removed: deletable, rejected });
}

/**
 * 批量启用 / 禁用汉字（禁用 = 从生效字里摘掉，字仍在字库中）
 *
 * 至少保留 MIN_ACTIVE_CHARS 个生效字：禁用最后一个生效字时整批操作不生效。
 */
export function setBankCharsEnabled(
  bank: BankRecord,
  chars: readonly string[],
  enabled: boolean,
  now: string = new Date().toISOString(),
): BankContentResult {
  const targets = new Set(chars);
  const present = bank.chars.filter((c) => targets.has(c));
  const disabledNow = new Set(getDisabledChars(bank));

  const toggled = enabled
    ? present.filter((c) => disabledNow.has(c))
    : present.filter((c) => !disabledNow.has(c));

  if (toggled.length === 0) return contentResult(bank);

  const changeSet = new Set(toggled);
  const nextDisabled = enabled
    ? bank.chars.filter((c) => disabledNow.has(c) && !changeSet.has(c))
    : [...new Set(bank.chars.filter((c) => disabledNow.has(c) || changeSet.has(c)))];

  if (bank.chars.length - nextDisabled.length < MIN_ACTIVE_CHARS) {
    return contentResult(bank);
  }

  const next: BankRecord = {
    ...touch(bank, now),
    disabledChars: nextDisabled.length > 0 ? nextDisabled : undefined,
  };
  return contentResult(next, { toggled });
}
