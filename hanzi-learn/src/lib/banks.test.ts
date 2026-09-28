import { describe, expect, it } from "vitest";

import {
  addBankChars,
  applyEnabledBanks,
  createBanksSection,
  createMigratedBankRecords,
  createSeedRecords,
  extractHanziChars,
  findBank,
  getActiveChars,
  getBuiltinCharSet,
  getDisabledChars,
  getEnabledBanks,
  isBuiltinChar,
  isHanziChar,
  mergeBankChars,
  reconcileBanks,
  removeBankChars,
  seedFingerprint,
  setBankCharsEnabled,
} from "./banks";
import { BUILTIN_BANK_SEED, BUILTIN_SEED_REVISION } from "./seed/builtinBanks";
import { SCHEMA_VERSION } from "./schema";
import type { BankRecord, BanksSection, WordBank } from "./types";

/** 测试用最小默认值（不依赖真实内置字库内容，避免改字库导致测试连带失败） */
const SEED_V1: WordBank[] = [{ id: "level1", name: "一级", emoji: "🏠", chars: ["小", "大"] }];
const SEED_V2: WordBank[] = [
  { id: "level1", name: "一级改", emoji: "🏡", chars: ["小", "大", "了"] },
  { id: "level3", name: "三级", emoji: "🚀", chars: ["车"] },
];

const NOW = "2026-09-28T00:00:00.000Z";
const LATER = "2026-09-29T00:00:00.000Z";

/** 构造一个已初始化的分区（基于 SEED_V1） */
function seeded(): BanksSection {
  return reconcileBanks(null, { seed: SEED_V1, revision: 1, now: NOW }).section;
}

describe("seedFingerprint", () => {
  it("同样内容得到相同指纹，且为 8 位十六进制", () => {
    const a = seedFingerprint(SEED_V1);
    expect(a).toBe(seedFingerprint(SEED_V1));
    expect(a).toMatch(/^[0-9a-f]{8}$/);
  });

  it("内容变化（多一个字 / 改名字 / 改 emoji）都会改变指纹", () => {
    const base = seedFingerprint(SEED_V1);
    expect(seedFingerprint([{ ...SEED_V1[0], chars: ["小", "大", "了"] }])).not.toBe(base);
    expect(seedFingerprint([{ ...SEED_V1[0], name: "一级改" }])).not.toBe(base);
    expect(seedFingerprint([{ ...SEED_V1[0], emoji: "🏡" }])).not.toBe(base);
  });

  it("真实内置默认值也有稳定指纹", () => {
    expect(seedFingerprint()).toBe(seedFingerprint(BUILTIN_BANK_SEED));
    expect(BUILTIN_BANK_SEED.length).toBeGreaterThan(0);
  });
});

describe("内置默认值（seed 数据）", () => {
  it("字库 id 唯一且含 level1 / level2", () => {
    const ids = BUILTIN_BANK_SEED.map((b) => b.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids).toEqual(["level1", "level2"]);
  });

  it("每个字库都有名称、图标与不重复的汉字，且都是汉字", () => {
    for (const bank of BUILTIN_BANK_SEED) {
      expect(bank.name.length).toBeGreaterThan(0);
      expect(bank.emoji.length).toBeGreaterThan(0);
      expect(bank.chars.length).toBeGreaterThan(0);
      expect(new Set(bank.chars).size).toBe(bank.chars.length);
      for (const char of bank.chars) {
        expect(char).toMatch(/^[\u4e00-\u9fff]$/);
      }
    }
  });

  it("默认版本号为正整数", () => {
    expect(BUILTIN_SEED_REVISION).toBeGreaterThan(0);
  });
});

describe("createSeedRecords", () => {
  it("默认值转成 origin=builtin 且 enabled 的条目", () => {
    const records = createSeedRecords(SEED_V1, NOW);
    expect(records).toHaveLength(1);
    expect(records[0]).toMatchObject({
      id: "level1",
      name: "一级",
      emoji: "🏠",
      origin: "builtin",
      enabled: true,
      createdAt: NOW,
      updatedAt: NOW,
    });
  });

  it("chars 是拷贝：改动返回值不会污染默认值", () => {
    const records = createSeedRecords(SEED_V1, NOW);
    records[0].chars.push("坏");
    expect(SEED_V1[0].chars).toEqual(["小", "大"]);
  });
});

