/**
 * 本地时区日期工具测试
 *
 * 用例全部用「本地时间构造的 Date」，保证在任何时区的测试机上都确定。
 */
import { describe, it, expect } from "vitest";
import { localDateString } from "./date";

describe("localDateString", () => {
  it("返回本地时区的 YYYY-MM-DD（月份从 1 开始）", () => {
    // 2026-08-01 00:30 本地时间
    const d = new Date(2026, 7, 1, 0, 30);
    expect(localDateString(d)).toBe("2026-08-01");
  });

  it("月份与日期补齐前导零", () => {
    const d = new Date(2026, 0, 5, 23, 59);
    expect(localDateString(d)).toBe("2026-01-05");
  });

  it("无参数时使用当前时间", () => {
    const now = new Date();
    expect(localDateString()).toBe(localDateString(now));
  });

  it("跨年日期正确", () => {
    const d = new Date(2025, 11, 31, 12, 0);
    expect(localDateString(d)).toBe("2025-12-31");
  });
});
