/**
 * 字频分级单测
 */
import { describe, it, expect } from "vitest";
import { getBaseCopies, expandWithFrequency } from "./frequency";

describe("getBaseCopies", () => {
  it("Tier1 印 3 份", () => {
    expect(getBaseCopies("的")).toBe(3);
  });

  it("Tier2 印 2 份", () => {
    expect(getBaseCopies("猫")).toBe(2);
  });

  it("未收录字默认 1 份", () => {
    expect(getBaseCopies("龘")).toBe(1);
  });
});

describe("expandWithFrequency", () => {
  it("按基准份数展开且保序", () => {
    const result = expandWithFrequency(["的", "猫", "龘"], 1);
    expect(result).toHaveLength(6);
    expect(result.filter((c) => c === "的")).toHaveLength(3);
    expect(result.filter((c) => c === "猫")).toHaveLength(2);
  });

  it("系数 0.5 时至少 1 份", () => {
    expect(expandWithFrequency(["龘"], 0.5)).toHaveLength(1);
  });

  it("系数 2.0 翻倍", () => {
    expect(expandWithFrequency(["猫"], 2)).toHaveLength(4);
  });
});
