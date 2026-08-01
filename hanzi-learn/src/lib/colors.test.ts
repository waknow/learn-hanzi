/**
 * 染色系统单测
 */
import { describe, it, expect } from "vitest";
import { getCharColor } from "./colors";

describe("getCharColor", () => {
  it("返回唯一字符对应的配色", () => {
    const c = getCharColor("小", ["小", "大"]);
    expect(c.bg).toBeTruthy();
    expect(c.fg).toBeTruthy();
  });

  it("未收录的字符返回默认黑白色", () => {
    expect(getCharColor("龘", ["小"])).toEqual({ bg: "#FFFFFF", fg: "#000000" });
  });

  it("超过 24 个字符后循环复用调色板", () => {
    const many = Array.from({ length: 30 }, (_, i) => `字${i}`);
    expect(getCharColor("字24", many)).toEqual(getCharColor("字0", many));
  });

  it("不同索引分配不同配色", () => {
    const many = Array.from({ length: 24 }, (_, i) => `字${i}`);
    expect(getCharColor("字1", many)).not.toEqual(getCharColor("字0", many));
  });
});
