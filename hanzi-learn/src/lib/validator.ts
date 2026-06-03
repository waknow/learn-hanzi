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

/* ========== 敏感词过滤 ==========
 *
 * ⚠️ 只检测完整的两字词，避免单字误判。
 * 例："地"是高频字（快乐地跑），不单独禁；
 *     "地狱"才是敏感词。
 */

const SENSITIVE_WORDS = [
  // 暴力/负面
  '坏蛋', '可恶', '太坏',
  // 歧视/侮辱
  '笨蛋', '蠢猪', '傻瓜', '废物', '懒猪',
  // 死亡/恐怖
  '地狱', '魔鬼', '妖怪', '坟墓', '尸体',
  // 暴力动作
  '打人', '杀人', '打死', '骂人', '毒药', '伤害', '流血',
  // 负面情绪（组合词）
  '痛哭', '痛苦', '伤心', '凶狠', '残忍', '暴力',
  // 儿童不宜
  '讨厌', '恶心',
];

/** 检查文本是否包含敏感内容 */
export function hasSensitiveContent(text: string): boolean {
  return SENSITIVE_WORDS.some((word) => text.includes(word));
}
