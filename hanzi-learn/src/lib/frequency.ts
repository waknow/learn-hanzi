/**
 * 汉字词频分级（三级）
 *
 * Tier 1 = 极高频率（日常高频，建议印 3 份）
 * Tier 2 = 中等频率（主题常用，建议印 2 份）
 * Tier 3 = 较低频率（建议印 1 份）
 */

export type FreqTier = 1 | 2 | 3;

export const FREQ_TIER: Record<string, FreqTier> = {
  // === Tier 1 ===
  的:1, 了:1, 是:1, 在:1, 有:1, 和:1, 不:1, 很:1,
  也:1, 都:1, 会:1, 可:1, 以:1, 还:1, 就:1,
  我:1, 你:1, 他:1, 她:1, 它:1, 们:1, 自:1, 己:1,
  上:1, 下:1, 里:1, 外:1, 前:1, 后:1, 来:1, 去:1,
  小:1, 大:1, 好:1, 多:1, 少:1, 真:1, 快:1, 乐:1,
  一:1, 起:1, 爱:1, 看:1, 想:1, 说:1, 笑:1,
  人:1, 家:1, 天:1, 地:1, 水:1, 火:1, 花:1, 草:1,
  子:1, 儿:1, 个:1, 只:1, 到:1, 出:1, 进:1,
  日:1, 月:1, 星:1, 云:1, 山:1, 风:1, 雨:1,
  手:1, 头:1, 口:1, 眼:1, 耳:1, 鼻:1, 足:1,
  吃:1, 走:1, 跑:1, 跳:1,
  书:1, 学:1, 老:1, 师:1,

  // === Tier 2 ===
  红:2, 黄:2, 蓝:2, 绿:2, 白:2,
  猫:2, 狗:2, 鸟:2, 鱼:2, 马:2, 羊:2, 兔:2,
  叫:2, 树:2, 叶:2, 果:2,
  春:2, 夏:2, 秋:2, 冬:2, 暖:2, 凉:2, 热:2, 雪:2,
  爸:2, 妈:2, 爷:2, 奶:2, 哥:2, 姐:2, 弟:2, 妹:2,
  抱:2, 洗:2, 拍:2,
  读:2, 写:2, 画:2, 唱:2, 听:2,
  包:2, 笔:2, 纸:2, 桌:2, 椅:2, 尺:2, 本:2,
  米:2, 菜:2, 肉:2, 蛋:2, 糖:2, 茶:2, 汤:2, 香:2, 甜:2,
  发:2, 林:2, 海:2, 朋:2, 友:2, 同:2, 美:2, 声:2, 音:2,
  霜:2, 冰:2,
};

/** 获取指定字的 base 重复份数 */
export function getBaseCopies(char: string): number {
  const tier = FREQ_TIER[char] || 3;
  return tier === 1 ? 3 : tier === 2 ? 2 : 1;
}

/**
 * 根据重复系数和字频生成打印用的完整字列表
 */
export function expandWithFrequency(chars: string[], coefficient: number): string[] {
  const result: string[] = [];
  for (const char of chars) {
    const copies = Math.max(1, Math.round(getBaseCopies(char) * coefficient));
    for (let i = 0; i < copies; i++) result.push(char);
  }
  return result;
}
