import { describe, expect, it } from "vitest";

import { DEFAULT_PASSWORD, defaultConfig, emptyStats, hasUserData } from "./stateShape";
import type { BankRecord } from "./types";

/** 默认内置条目（与初始化默认值一致：启用、无禁用字、无 customized） */
function bank(over: Partial<BankRecord> = {}): BankRecord {
  return {
    id: "level1",
    name: "一级",
    emoji: "🏠",
    chars: ["小", "大"],
    origin: "builtin",
    enabled: true,
    ...over,
  };
}

describe("hasUserData", () => {
  it("空数据 / 全默认值 → false", () => {
    expect(hasUserData(null)).toBe(false);
    expect(hasUserData(undefined)).toBe(false);
    expect(hasUserData({})).toBe(false);
    expect(
      hasUserData({ config: defaultConfig(), stats: emptyStats(), banks: { items: [bank()] } }),
    ).toBe(false);
  });

  it("非默认密码 / 手动选过模型 → true", () => {
    expect(hasUserData({ config: { ...defaultConfig(), password: "9999" } })).toBe(true);
    expect(hasUserData({ config: { ...defaultConfig(), model: "deepseek-v4-pro" } })).toBe(true);
    expect(DEFAULT_PASSWORD).not.toBe("9999");
  });

  it("有学习记录 / 权重进度 → true", () => {
    expect(hasUserData({ stats: { ...emptyStats(), totalCalls: 1 } })).toBe(true);
    expect(hasUserData({ stats: { ...emptyStats(), charUsage: { 小: 2 } } })).toBe(true);
  });

  it("自定义字库 / 关掉过字库 → true", () => {
    expect(hasUserData({ banks: { items: [bank({ origin: "custom" })] } })).toBe(true);
    expect(hasUserData({ banks: { items: [bank({ enabled: false })] } })).toBe(true);
  });

  it("内容维护过的字库也算用户数据（禁用过汉字 / 给内置字库补过字）→ true", () => {
    expect(hasUserData({ banks: { items: [bank({ disabledChars: ["小"] })] } })).toBe(true);
    expect(hasUserData({ banks: { items: [bank({ customized: true })] } })).toBe(true);
  });

  it("自定义字库里 customized 不算额外信号（本就是用户数据）", () => {
    expect(hasUserData({ banks: { items: [bank({ origin: "custom", customized: true })] } })).toBe(
      true,
    );
  });
});
