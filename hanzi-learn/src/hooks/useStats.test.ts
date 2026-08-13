/**
 * 学习统计 Hook 测试
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useStats } from "./useStats";

describe("useStats", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
    localStorage.clear();
  });

  it("recordCall 累计总次数与今日次数", () => {
    // 用本地时间构造（2026-08-01 10:00 本地），保证任何时区下日期都是 08-01
    vi.setSystemTime(new Date(2026, 7, 1, 10, 0, 0));
    const { result } = renderHook(() => useStats());
    act(() => result.current.recordCall("小猫", "level1", ["小", "猫"]));
    const stats = result.current.getStats();
    expect(stats.totalCalls).toBe(1);
    expect(stats.todayCalls).toBe(1);
    expect(stats.todayDate).toBe("2026-08-01");
  });

  it("跨天重置今日计数", () => {
    vi.setSystemTime(new Date(2026, 7, 1, 10, 0, 0));
    const { result } = renderHook(() => useStats());
    act(() => result.current.recordCall("小猫", "level1", ["小", "猫"]));
    vi.setSystemTime(new Date(2026, 7, 2, 10, 0, 0));
    act(() => result.current.recordCall("大", "level1", ["大"]));
    const stats = result.current.getStats();
    expect(stats.totalCalls).toBe(2);
    expect(stats.todayCalls).toBe(1);
    expect(stats.todayDate).toBe("2026-08-02");
  });

  it("记录句子历史与汉字使用统计", () => {
    vi.setSystemTime(new Date(2026, 7, 1, 10, 0, 0));
    const { result } = renderHook(() => useStats());
    act(() => result.current.recordCall("小猫", "level1", ["小", "猫"]));
    const stats = result.current.getStats();
    expect(stats.sentenceHistory[0]).toEqual({
      text: "小猫",
      date: "2026-08-01",
      bankId: "level1",
    });
    expect(stats.charUsage["小"]).toBe(1);
    expect(stats.charUsage["猫"]).toBe(1);
  });

  it("resetStats 清空统计", () => {
    vi.setSystemTime(new Date(2026, 7, 1, 10, 0, 0));
    const { result } = renderHook(() => useStats());
    act(() => result.current.recordCall("小猫", "level1", ["小", "猫"]));
    act(() => result.current.resetStats());
    const stats = result.current.getStats();
    expect(stats.totalCalls).toBe(0);
    expect(stats.history).toEqual({});
    expect(stats.charUsage).toEqual({});
  });
});