describe("createBanksSection", () => {
  it("带上结构版本、种子版本、指纹与初始化时间", () => {
    const section = createBanksSection(NOW);
    expect(section.schemaVersion).toBe(SCHEMA_VERSION);
    expect(section.seedRevision).toBe(BUILTIN_SEED_REVISION);
    expect(section.seedFingerprint).toBe(seedFingerprint());
    expect(section.seededAt).toBe(NOW);
    expect(section.updatedAt).toBe(NOW);
    // 真实内置默认值：目前是 level1 + level2
    expect(section.items.map((i) => i.id)).toEqual(BUILTIN_BANK_SEED.map((b) => b.id));
  });
});

describe("reconcileBanks —— E1 初始化", () => {
  it("分区缺失 → 全量写入默认值", () => {
    const { section, changed } = reconcileBanks(undefined, {
      seed: SEED_V1,
      revision: 1,
      now: NOW,
    });
    expect(changed).toBe(true);
    expect(section.items.map((i) => i.id)).toEqual(["level1"]);
    expect(section.seedRevision).toBe(1);
    expect(section.seededAt).toBe(NOW);
  });

  it("items 为空数组 → 同样全量写入", () => {
    const empty: BanksSection = {
      schemaVersion: SCHEMA_VERSION,
      updatedAt: NOW,
      seedRevision: 0,
      seedFingerprint: "",
      seededAt: null,
      items: [],
    };
    const { section, changed } = reconcileBanks(empty, { seed: SEED_V1, revision: 1, now: NOW });
    expect(changed).toBe(true);
    expect(section.items).toHaveLength(1);
  });
});

describe("reconcileBanks —— 幂等（无变化不写文件）", () => {
  it("版本与指纹一致时 changed=false，且 updatedAt 保持不动", () => {
    const first = seeded();
    const { section, changed } = reconcileBanks(first, {
      seed: SEED_V1,
      revision: 1,
      now: LATER,
    });
    expect(changed).toBe(false);
    expect(section.updatedAt).toBe(NOW);
    expect(section.items).toEqual(first.items);
  });

  it("返回的是拷贝，改结果不会污染入参", () => {
    const first = seeded();
    const { section } = reconcileBanks(first, { seed: SEED_V1, revision: 1, now: LATER });
    section.items[0].chars.push("坏");
    expect(first.items[0].chars).toEqual(["小", "大"]);
  });

  it("结构版本过旧时即使内容一致也要落盘归一化（但不动 updatedAt）", () => {
    const legacy = { ...seeded(), schemaVersion: 1 };
    const { section, changed } = reconcileBanks(legacy, {
      seed: SEED_V1,
      revision: 1,
      now: LATER,
    });
    expect(changed).toBe(true);
    expect(section.schemaVersion).toBe(SCHEMA_VERSION);
    expect(section.updatedAt).toBe(NOW);
  });
});

describe("reconcileBanks —— E3 升级补种", () => {
  it("seedRevision 变化 → 更新内置条目内容并追加新字库", () => {
    const { section, changed } = reconcileBanks(seeded(), {
      seed: SEED_V2,
      revision: 2,
      now: LATER,
    });
    expect(changed).toBe(true);
    expect(section.items.map((i) => i.id)).toEqual(["level1", "level3"]);
    expect(section.items[0]).toMatchObject({
      name: "一级改",
      emoji: "🏡",
      chars: ["小", "大", "了"],
      origin: "builtin",
      updatedAt: LATER,
    });
    expect(section.seedRevision).toBe(2);
    expect(section.updatedAt).toBe(LATER);
  });

  it("revision 不变但内容变了（指纹变化）→ 同样触发升级（防忘记改版本号）", () => {
    const { section, changed } = reconcileBanks(seeded(), {
      seed: SEED_V2,
      revision: 1,
      now: LATER,
    });
    expect(changed).toBe(true);
    expect(section.items[0].name).toBe("一级改");
  });

  it("升级保留原有启停状态与 seededAt", () => {
    const first = seeded();
    first.items[0].enabled = false;
    const { section } = reconcileBanks(first, { seed: SEED_V2, revision: 2, now: LATER });
    expect(section.items[0].enabled).toBe(false);
    expect(section.seededAt).toBe(NOW);
  });

  it("自定义字库（origin=custom）永不被同 id 的内置默认值覆盖", () => {
    const first = seeded();
    first.items.push({
      id: "level1x",
      name: "家长版",
      emoji: "⭐",
      chars: ["猫"],
      origin: "custom",
      enabled: true,
    });
    const customSeed: WordBank[] = [{ id: "level1x", name: "官方版", emoji: "🏠", chars: ["狗"] }];
    const { section } = reconcileBanks(first, { seed: customSeed, revision: 9, now: LATER });
    const item = section.items.find((i) => i.id === "level1x");
    expect(item).toMatchObject({ name: "家长版", chars: ["猫"], origin: "custom" });
  });

  it("被家长改过的内置条目（customized）同样不被覆盖", () => {
    const first = seeded();
    first.items[0].customized = true;
    first.items[0].name = "我的改动";
    const { section } = reconcileBanks(first, { seed: SEED_V2, revision: 2, now: LATER });
    expect(section.items[0].name).toBe("我的改动");
    // 版本号仍要推进，否则每次启动都会重复比对
    expect(section.seedRevision).toBe(2);
  });

  it("默认值里没有的条目（非内置）原样保留", () => {
    const first = seeded();
    first.items.push({
      id: "custom_1",
      name: "动物园",
      emoji: "🐼",
      chars: ["猫", "狗"],
      origin: "custom",
      enabled: false,
    });
    const { section } = reconcileBanks(first, { seed: SEED_V2, revision: 2, now: LATER });
    expect(section.items.find((i) => i.id === "custom_1")).toMatchObject({
      name: "动物园",
      enabled: false,
    });
  });
});

