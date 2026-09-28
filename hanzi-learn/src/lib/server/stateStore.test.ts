// @vitest-environment node
/**
 * 服务端状态存储层单测
 *
 * 覆盖：三分区路径、E1 初始化、E2 迁移（含崩溃自愈）、E3 升级补种、写入合并、损坏/只读降级
 */
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import fs from "fs";
import os from "os";
import path from "path";

import {
  defaultState,
  ensureInitialized,
  getPartPath,
  getStateDir,
  getStateFilePath,
  readBanks,
  readConfig,
  readState,
  readStats,
  writeBanks,
  writeConfig,
  writeState,
  writeStats,
} from "./stateStore";
import { SCHEMA_VERSION, STATE_FILE_NAMES } from "../schema";
import { BUILTIN_BANK_SEED, BUILTIN_SEED_REVISION } from "../seed/builtinBanks";
import { seedFingerprint } from "../banks";

let tmpDir: string;

beforeEach(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "hanzi-store-"));
  vi.stubEnv("STATE_FILE", path.join(tmpDir, "state.json"));
});
afterEach(() => {
  vi.unstubAllEnvs();
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

/** 分区文件绝对路径 */
const part = (name: keyof typeof STATE_FILE_NAMES) => path.join(tmpDir, STATE_FILE_NAMES[name]);
/** 读分区文件原始 JSON */
const readRaw = (name: keyof typeof STATE_FILE_NAMES) =>
  JSON.parse(fs.readFileSync(part(name), "utf-8"));

/** 写一份 v1 单文件（迁移输入） */
function writeLegacy(state: Record<string, unknown>): void {
  fs.writeFileSync(path.join(tmpDir, "state.json"), JSON.stringify(state, null, 2), "utf-8");
}

describe("路径解析", () => {
  it("STATE_FILE 决定状态目录（取其所在目录），分区文件名固定", () => {
    expect(getStateDir()).toBe(tmpDir);
    expect(getStateFilePath()).toBe(path.join(tmpDir, "state.json"));
    expect(getPartPath("config")).toBe(path.join(tmpDir, "config.json"));
    expect(getPartPath("stats")).toBe(path.join(tmpDir, "stats.json"));
    expect(getPartPath("banks")).toBe(path.join(tmpDir, "banks.json"));
  });

  it("STATE_DIR 优先于 STATE_FILE", () => {
    vi.stubEnv("STATE_DIR", path.join(tmpDir, "nested"));
    expect(getStateDir()).toBe(path.join(tmpDir, "nested"));
  });
});

describe("defaultState（内存默认视图，不发 IO）", () => {
  it("三段默认值 + updatedAt 为 null", () => {
    const s = defaultState();
    expect(s.updatedAt).toBeNull();
    expect(s.updatedAtByPart).toEqual({ config: null, stats: null, banks: null });
    expect(s.config.password).toBe("1234");
    expect(s.stats.totalCalls).toBe(0);
    expect(s.stats.progress).toEqual({});
    expect(s.banks.items.map((i) => i.id)).toEqual(BUILTIN_BANK_SEED.map((b) => b.id));
    expect(fs.existsSync(part("banks"))).toBe(false);
  });
});

describe("E1 初始化", () => {
  it("ensureInitialized 写出三份带 schemaVersion 的文件", () => {
    ensureInitialized();

    const config = readRaw("config");
    const stats = readRaw("stats");
    const banks = readRaw("banks");

    expect(config.schemaVersion).toBe(SCHEMA_VERSION);
    expect(config.password).toBe("1234");
    expect(stats.schemaVersion).toBe(SCHEMA_VERSION);
    expect(stats.progress).toEqual({});
    expect(banks.schemaVersion).toBe(SCHEMA_VERSION);
    expect(banks.seedRevision).toBe(BUILTIN_SEED_REVISION);
    expect(banks.seedFingerprint).toBe(seedFingerprint());
    expect(banks.items.map((i: { id: string }) => i.id)).toEqual(
      BUILTIN_BANK_SEED.map((b) => b.id),
    );
    // 内置字库以 origin=builtin、enabled=true 落盘
    expect(
      banks.items.every(
        (i: { origin: string; enabled: boolean }) => i.origin === "builtin" && i.enabled,
      ),
    ).toBe(true);
  });

  it("幂等：重复初始化不重写内容（updatedAt 不变）", () => {
    ensureInitialized();
    const before = readRaw("banks").updatedAt;
    ensureInitialized();
    ensureInitialized();
    expect(readRaw("banks").updatedAt).toBe(before);
  });

  it("只删 banks.json → 读取时自动补回，config/stats 一行不动", () => {
    ensureInitialized();
    const configBefore = fs.readFileSync(part("config"), "utf-8");
    const statsBefore = fs.readFileSync(part("stats"), "utf-8");
    fs.rmSync(part("banks"));

    const banks = readBanks();

    expect(banks.items.length).toBe(BUILTIN_BANK_SEED.length);
    expect(fs.readFileSync(part("config"), "utf-8")).toBe(configBefore);
    expect(fs.readFileSync(part("stats"), "utf-8")).toBe(statsBefore);
  });

  it("readState 聚合三区并给出分区时间戳", () => {
    const s = readState();
    expect(s.schemaVersion).toBe(SCHEMA_VERSION);
    expect(s.config.password).toBe("1234");
    expect(s.stats.totalCalls).toBe(0);
    expect(s.banks.items.length).toBeGreaterThan(0);
    expect(s.updatedAt).not.toBeNull();
    expect(s.updatedAtByPart.banks).not.toBeNull();
    expect(s.updatedAt).toBe(s.updatedAtByPart.banks);
  });
});

describe("写入：局部更新与合并", () => {
  it("标准块写入后可读回，且不影响其他分区", () => {
    writeState({ stats: { totalCalls: 5 } });
    writeState({ config: { password: "6666" } });
    const s = readState();
    expect(s.stats.totalCalls).toBe(5);
    expect(s.config.password).toBe("6666");
    expect(s.banks.items.length).toBe(BUILTIN_BANK_SEED.length);
  });

  it("progress 按 bankId 合并，不互相覆盖", () => {
    writeState({ progress: { level1: { round: 1, chars: [] } } });
    writeState({ progress: { level2: { round: 2, chars: [] } } });
    const s = readState();
    expect(s.stats.progress.level1).toBeDefined();
    expect(s.stats.progress.level2).toBeDefined();
  });

  it("兼容 v1 旧客户端的 weightData 块（映射到 stats.progress）", () => {
    writeState({ weightData: { level1: { round: 7, chars: [] } } });
    expect(readState().stats.progress.level1.round).toBe(7);
  });

  it("stats 内的 progress 与独立 progress 块可叠加", () => {
    writeState({
      stats: { totalCalls: 2, progress: { level1: { round: 1, chars: [] } } },
      progress: { level2: { round: 2, chars: [] } },
    });
    const s = readState();
    expect(s.stats.totalCalls).toBe(2);
    expect(Object.keys(s.stats.progress).sort()).toEqual(["level1", "level2"]);
  });

  it("writeConfig 未传的字段保留现值", () => {
    writeConfig({ password: "8888" });
    writeConfig({ model: "deepseek-v4-pro" });
    const config = readConfig();
    expect(config.password).toBe("8888");
    expect(config.model).toBe("deepseek-v4-pro");
  });

  it("writeStats 只覆盖传入的字段", () => {
    writeStats({ totalCalls: 3, todayDate: "2026-09-28" });
    writeStats({ totalCalls: 4 });
    const stats = readStats();
    expect(stats.totalCalls).toBe(4);
    expect(stats.todayDate).toBe("2026-09-28");
  });

  it("写词库时缺了内置条目会被强制补回（内置字库不可删除）", () => {
    ensureInitialized();
    const banks = readBanks();
    const withoutBuiltin = banks.items.filter((i) => i.origin !== "builtin");
    expect(withoutBuiltin).toHaveLength(0);

    writeBanks({ ...banks, items: withoutBuiltin });
    expect(readBanks().items.map((i) => i.id)).toEqual(BUILTIN_BANK_SEED.map((b) => b.id));
  });

  it("停用的字库（enabled=false）会被保留", () => {
    const banks = readBanks();
    const items = banks.items.map((i, idx) => (idx === 0 ? { ...i, enabled: false } : i));
    writeBanks({ ...banks, items });
    expect(readBanks().items[0].enabled).toBe(false);
  });
});

describe("E3 升级补种（落盘层面）", () => {
  it("seedRevision 被改写后，读取时按默认值修复内置条目", () => {
    ensureInitialized();
    const raw = readRaw("banks");
    raw.seedRevision = 0;
    raw.items[0].name = "被改坏的名字";
    fs.writeFileSync(part("banks"), JSON.stringify(raw), "utf-8");

    const banks = readBanks();
    expect(banks.seedRevision).toBe(BUILTIN_SEED_REVISION);
    expect(banks.items[0].name).toBe(BUILTIN_BANK_SEED[0].name);
    expect(readRaw("banks").items[0].name).toBe(BUILTIN_BANK_SEED[0].name);
  });
});

describe("E2 迁移：v1 单文件 → 三份文件", () => {
  const legacy = {
    weightData: {
      level1: { round: 3, chars: [{ char: "小", weight: 2, totalUsed: 1, lastUsedRound: 3 }] },
    },
    stats: {
      totalCalls: 12,
      todayCalls: 2,
      todayDate: "2026-09-01",
      weeklyCalls: 12,
      history: { "2026-09-01": 2 },
      sentenceHistory: [{ text: "小猫", date: "2026-09-01", bankId: "level1" }],
      charUsage: { 小: 3 },
    },
    config: {
      password: "9999",
      model: "deepseek-v4-pro",
      enabledBanks: ["level2"],
      customBanks: [{ id: "custom_1", name: "动物园", emoji: "🐼", chars: ["猫", "狗"] }],
    },
    updatedAt: "2026-09-01T00:00:00.000Z",
  };

  it("字段映射正确，原文件改名为 .v1.bak", () => {
    writeLegacy(legacy);
    ensureInitialized();

    const config = readRaw("config");
    expect(config.password).toBe("9999");
    expect(config.model).toBe("deepseek-v4-pro");
    expect(config.customBanks).toBeUndefined();

    const stats = readRaw("stats");
    expect(stats.totalCalls).toBe(12);
    expect(stats.sentenceHistory).toHaveLength(1);
    expect(stats.progress.level1.round).toBe(3);
    expect(stats.weightData).toBeUndefined();

    const banks = readRaw("banks");
    const ids = banks.items.map((i: { id: string }) => i.id);
    expect(ids).toEqual([...BUILTIN_BANK_SEED.map((b) => b.id), "custom_1"]);
    expect(banks.items.find((i: { id: string }) => i.id === "custom_1").origin).toBe("custom");
    // enabledBanks = ["level2"] → 只有 level2 启用（自定义字库未在列表里 → 停用）
    expect(
      banks.items.filter((i: { enabled: boolean }) => i.enabled).map((i: { id: string }) => i.id),
    ).toEqual(["level2"]);

    expect(fs.existsSync(path.join(tmpDir, "state.json"))).toBe(false);
    expect(fs.existsSync(path.join(tmpDir, "state.json.v1.bak"))).toBe(true);
  });

  it("enabledBanks 为空数组 = 全部启用", () => {
    writeLegacy({ ...legacy, config: { ...legacy.config, enabledBanks: [] } });
    ensureInitialized();
    expect(readBanks().items.every((i) => i.enabled)).toBe(true);
  });

  it("崩溃自愈：只写了部分 v2 文件时，从 v1 补齐缺失分区且不覆盖已有分区", () => {
    // 模拟迁移中途崩溃：config.json 已写好，stats/banks 还没写
    writeLegacy(legacy);
    fs.writeFileSync(
      part("config"),
      JSON.stringify({
        schemaVersion: SCHEMA_VERSION,
        updatedAt: "2026-01-01T00:00:00.000Z",
        password: "1234",
        model: "",
      }),
      "utf-8",
    );

    ensureInitialized();

    expect(readRaw("config").password).toBe("1234"); // 已有分区不被 v1 覆盖
    expect(readRaw("stats").totalCalls).toBe(12); // 缺失分区从 v1 补齐
    expect(readRaw("banks").items.some((i: { id: string }) => i.id === "custom_1")).toBe(true);
    expect(fs.existsSync(path.join(tmpDir, "state.json.v1.bak"))).toBe(true);
  });

  it("已是 v2 且 v1 残留时，不覆盖 v2 数据，只留备份", () => {
    ensureInitialized();
    writeState({ stats: { totalCalls: 42 } });
    writeLegacy({ config: { password: "0000" }, stats: { totalCalls: 1 } });

    ensureInitialized();

    expect(readState().stats.totalCalls).toBe(42);
    expect(readConfig().password).toBe("1234");
    expect(fs.existsSync(path.join(tmpDir, "state.json.v1.bak"))).toBe(true);
  });

  it("v1 损坏时按默认值初始化，并保留损坏文件（*.corrupt.*）便于排查", () => {
    fs.writeFileSync(path.join(tmpDir, "state.json"), "{broken", "utf-8");
    ensureInitialized();
    expect(readConfig().password).toBe("1234");
    const kept = fs.readdirSync(tmpDir).filter((f) => f.startsWith("state.json"));
    expect(kept.length).toBeGreaterThan(0);
  });
});

describe("损坏与只读降级", () => {
  it("分区文件损坏时返回默认值并隔离损坏文件", () => {
    fs.writeFileSync(part("banks"), "{broken", "utf-8");
    expect(() => readBanks()).not.toThrow();
    expect(readBanks().items.length).toBe(BUILTIN_BANK_SEED.length);
    expect(fs.readdirSync(tmpDir).some((f) => f.startsWith("banks.json.corrupt."))).toBe(true);
  });

  it("状态目录无法创建（只读/非法路径）时不抛异常，返回内存默认值", () => {
    const blocker = path.join(tmpDir, "blocker");
    fs.writeFileSync(blocker, "not a dir", "utf-8");
    vi.stubEnv("STATE_FILE", path.join(blocker, "state.json"));

    expect(() => readState()).not.toThrow();
    const s = readState();
    expect(s.stats.totalCalls).toBe(0);
    expect(s.banks.items.length).toBe(BUILTIN_BANK_SEED.length);
  });
});
