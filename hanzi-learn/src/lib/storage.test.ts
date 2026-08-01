/**
 * localStorage 封装单测
 *
 * 防抖推送依赖 500ms 定时器，本文件统一使用 fake timers 避免跨用例泄漏。
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  KEYS,
  loadWeightData,
  saveWeightData,
  loadStats,
  saveStats,
  loadConfig,
  saveConfig,
  flushServerSync,
} from "./storage";
import type { WeightData, StudyStats, ParentConfig } from "./types";

describe("storage localStorage 封装", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
    localStorage.clear();
  });

  it("权重数据写入后可读回", () => {
    const data: WeightData = {
      level1: { round: 1, chars: [{ char: "小", weight: 3, totalUsed: 1, lastUsedRound: 1 }] },
    };
    saveWeightData(data);
    expect(loadWeightData()).toEqual(data);
  });

  it("未写入时返回空对象", () => {
    expect(loadWeightData()).toEqual({});
  });

  it("损坏 JSON 返回默认值而非抛错", () => {
    localStorage.setItem(KEYS.WEIGHT_DATA, "{oops");
    expect(loadWeightData()).toEqual({});
  });

  it("统计默认值", () => {
    const stats = loadStats();
    expect(stats.totalCalls).toBe(0);
    expect(stats.sentenceHistory).toEqual([]);
    expect(stats.charUsage).toEqual({});
  });

  it("家长配置默认值", () => {
    expect(loadConfig().password).toBe("1234");
  });

  it("保存配置后可读回", () => {
    const config: ParentConfig = { password: "8888", enabledBanks: ["level1"], customBanks: [] };
    saveConfig(config);
    expect(loadConfig()).toEqual(config);
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

  it("保存触发 PUT /api/state 推送", async () => {
    const spy = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(new Response("{}", { status: 200 }));
    saveWeightData({ level1: { round: 1, chars: [] } });
    flushServerSync();
    expect(spy).toHaveBeenCalledTimes(1);
    const [url, init] = spy.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("/api/state");
    expect(init.method).toBe("PUT");
    expect(JSON.parse(String(init.body))).toHaveProperty("weightData");
  });

  it("推送失败静默（不抛异常）", () => {
    vi.spyOn(globalThis, "fetch").mockRejectedValue(new Error("network"));
    saveStats({
      totalCalls: 1,
      todayCalls: 1,
      todayDate: "",
      weeklyCalls: 1,
      history: {},
      sentenceHistory: [],
      charUsage: {},
    } as StudyStats);
    expect(() => flushServerSync()).not.toThrow();
  });
});