describe("createMigratedBankRecords —— E2 迁移", () => {
  const custom: WordBank[] = [{ id: "custom_1", name: "动物园", emoji: "🐼", chars: ["猫", "狗"] }];

  it("内置 + 自定义都在，enabledBanks 为空数组 = 全部启用", () => {
    const records = createMigratedBankRecords(custom, [], NOW, SEED_V1);
    expect(records.map((r) => r.id)).toEqual(["level1", "custom_1"]);
    expect(records.every((r) => r.enabled)).toBe(true);
    expect(records.find((r) => r.id === "custom_1")?.origin).toBe("custom");
  });

  it("enabledBanks 非空时按 id 精确设置启停", () => {
    const records = createMigratedBankRecords(custom, ["level1"], NOW, SEED_V1);
    expect(records.find((r) => r.id === "level1")?.enabled).toBe(true);
    expect(records.find((r) => r.id === "custom_1")?.enabled).toBe(false);
  });

  it("自定义字库的 chars 是拷贝", () => {
    const records = createMigratedBankRecords(custom, [], NOW, SEED_V1);
    records[1].chars.push("坏");
    expect(custom[0].chars).toEqual(["猫", "狗"]);
  });
});

describe("applyEnabledBanks", () => {
  it("纯函数：不改入参", () => {
    const input = createSeedRecords(SEED_V1, NOW);
    const out = applyEnabledBanks(input, ["other"]);
    expect(input[0].enabled).toBe(true);
    expect(out[0].enabled).toBe(false);
  });
});

describe("findBank / getEnabledBanks / mergeBankChars", () => {
  const items: BankRecord[] = [
    { id: "a", name: "甲", emoji: "1", chars: ["小", "大"], origin: "builtin", enabled: true },
    { id: "b", name: "乙", emoji: "2", chars: ["大", "了"], origin: "custom", enabled: false },
    { id: "c", name: "丙", emoji: "3", chars: ["车"], origin: "custom", enabled: true },
  ];

  it("findBank 命中与未命中", () => {
    expect(findBank(items, "b")?.name).toBe("乙");
    expect(findBank(items, "nope")).toBeUndefined();
  });

  it("getEnabledBanks 只返回启用的", () => {
    expect(getEnabledBanks(items).map((b) => b.id)).toEqual(["a", "c"]);
  });

  it("mergeBankChars 默认只合并已启用字库并去重保序", () => {
    expect(mergeBankChars(items)).toEqual(["小", "大", "车"]);
  });

  it("mergeBankChars 可显式合并全部字库", () => {
    expect(mergeBankChars(items, { enabledOnly: false })).toEqual(["小", "大", "了", "车"]);
  });

  it("空列表返回空数组", () => {
    expect(mergeBankChars([])).toEqual([]);
    expect(getEnabledBanks([])).toEqual([]);
  });

  it("mergeBankChars 不合并被家长禁用的字", () => {
    const withDisabled: BankRecord[] = [
      {
        id: "a",
        name: "甲",
        emoji: "1",
        chars: ["小", "大"],
        origin: "builtin",
        enabled: true,
        disabledChars: ["大"],
      },
      { id: "b", name: "乙", emoji: "2", chars: ["大", "了"], origin: "custom", enabled: true },
    ];
    expect(mergeBankChars(withDisabled)).toEqual(["小", "大", "了"]);
    expect(mergeBankChars(withDisabled, { enabledOnly: false })).toEqual(["小", "大", "了"]);
  });
});

