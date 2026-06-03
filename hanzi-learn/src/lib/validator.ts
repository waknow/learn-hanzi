/**
 * 验证器：越界字检查 + 敏感词过滤
 * 前后端共用
 */

/** 提取文本中的汉字字符 */
export function extractChineseChars(text: string): string[] {
  return [...text].filter((c) => /[\u4e00-\u9fff]/.test(c));
}

/** 找出文本中超出的字（不在 allowedSet 中的汉字） */
export function findExtraChars(
  text: string,
  allowedSet: Set<string>
): string[] {
  const chars = extractChineseChars(text);
  return [...new Set(chars.filter((c) => !allowedSet.has(c)))];
}

/** 找出使用的字（在 allowedSet 中的汉字） */
export function findUsedChars(
  text: string,
  allowedSet: Set<string>
): string[] {
  const chars = extractChineseChars(text);
  return [...new Set(chars.filter((c) => allowedSet.has(c)))];
}

/* ========== 敏感词过滤 ========== */

// 三级敏感词库
const SENSITIVE_WORDS_LEVEL_1 = [
  // 暴力/负面
  '杀', '死', '打', '骂', '毒', '恶', '坏', '恨',
  '痛', '苦', '哭', '伤', '血',
  '凶', '残', '暴', '虐', '毁',
];

const SENSITIVE_WORDS_LEVEL_2 = [
  // 不雅/歧视
  '笨', '蠢', '傻', '丑', '脏', '臭', '废', '懒',
  '猪', '狗',
];

const SENSITIVE_WORDS_LEVEL_3 = [
  // 恐怖/禁忌
  '鬼', '魔', '妖', '怪', '地', '狱',
  '坟', '墓', '尸',
];

const SENSITIVE_WORDS = [
  ...SENSITIVE_WORDS_LEVEL_1,
  ...SENSITIVE_WORDS_LEVEL_2,
  ...SENSITIVE_WORDS_LEVEL_3,
];

/** 检查文本是否包含敏感内容 */
export function hasSensitiveContent(text: string): boolean {
  return SENSITIVE_WORDS.some((word) => text.includes(word));
}
