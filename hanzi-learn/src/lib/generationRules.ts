/**
 * 句子生成的服务端校验链（纯函数，无 Next / 网络依赖）
 *
 * 从 /api/generate 的重试循环里抽出来：原实现把 5 条规则内联在路由里，
 * 既难单测，也容易在改动时漏掉某条。现在路由只负责「调用 → 回传纠错提示 → 重试」，
 * 规则集中在这里并有独立单测覆盖。
 *
 * 设计原则：不依赖模型自评（模型自评会"凑分通过"），全部用可判定的启发式。
 */

import { findExtraChars, findUsedChars, hasSensitiveContent } from "./validator";

/** 最少使用字数：单字输出应走"单字直示/兜底"路径，AI 生成必须 ≥2 字 */
export const MIN_USED_CHARS = 2;

/** 最大用字数：防止模型堆长句，配合"只输出一个结果"规则 */
export const MAX_OUTPUT_CHARS = 12;

/** 校验上下文 */
export interface OutputCheckContext {
  /** 本次允许使用的字 */
  allowedSet: Set<string>;
  /** 允许字串（纠错提示里原样回给模型） */
  allowedChars: string;
  /** 该字库最近展示过的句子（硬拦截重复） */
  recentShown: string[];
  /** 本轮已尝试过的原始输出（检测模型固执重复） */
  attemptedOutputs: string[];
  /** 最少用字数，缺省 MIN_USED_CHARS */
  minUsedChars?: number;
  /** 最大用字数，缺省 MAX_OUTPUT_CHARS */
  maxOutputChars?: number;
}

/** 拒绝原因 */
export type OutputRejectReason =
  "duplicate" | "sensitive" | "extra_chars" | "too_short" | "too_long" | "recent_duplicate";

/** 校验结果：通过时给出正文与用字，拒绝时给出回传给模型的纠错提示 */
export type OutputCheckResult =
  | { ok: true; text: string; usedChars: string[] }
  | { ok: false; reason: OutputRejectReason; feedback: string; detail: string };

/**
 * 剥离模型可能附带的评分后缀（如「小猫【自然程度-9】」）。
 * 这些标签字不在字库里，不剥离会被误判为越界字。
 */
export function stripScoreSuffix(text: string): string {
  const matched = text.match(/【[^】]+】$/);
  return matched ? text.slice(0, matched.index ?? text.length) : text;
}

/** 按顺序执行校验链，返回首个拒绝原因或通过结果 */
export function checkGeneratedOutput(rawText: string, ctx: OutputCheckContext): OutputCheckResult {
  const minUsedChars = ctx.minUsedChars ?? MIN_USED_CHARS;
  const maxOutputChars = ctx.maxOutputChars ?? MAX_OUTPUT_CHARS;

  // 检查0：与本次已尝试输出完全相同（模型固执重复时直接要求换新）
  if (ctx.attemptedOutputs.includes(rawText)) {
    return {
      ok: false,
      reason: "duplicate",
      detail: `检查0 - 重复输出: ❌ 与之前相同`,
      feedback: `“${rawText}”这个内容已经试过了不能通过，请从可用字里换一组完全不同的字，组合成一个新的简单通顺的词或短句。直接输出结果，不要解释、道歉或任何多余文字`,
    };
  }

  // 检查1：敏感词
  if (hasSensitiveContent(rawText)) {
    return {
      ok: false,
      reason: "sensitive",
      detail: "检查1 - 敏感词: ❌ 命中",
      feedback: "输出中包含不适合儿童的内容，请重新输出一个积极健康的。直接输出结果，不要任何解释",
    };
  }

  // 检查2：越界字（基于去掉评分后缀的正文）
  const textBody = stripScoreSuffix(rawText);
  const extraChars = findExtraChars(textBody, ctx.allowedSet);
  if (extraChars.length > 0) {
    return {
      ok: false,
      reason: "extra_chars",
      detail: `检查2 - 越界字: ❌ 发现 ${JSON.stringify(extraChars)}`,
      feedback: `“${extraChars.join("")}”这些字不在可用字里，绝对不允许使用。可用字只有：${ctx.allowedChars}。请从这些字里重新选一组完全不同的字，组合成一个简单通顺的词或短句。直接输出结果，不要解释、道歉或任何多余文字`,
    };
  }

  // 检查3：最少使用字数量（基于正文）
  const usedChars = findUsedChars(textBody, ctx.allowedSet);
  if (usedChars.length < minUsedChars) {
    return {
      ok: false,
      reason: "too_short",
      detail: `检查3 - 最少字数: ❌ 只用 ${usedChars.length} 个字`,
      feedback: `至少使用 ${minUsedChars} 个可用字，请换一组字重新输出。直接输出结果，不要任何解释`,
    };
  }

  // 检查4：最大长度（服务端启发式，防止模型堆长句）
  if (usedChars.length > maxOutputChars) {
    return {
      ok: false,
      reason: "too_long",
      detail: `检查4 - 最大长度: ❌ 用字 ${usedChars.length} 个 > ${maxOutputChars} 个`,
      feedback: `“${textBody}”太长了，请缩短到 ${maxOutputChars} 个字以内，输出一个简短通顺的词或短句。直接输出结果，不要任何解释`,
    };
  }

  // 检查5：与最近生成历史重复（硬拦截，模型无视软约束时兜底）
  const text = textBody.trim();
  if (ctx.recentShown.includes(text)) {
    return {
      ok: false,
      reason: "recent_duplicate",
      detail: `检查5 - 与最近历史重复: ❌ "${text}"`,
      feedback: `“${text}”这个句子最近已经生成过了，请换一个完全不同的词或短句。直接输出结果，不要任何解释`,
    };
  }

  return { ok: true, text, usedChars };
}
