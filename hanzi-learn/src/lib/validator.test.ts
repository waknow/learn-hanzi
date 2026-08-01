/**
 * 验证器单测：汉字提取、越界字、用字提取、敏感词
 */
import { describe, it, expect } from "vitest";
import {
  extractChineseChars,
  findExtraChars,
  findUsedChars,
  hasSensitiveContent,
} from "./validator";

describe("extractChineseChars", () => {
  it("提取汉字，忽略标点与英文数字", () => {
    expect(extractChineseChars("小猫！hello, 123")).toEqual(["小", "猫"]);
  });

  it("空串返回空数组", () => {
    expect(extractChineseChars("")).toEqual([]);
  });
});

describe("findExtraChars", () => {
  const allowed = new Set(["小", "猫", "好"]);

  it("找出越界字（去重）", () => {
    expect(findExtraChars("小猫真好", allowed)).toEqual(["真"]);
  });

  it("全部在允许集内返回空数组", () => {
    expect(findExtraChars("小猫", allowed)).toEqual([]);
  });
});

describe("findUsedChars", () => {
  it("返回命中的字（去重）", () => {
    expect(findUsedChars("小猫猫", new Set(["猫", "好"]))).toEqual(["猫"]);
  });
});

describe("hasSensitiveContent", () => {
  it("命中敏感词", () => {
    expect(hasSensitiveContent("他是个坏蛋")).toBe(true);
    expect(hasSensitiveContent("好可怕的地狱")).toBe(true);
    expect(hasSensitiveContent("说讨厌的话")).toBe(true);
  });

  it("单字不误判：高频字单独出现不触发", () => {
    expect(hasSensitiveContent("快乐地跑")).toBe(false);
    expect(hasSensitiveContent("打")).toBe(false);
  });

  it("正常句子不触发", () => {
    expect(hasSensitiveContent("小猫爱吃鱼")).toBe(false);
  });
});