/* ========== 字库内容维护（添加 / 删除 / 禁用汉字） ========== */

/** 构造一个内容维护用的条目（默认是内置 level1：小 大 了） */
function contentBank(over: Partial<BankRecord> = {}): BankRecord {
  return {
    id: "level1",
    name: "一级",
    emoji: "🏠",
    chars: ["小", "大", "了"],
    origin: "builtin",
    enabled: true,
    ...over,
  };
}

describe("汉字识别与抽取", () => {
  it("isHanziChar 只认 CJK 基本区汉字", () => {
    expect(isHanziChar("小")).toBe(true);
    expect(isHanziChar("a")).toBe(false);
    expect(isHanziChar("🐼")).toBe(false);
    expect(isHanziChar("")).toBe(false);
  });

  it("extractHanziChars 去重保序并丢弃非汉字", () => {
    expect(extractHanziChars("熊猫panda🐼 熊")).toEqual(["熊", "猫"]);
    expect(extractHanziChars("")).toEqual([]);
  });
});

describe("生效字 / 禁用字", () => {
  it("getActiveChars 排除禁用字并保持原顺序", () => {
    expect(getActiveChars(contentBank({ disabledChars: ["大"] }))).toEqual(["小", "了"]);
    expect(getActiveChars(contentBank())).toEqual(["小", "大", "了"]);
  });

  it("getDisabledChars 归一化：去重、按 chars 顺序、丢弃已不存在的残留", () => {
    expect(getDisabledChars(contentBank({ disabledChars: ["大", "大", "坏"] }))).toEqual(["大"]);
    expect(
      getDisabledChars(contentBank({ chars: ["小", "大", "了"], disabledChars: ["了", "小"] })),
    ).toEqual(["小", "了"]);
    expect(getDisabledChars(contentBank())).toEqual([]);
  });
});

describe("内置字判定（不可删除）", () => {
  it("内置字库里来自默认值的字 = 内置字；家长新增的字不是", () => {
    const record = { ...contentBank(), chars: ["小", "熊"] };
    expect(isBuiltinChar(record, "小", SEED_V1)).toBe(true);
    expect(isBuiltinChar(record, "熊", SEED_V1)).toBe(false);
  });

  it("自定义字库里的字一律不是内置字（即便 id 与内置相同）", () => {
    const custom = contentBank({ origin: "custom", chars: ["小"] });
    expect(isBuiltinChar(custom, "小", SEED_V1)).toBe(false);
  });

  it("getBuiltinCharSet 未知 id 返回空集合", () => {
    expect(getBuiltinCharSet("nope", SEED_V1).size).toBe(0);
    expect([...getBuiltinCharSet("level1", SEED_V1)]).toEqual(["小", "大"]);
  });
});

describe("addBankChars", () => {
  it("追加新字：去重、按输入顺序、未变化时返回原条目", () => {
    const source = contentBank();
    const result = addBankChars(source, "熊猫", NOW);
    expect(result.added).toEqual(["熊", "猫"]);
    expect(result.bank.chars).toEqual(["小", "大", "了", "熊", "猫"]);
    expect(result.bank.updatedAt).toBe(NOW);

    const noop = addBankChars(source, "小", NOW);
    expect(noop.changed).toBe(false);
    expect(noop.bank).toBe(source);
  });

  it("往内置字库加字 → 置 customized（否则升级补种会冲掉新增内容）", () => {
    expect(addBankChars(contentBank(), "熊", NOW).bank.customized).toBe(true);
    expect(addBankChars(contentBank({ origin: "custom" }), "熊", NOW).bank.customized).toBe(
      undefined,
    );
  });

  it("已在字库但被禁用的字 → 重新启用，不再重复追加", () => {
    const result = addBankChars(contentBank({ disabledChars: ["大"] }), "大", NOW);
    expect(result.added).toEqual([]);
    expect(result.restored).toEqual(["大"]);
    expect(result.changed).toBe(true);
    expect(result.bank.chars).toEqual(["小", "大", "了"]);
    expect(result.bank.disabledChars).toBeUndefined();
  });

  it("纯函数：不改入参", () => {
    const source = contentBank();
    addBankChars(source, "熊", NOW);
    expect(source.chars).toEqual(["小", "大", "了"]);
  });
});

