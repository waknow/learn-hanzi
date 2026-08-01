/**
 * 加权引擎单测
 * 覆盖：洗牌完整性、权重更新规则（用→归1 / 未用→+1 上限20）、初始化
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  weightedShuffle,
  updateWeights,
  initCharEntries,
  MAX_WEIGHT,
  INITIAL_WEIGHT,
} from "./weightEngine";
import type { CharEntry } from "./types";

describe("initCharEntries", () => {
  it("从字符数组初始化 CharEntry 列表", () => {
    expect(initCharEntries(["小", "大", "猫"])).toEqual([
      { char: "小", weight: 1, totalUsed: 0, lastUsedRound: 0 },
      { char: "大", weight: 1, totalUsed: 0, lastUsedRound: 0 },
      { char: "猫", weight: 1, totalUsed: 0, lastUsedRound: 0 },
    ]);
  });

  it("空数组返回空列表", () => {
    expect(initCharEntries([])).toEqual([]);
  });
});

describe("weightedShuffle", () => {
  // 洗牌过程有 console.log，测试中静音
  beforeEach(() => {
    vi.spyOn(console, "log").mockImplementation(() => {});
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("返回所有字且无重复（完整排列）", () => {
    const chars = initCharEntries(["小", "大", "猫", "狗", "鸟"]);
    const result = weightedShuffle(chars);
    expect([...result].sort()).toEqual(["小", "大", "猫", "狗", "鸟"].sort());
  });

  it("单字输入直接返回该字", () => {
    expect(weightedShuffle(initCharEntries(["小"]))).toBe("小");
  });

  it("空输入返回空串", () => {
    expect(weightedShuffle([])).toBe("");
  });
});

describe("updateWeights", () => {
  it("用到的字权重归 1 并累计使用次数", () => {
    const chars: CharEntry[] = [
      { char: "小", weight: 5, totalUsed: 2, lastUsedRound: 3 },
      { char: "大", weight: 1, totalUsed: 0, lastUsedRound: 0 },
    ];
    const next = updateWeights(chars, new Set(["小"]), 4);
    expect(next[0]).toEqual({ char: "小", weight: 1, totalUsed: 3, lastUsedRound: 4 });
    // 未用到的字 +1
    expect(next[1]).toEqual({ char: "大", weight: 2, totalUsed: 0, lastUsedRound: 0 });
  });

  it("未用到的字权重 +1 且封顶 MAX_WEIGHT", () => {
    const chars: CharEntry[] = [{ char: "小", weight: MAX_WEIGHT, totalUsed: 0, lastUsedRound: 0 }];
    const next = updateWeights(chars, new Set(), 1);
    expect(next[0].weight).toBe(MAX_WEIGHT);
    expect(MAX_WEIGHT).toBe(20);
    expect(INITIAL_WEIGHT).toBe(1);
  });

  it("不修改原数组（纯函数）", () => {
    const chars = initCharEntries(["小", "大"]);
    updateWeights(chars, new Set(["小"]), 1);
    expect(chars.every((c) => c.weight === INITIAL_WEIGHT)).toBe(true);
  });
});
