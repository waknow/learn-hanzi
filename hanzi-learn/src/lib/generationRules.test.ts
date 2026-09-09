/**
 * 句子生成校验链单测
 *
 * 规则顺序：重复输出 → 敏感词 → 越界字 → 最少字数 → 最大长度 → 最近历史重复
 */
import { describe, it, expect } from "vitest";
import {
  MAX_OUTPUT_CHARS,
  MIN_USED_CHARS,
  checkGeneratedOutput,
  stripScoreSuffix,
  type OutputCheckContext,
} from "./generationRules";

const ALLOWED = "小猫鱼大";

function ctx(patch: Partial<OutputCheckContext> = {}): OutputCheckContext {
  return {
    allowedSet: new Set(ALLOWED.split("")),
    allowedChars: ALLOWED,
    recentShown: [],
    attemptedOutputs: [],
    ...patch,
  };
}

describe("stripScoreSuffix", () => {
  it("剥离末尾【...】评分后缀", () => {
    expect(stripScoreSuffix("小猫【自然程度-9 口语化-9】")).toBe("小猫");
  });

  it("无后缀时原样返回", () => {
    expect(stripScoreSuffix("小猫")).toBe("小猫");
  });

  it("后缀不在末尾时不剥离", () => {
    expect(stripScoreSuffix("【评分】小猫")).toBe("【评分】小猫");
  });
});

describe("checkGeneratedOutput", () => {
  it("全部通过：返回正文与用字（去重）", () => {
    const result = checkGeneratedOutput("小猫猫【自然程度-9】", ctx());
    expect(result).toEqual({ ok: true, text: "小猫猫", usedChars: ["小", "猫"] });
  });

  it("重复输出 → 拒绝并提示换新", () => {
    const result = checkGeneratedOutput("小猫", ctx({ attemptedOutputs: ["小猫"] }));
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.reason).toBe("duplicate");
    expect(result.feedback).toContain("已经试过了");
  });

  it("敏感词 → 拒绝", () => {
    const result = checkGeneratedOutput("小坏蛋猫", ctx());
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.reason).toBe("sensitive");
  });

  it("越界字 → 拒绝并列出越界字与可用字", () => {
    const result = checkGeneratedOutput("小狗", ctx());
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.reason).toBe("extra_chars");
    expect(result.feedback).toContain("狗");
    expect(result.feedback).toContain(ALLOWED);
  });

  it("评分后缀里的标签字不算越界", () => {
    // “自然程度”等标签字不在字库中，剥离后应通过
    expect(checkGeneratedOutput("小猫【自然程度-9】", ctx()).ok).toBe(true);
  });

  it("少于最少字数 → 拒绝", () => {
    const result = checkGeneratedOutput("猫", ctx());
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.reason).toBe("too_short");
    expect(result.feedback).toContain(String(MIN_USED_CHARS));
  });

  it("超过最大字数 → 拒绝", () => {
    // 用字按去重计数，因此需要 MAX_OUTPUT_CHARS 个以上「不同」的字
    const chars = "一二三四五六七八九十小大猫"; // 13 个不同字
    const result = checkGeneratedOutput(chars, {
      allowedSet: new Set(chars.split("")),
      allowedChars: chars,
      recentShown: [],
      attemptedOutputs: [],
    });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.reason).toBe("too_long");
    expect(result.feedback).toContain(String(MAX_OUTPUT_CHARS));
  });

  it("与最近历史重复 → 拒绝", () => {
    const result = checkGeneratedOutput("小猫", ctx({ recentShown: ["小猫"] }));
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.reason).toBe("recent_duplicate");
  });

  it("重复检测优先于其他规则（先判 duplicate）", () => {
    // 同时越界 + 重复时，应报 duplicate（与路由原实现的检查顺序一致）
    const result = checkGeneratedOutput("小狗", ctx({ attemptedOutputs: ["小狗"] }));
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.reason).toBe("duplicate");
  });

  it("支持自定义上下限", () => {
    const result = checkGeneratedOutput("小猫鱼", ctx({ maxOutputChars: 2 }));
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.reason).toBe("too_long");

    expect(checkGeneratedOutput("猫", ctx({ minUsedChars: 1 })).ok).toBe(true);
  });
});