describe("removeBankChars", () => {
  it("内置字不可删除：拒绝且不改变条目", () => {
    const source = contentBank();
    const result = removeBankChars(source, ["小"], NOW);
    expect(result.changed).toBe(false);
    expect(result.rejected).toEqual(["小"]);
    expect(result.bank.chars).toEqual(["小", "大", "了"]);
  });

  it("家长新增到内置字库的字可以删除", () => {
    const source = contentBank({ chars: ["小", "大", "了", "熊", "猫"], customized: true });
    const result = removeBankChars(source, ["熊"], NOW);
    expect(result.removed).toEqual(["熊"]);
    expect(result.bank.chars).toEqual(["小", "大", "了", "猫"]);
    expect(result.bank.updatedAt).toBe(NOW);
  });

  it("自定义字库的字可以删除，并同步清理 disabledChars 残留", () => {
    const source = contentBank({
      origin: "custom",
      chars: ["猫", "狗", "鸟"],
      disabledChars: ["狗"],
    });
    const result = removeBankChars(source, ["狗", "不存在"], NOW);
    expect(result.removed).toEqual(["狗"]);
    expect(result.bank.chars).toEqual(["猫", "鸟"]);
    expect(result.bank.disabledChars).toBeUndefined();
  });

  it("删到零个生效字 → 整批拒绝（应改用删除整个字库）", () => {
    const source = contentBank({ origin: "custom", chars: ["猫"] });
    const result = removeBankChars(source, ["猫"], NOW);
    expect(result.changed).toBe(false);
    expect(result.bank.chars).toEqual(["猫"]);
  });
});

describe("setBankCharsEnabled", () => {
  it("禁用 → 写入 disabledChars；启用 → 移除", () => {
    const off = setBankCharsEnabled(contentBank(), ["大"], false, NOW);
    expect(off.toggled).toEqual(["大"]);
    expect(off.bank.disabledChars).toEqual(["大"]);
    expect(off.bank.updatedAt).toBe(NOW);

    const on = setBankCharsEnabled(off.bank, ["大"], true, LATER);
    expect(on.toggled).toEqual(["大"]);
    expect(on.bank.disabledChars).toBeUndefined();
  });

  it("不能禁用最后一个生效字", () => {
    const source = contentBank({ chars: ["小"] });
    const result = setBankCharsEnabled(source, ["小"], false, NOW);
    expect(result.changed).toBe(false);
    expect(result.bank.disabledChars).toBeUndefined();
  });

  it("对不存在或状态已一致的字是无操作", () => {
    expect(setBankCharsEnabled(contentBank(), ["不存在"], false, NOW).changed).toBe(false);
    const alreadyOff = contentBank({ disabledChars: ["大"] });
    expect(setBankCharsEnabled(alreadyOff, ["大"], false, NOW).changed).toBe(false);
  });

  it("纯函数：不改入参", () => {
    const source = contentBank();
    setBankCharsEnabled(source, ["大"], false, NOW);
    expect(source.disabledChars).toBeUndefined();
  });
});

describe("reconcileBanks 与内容维护共存", () => {
  it("升级补种保留家长禁用的字（disabledChars 不丢）", () => {
    const first = seeded();
    first.items[0].disabledChars = ["大"];
    const { section } = reconcileBanks(first, { seed: SEED_V2, revision: 2, now: LATER });
    expect(section.items[0].chars).toEqual(["小", "大", "了"]);
    expect(section.items[0].disabledChars).toEqual(["大"]);
  });

  it("幂等读取时 disabledChars 是深拷贝，改结果不污染入参", () => {
    const first = seeded();
    first.items[0].disabledChars = ["大"];
    const { section } = reconcileBanks(first, { seed: SEED_V1, revision: 1, now: LATER });
    section.items[0].disabledChars?.push("小");
    expect(first.items[0].disabledChars).toEqual(["大"]);
  });
});
