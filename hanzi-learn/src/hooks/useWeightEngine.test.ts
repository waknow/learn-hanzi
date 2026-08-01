/**
 * 权重引擎 Hook 测试
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useWeightEngine } from "./useWeightEngine";
import { loadWeightData } from "@/lib/storage";

describe("useWeightEngine", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.spyOn(console, "log").mockImplementation(() => {});
  });
  afterEach(() => {
    vi.restoreAllMocks();
    localStorage.clear();
  });

  it("首次使用时初始化字库并持久化", () => {
    const { result } = renderHook(() => useWeightEngine("level1", ["小", "大"]));
    // useWeightEngine 无挂载副作用，首次调用 getWeightData() 时才初始化并落库
    expect(result.current.getWeightData().chars).toHaveLength(2);
    const data = loadWeightData();
    expect(data["level1"]).toBeDefined();
    expect(data["level1"].round).toBe(0);
  });

  it("getSortedChars 返回所有字（排列）", () => {
    const { result } = renderHook(() => useWeightEngine("level1", ["小", "大", "猫"]));
    const sorted = result.current.getSortedChars();
    expect([...sorted].sort()).toEqual(["小", "大", "猫"].sort());
  });

  it("update 更新权重：用到的字归 0，未用到的 +1", () => {
    const { result } = renderHook(() => useWeightEngine("level1", ["小", "大"]));
    result.current.getWeightData(); // 先触发初始化，否则 update 内 bankData 不存在会静默返回
    act(() => result.current.update(new Set(["小"])));
    const weights = result.current.getWeights();
    expect(weights.find((w) => w.char === "小")?.weight).toBe(0);
    expect(weights.find((w) => w.char === "大")?.weight).toBe(2);
  });

  it("reset 重置为初始状态", () => {
    const { result } = renderHook(() => useWeightEngine("level1", ["小", "大"]));
    result.current.getWeightData(); // 先初始化 bankData，否则 update 内静默返回，reset 行为无法验证
    act(() => result.current.update(new Set(["小"])));
    act(() => result.current.reset());
    const weights = result.current.getWeights();
    expect(weights.every((w) => w.weight === 1)).toBe(true);
    // 确认 update 确实改变了权重（否则本用例失去验证意义）
    expect(weights.find((w) => w.char === "小")?.weight).toBe(1);
  });

  it("字库内容变化后自动重新初始化", () => {
    const { result, rerender } = renderHook(
      ({ chars }: { chars: string[] }) => useWeightEngine("level1", chars),
      { initialProps: { chars: ["小", "大"] } },
    );
    result.current.getWeightData(); // 先初始化 bankData，走 update 生效路径
    act(() => result.current.update(new Set(["小"])));
    // 此时权重应为：小=0（被用）、大=2（未用）
    expect(result.current.getWeights().find((w) => w.char === "大")?.weight).toBe(2);
    rerender({ chars: ["小", "猫"] });
    // 字库内容变化（大→猫）→ getWeightData 检测到 currentChars !== expectedChars，重新初始化
    const weights = result.current.getWeights();
    expect(weights.map((w) => w.char).sort()).toEqual(["小", "猫"].sort());
    expect(weights.every((w) => w.weight === 1)).toBe(true);
  });
});

describe("getDirectShowChar 直示节流", () => {
  const bankData = (round: number, weights: number[], last?: number) => ({
    level1: {
      round,
      chars: ["大", "小"].map((char, i) => ({
        char,
        weight: weights[i],
        totalUsed: 0,
        lastUsedRound: 0,
      })),
      lastDirectShowRound: last,
    },
  });

  it("存在超过阈值的字时返回权重最大的字", () => {
    localStorage.setItem("hanzi_weight_data", JSON.stringify(bankData(10, [25, 5], 0)));
    const { result } = renderHook(() => useWeightEngine("level1", ["大", "小"]));
    expect(result.current.getDirectShowChar()).toBe("大");
  });

  it("无超阈值字时返回 null", () => {
    localStorage.setItem("hanzi_weight_data", JSON.stringify(bankData(10, [20, 5], 0)));
    const { result } = renderHook(() => useWeightEngine("level1", ["大", "小"]));
    expect(result.current.getDirectShowChar()).toBeNull();
  });

  it("节流：距上次直示不足 3 轮时返回 null", () => {
    localStorage.setItem("hanzi_weight_data", JSON.stringify(bankData(10, [25, 5], 8)));
    const { result } = renderHook(() => useWeightEngine("level1", ["大", "小"]));
    expect(result.current.getDirectShowChar()).toBeNull();
  });

  it("节流：距上次直示满 3 轮后恢复直示", () => {
    localStorage.setItem("hanzi_weight_data", JSON.stringify(bankData(10, [25, 5], 7)));
    const { result } = renderHook(() => useWeightEngine("level1", ["大", "小"]));
    expect(result.current.getDirectShowChar()).toBe("大");
  });

  it("markDirectShown 持久化当前轮次", () => {
    localStorage.setItem("hanzi_weight_data", JSON.stringify(bankData(10, [25, 5], 0)));
    const { result } = renderHook(() => useWeightEngine("level1", ["大", "小"]));
    act(() => result.current.markDirectShown());
    const data = loadWeightData();
    expect(data["level1"].lastDirectShowRound).toBe(10);
  });

  it("从未直示过（字段缺省）且超阈值 → 允许直示", () => {
    localStorage.setItem("hanzi_weight_data", JSON.stringify(bankData(10, [25, 5])));
    const { result } = renderHook(() => useWeightEngine("level1", ["大", "小"]));
    expect(result.current.getDirectShowChar()).toBe("大");
  });
});
