/**
 * localStorage 封装单测（v2 三分区镜像 + 本地迁移 + 防抖推送）
 *
 * 防抖推送依赖 500ms 定时器，本文件统一使用 fake timers 避免跨用例泄漏。
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  KEYS,
  hasPendingServerSync,
  loadBanks,
  loadStats,
  loadWeightData,
  loadConfig,
  saveBanks,
  saveConfig,
  saveStats,
  saveWeightData,
  replaceWeightData,
  flushServerSync,
  withSuppressedServerSync,
} from "./storage";
import { SCHEMA_VERSION } from "./schema";
import type { WeightData } from "./types";

const WEIGHT: WeightData = {
  level1: { round: 1, chars: [{ char: "小", weight: 3, totalUsed: 1, lastUsedRound: 1 }] },
};

describe("镜像读写", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
    localStorage.clear();
  });

  it("统计默认值", () => {
    const stats = loadStats();
    expect(stats.totalCalls).toBe(0);
    expect(stats.sentenceHistory).toEqual([]);
    expect(stats.charUsage).toEqual({});
    expect(stats.progress).toEqual({});
  });

  it("配置默认值", () => {
    expect(loadConfig().password).toBe("1234");
  });

  it("保存配置后可读回，未传字段保留", () => {
    saveConfig({ password: "8888" });
    saveConfig({ model: "deepseek-v4-pro" });
    const cfg = loadConfig();
    expect(cfg.password).toBe("8888");
    expect(cfg.model).toBe("deepseek-v4-pro");
    expect(cfg.schemaVersion).toBe(SCHEMA_VERSION);
  });

  it("权重进度存在统计分区里（loadWeightData 是 stats.progress 的视图）", () => {
    saveWeightData(WEIGHT);
    expect(loadWeightData()).toEqual(WEIGHT);
    expect(loadStats().progress).toEqual(WEIGHT);
    expect(localStorage.getItem(KEYS.WEIGHT_DATA)).toBeNull();
  });

  it("saveWeightData({}) 会清空进度", () => {
    saveWeightData(WEIGHT);
    saveWeightData({});
    expect(loadWeightData()).toEqual({});
  });

  it("词库镜像为空时用初始化默认值做本地初始化", () => {
    const banks = loadBanks();
    expect(banks.items.map((i) => i.id)).toEqual(["level1", "level2"]);
    expect(banks.items.every((i) => i.origin === "builtin" && i.enabled)).toBe(true);
    expect(localStorage.getItem(KEYS.BANKS)).not.toBeNull();
  });

  it("保存词库后可读回", () => {
    const banks = loadBanks();
    const items = banks.items.map((b, idx) => (idx === 0 ? { ...b, enabled: false } : b));
    saveStats({ totalCalls: 1 }); // 触发其他分区写入，验证互不干扰
    saveBanks({ items });
    expect(loadBanks().items[0].enabled).toBe(false);
    expect(loadStats().totalCalls).toBe(1);
  });

  it("损坏 JSON 返回默认值而非抛错", () => {
    localStorage.setItem(KEYS.STUDY_STATS, "{oops");
    expect(loadStats().totalCalls).toBe(0);
    localStorage.setItem(KEYS.BANKS, "{oops");
    expect(loadBanks().items.length).toBeGreaterThan(0);
  });
});

describe("v1 本地缓存迁移", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
    localStorage.clear();
  });

  it("customBanks / enabledBanks → 词库分区，旧权重键 → stats.progress，config 瘦身", () => {
    localStorage.setItem(
      KEYS.PARENT_CONFIG,
      JSON.stringify({
        password: "8888",
        model: "deepseek-v4-pro",
        enabledBanks: ["level1", "custom_1"],
        customBanks: [{ id: "custom_1", name: "动物园", emoji: "🐼", chars: ["猫", "狗"] }],
      }),
    );
    localStorage.setItem(KEYS.WEIGHT_DATA, JSON.stringify({ level1: { round: 3, chars: [] } }));

    const banks = loadBanks();
    expect(banks.items.map((i) => i.id)).toEqual(["level1", "level2", "custom_1"]);
    expect(banks.items.find((i) => i.id === "level1")?.enabled).toBe(true);
    expect(banks.items.find((i) => i.id === "level2")?.enabled).toBe(false);
    expect(banks.items.find((i) => i.id === "custom_1")).toMatchObject({
      origin: "custom",
      chars: ["猫", "狗"],
    });

    expect(loadWeightData()).toEqual({ level1: { round: 3, chars: [] } });
    expect(localStorage.getItem(KEYS.WEIGHT_DATA)).toBeNull();

    const cfg = loadConfig();
    expect(cfg.password).toBe("8888");
    expect(cfg.model).toBe("deepseek-v4-pro");
    expect(Object.keys(cfg).sort()).toEqual(["model", "password", "schemaVersion", "updatedAt"]);
  });
});

describe("flushServerSync 防抖推送", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.useFakeTimers();
    // 排空上一组用例可能遗留的模块级待同步块（pendingBlocks），避免跨组泄漏
    vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response("{}", { status: 200 }));
    flushServerSync();
    vi.restoreAllMocks();
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
    localStorage.clear();
  });

  it("无待同步块时静默返回", () => {
    const spy = vi.spyOn(globalThis, "fetch");
    flushServerSync();
    expect(spy).not.toHaveBeenCalled();
  });

  it("保存触发的 PUT 带 stats（含 progress）与 banks 块", async () => {
    const spy = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(new Response("{}", { status: 200 }));
    saveWeightData(WEIGHT);
    saveBanks({ items: [] });
    flushServerSync();

    const [url, init] = spy.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("/api/state");
    expect(init.method).toBe("PUT");
    const body = JSON.parse(String(init.body));
    expect(body.stats.progress).toEqual(WEIGHT);
    expect(body.banks).toBeDefined();
  });

  it("推送失败时把块重新入队（离线改动不被丢弃）", async () => {
    vi.spyOn(globalThis, "fetch").mockRejectedValue(new Error("network"));
    saveStats({ totalCalls: 1 });
    flushServerSync();
    await Promise.resolve();
    await Promise.resolve();
    expect(hasPendingServerSync()).toBe(true);
  });

  it("推送成功后清空待同步队列", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response("{}", { status: 200 }));
    saveStats({ totalCalls: 1 });
    flushServerSync();
    await Promise.resolve();
    await Promise.resolve();
    expect(hasPendingServerSync()).toBe(false);
  });

  it("推送失败不抛异常", () => {
    vi.spyOn(globalThis, "fetch").mockRejectedValue(new Error("network"));
    expect(() => flushServerSync()).not.toThrow();
  });
});

describe("withSuppressedServerSync 抑制回写", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.useFakeTimers();
    vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response("{}", { status: 200 }));
    flushServerSync();
    vi.restoreAllMocks();
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
    localStorage.clear();
  });

  it("抑制期间保存：本地写入成功但不推送服务端", async () => {
    const spy = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(new Response("{}", { status: 200 }));

    withSuppressedServerSync(() => saveWeightData(WEIGHT));
    await vi.advanceTimersByTimeAsync(1000);

    expect(loadWeightData()).toEqual(WEIGHT);
    expect(spy).not.toHaveBeenCalled();
  });

  it("回调抛异常也恢复推送（finally 保证）", async () => {
    const spy = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(new Response("{}", { status: 200 }));

    expect(() =>
      withSuppressedServerSync(() => {
        throw new Error("boom");
      }),
    ).toThrow("boom");

    saveConfig({ password: "1234" });
    await vi.advanceTimersByTimeAsync(1000);

    expect(spy).toHaveBeenCalledTimes(1);
    expect(JSON.parse(String((spy.mock.calls[0] as [string, RequestInit])[1].body))).toHaveProperty(
      "config",
    );
  });
});

describe("replaceWeightData", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.useFakeTimers();
    vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response("{}", { status: 200 }));
    flushServerSync();
    vi.restoreAllMocks();
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
    localStorage.clear();
  });

  it("整体替换时带上 progressMode=replace（否则服务端合并会让重置失效）", () => {
    const spy = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(new Response("{}", { status: 200 }));
    replaceWeightData({});
    flushServerSync();
    const body = JSON.parse(String((spy.mock.calls[0] as [string, RequestInit])[1].body));
    expect(body.progressMode).toBe("replace");
    expect(body.stats.progress).toEqual({});
  });
});
