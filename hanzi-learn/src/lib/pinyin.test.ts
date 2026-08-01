/**
 * 拼音映射单测
 */
import { describe, it, expect } from "vitest";
import { PINYIN_MAP, getPinyin, getPinyinLine } from "./pinyin";
import { BUILT_IN_BANKS } from "./wordBanks";

describe("getPinyin", () => {
  it("返回汉字拼音", () => {
    expect(getPinyin("小")).toBe("xiǎo");
    expect(getPinyin("猫")).toBe("māo");
  });

  it("未收录返回 undefined", () => {
    expect(getPinyin("龘")).toBeUndefined();
  });
});

describe("getPinyinLine", () => {
  it("拼接拼音，空格分隔", () => {
    expect(getPinyinLine(["小", "猫"])).toBe("xiǎo māo");
  });

  it("未收录的字补空串", () => {
    expect(getPinyinLine(["小", "龘"])).toBe("xiǎo ");
  });
});

describe("PINYIN_MAP 完整性", () => {
  it("字卡打印涉及的所有字库字都有拼音", () => {
    const missing: string[] = [];
    for (const bank of BUILT_IN_BANKS) {
      for (const c of bank.chars) {
        if (!PINYIN_MAP[c]) missing.push(`${bank.id}:${c}`);
      }
    }
    expect(missing).toEqual([]);
  });
});
