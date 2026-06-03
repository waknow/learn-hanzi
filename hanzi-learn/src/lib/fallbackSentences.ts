/**
 * 保底句池
 *
 * 当 DeepSeek API 3 次重试均失败时，
 * 从对应字库的保底句中随机选取一句返回。
 *
 * ⚠️ 每句只能使用字库中已有的汉字，不得超出。
 */

import { findBankById } from './wordBanks';

type FallbackMap = Record<string, string[]>;

const FALLBACK_SENTENCES: FallbackMap = {
  // 日月星云山水花草风雨林
  ziran: [
    '日月山水',
    '花草风雨',
    '星云山林',
    '日月星花草',
    '山水风云',
    '山林花草',
    '日月山林花草',
    '星月花草山林',
    '风雨花草山林',
  ],

  // 猫狗鸟鱼马牛羊兔叫跑可爱
  dongwu: [
    '猫叫狗跑',
    '鸟叫马跑',
    '牛叫羊跑',
    '兔子可爱',
    '猫狗可爱',
    '鱼鸟可爱',
    '猫跑可爱',
    '狗叫马跑',
    '鸟叫可爱',
    '兔跑鸟叫',
  ],

  // 红黄蓝绿白花云天叶美
  yanse: [
    '红花绿叶',
    '白云蓝天',
    '花红叶绿',
    '红花美叶',
    '黄花美',
    '蓝天白云美',
    '天蓝叶绿',
    '白云黄花美',
    '红叶黄叶美',
    '红花蓝天',
  ],

  // 爸妈爷奶哥姐弟妹爱抱笑好
  jiating: [
    '爸妈爱',
    '爷奶好',
    '哥姐好',
    '弟妹笑',
    '爸妈抱',
    '爷奶爱笑',
    '哥姐弟妹好',
    '爸妈哥姐好',
    '爷奶弟妹笑',
    '全家爱笑',
  ],

  // 米果菜肉蛋奶糖茶汤吃香甜
  shiwei: [
    '吃果吃肉',
    '米果香甜',
    '蛋奶汤香',
    '吃菜吃肉',
    '果糖香甜',
    '米果蛋奶',
    '吃肉吃菜',
    '米菜香甜',
    '汤茶清香',
    '果蛋奶香',
  ],

  // 头手眼耳口鼻足发拍洗看
  shenti: [
    '拍手洗头',
    '眼看口说',
    '洗头发',
    '眼看手拍',
    '眼耳口鼻',
    '手拍足走',
    '口吃手拍',
    '眼洗耳听',
    '手拍头看',
    '足走眼看',
  ],

  // 走跑跳看听说读写吃画唱
  dongzuo: [
    '走跑跳看',
    '听说读写',
    '吃画唱',
    '跑步跳看',
    '看书写字',
    '画画唱歌',
    '走路跑步',
    '听歌唱曲',
    '看书写字',
    '画画练字',
  ],

  // 一二三十百千万半多大小
  shuzi: [
    '一二三',
    '十百千万',
    '大大小小',
    '一半一半',
    '三三两两',
    '万千百十',
    '大小多少',
    '多半千人',
    '二三万人',
    '百千万大',
  ],

  // 书包本笔纸桌椅尺画读写
  xuexiao: [
    '读书写字',
    '书包书本',
    '画笔纸张',
    '桌椅尺笔',
    '看书写字',
    '书包装书',
    '课堂桌椅',
    '读写画书',
    '书包笔纸',
    '桌椅读书',
  ],

  // 春夏秋冬暖凉热雪花叶来去
  jijie: [
    '春去夏来',
    '秋去冬来',
    '春暖花开',
    '冬雪花开',
    '秋叶凉风',
    '夏热冬凉',
    '春来花开',
    '冬来雪花',
    '春暖夏热',
    '秋凉冬雪',
    '花开花落',
  ],
};

/** 通用保底句（任何字库兜底） */
const GENERIC_FALLBACK = [
  '日月好时光',
  '山水美如画',
  '花草真好看',
];

/**
 * 获取指定字库的保底句子
 * @param bankId 字库 id
 * @returns 随机保底句
 */
export function getFallbackSentence(bankId: string): string {
  const pool = FALLBACK_SENTENCES[bankId];
  if (pool && pool.length > 0) {
    return pool[Math.floor(Math.random() * pool.length)];
  }
  return GENERIC_FALLBACK[Math.floor(Math.random() * GENERIC_FALLBACK.length)];
}

/**
 * 从保底句中提取用到的字
 * 兼容 findUsedChars 的签名
 */
export function pickFallbackUsedChars(
  sentence: string,
  allowedSet: Set<string>
): string[] {
  const chars = [...sentence].filter((c) => /[\u4e00-\u9fff]/.test(c));
  return [...new Set(chars.filter((c) => allowedSet.has(c)))];
}
