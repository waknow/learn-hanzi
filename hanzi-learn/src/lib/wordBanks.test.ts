/**
 * 字库定义单测
 */
import { describe, it, expect } from "vitest";
import { BUILT_IN_BANKS, findBankById, getBuiltInBankIds, getMergedBankChars } from "./wordBanks";

describe("BUILT_IN_BANKS", () => {
  it("至少包含一级、二级两个内置字库", () => {
    const ids = BUILT_IN_BANKS.map((b) => b.id);
    expect(ids).toContain("level1");
    expect(ids).toContain("level2");
  });

  it("字库 id 唯一", () => {
    const ids = BUILT_IN_BANKS.map((b) => b.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("每个字库 chars 无重复字", () => {
    for (const bank of BUILT_IN_BANKS) {
      expect(new Set(bank.chars).size).toBe(bank.chars.length);
    }
  });

  it("level1 至少 60 个基础字", () => {
    const l1 = findBankById("level1");
    expect(l1?.chars.length ?? 0).toBeGreaterThanOrEqual(60);
  });
});

describe("findBankById", () => {
  it("按 id 找到字库", () => {
    expect(findBankById("level1")?.name).toBe("一级");
  });

  it("未知 id 返回 undefined", () => {
    expect(findBankById("nope")).toBeUndefined();
  });
});

describe("getBuiltInBankIds / getMergedBankChars", () => {
  it("返回全部内置 id", () => {
    expect(getBuiltInBankIds()).toEqual(BUILT_IN_BANKS.map((b) => b.id));
  });

  it("合并所有字库的字且去重", () => {
    const merged = getMergedBankChars();
    const union = new Set(BUILT_IN_BANKS.flatMap((b) => b.chars));
    expect(merged.length).toBe(union.size);
    expect(new Set(merged).size).toBe(merged.length);
  });
});
