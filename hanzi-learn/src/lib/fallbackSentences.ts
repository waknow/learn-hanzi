/**
 * 保底句池
 *
 * 当 DeepSeek API 3 次重试均失败时，
 * 从对应字库的保底句中随机选取一句返回。
 */

import { findBankById } from './wordBanks';

type FallbackMap = Record<string, string[]>;

const FALLBACK_SENTENCES: FallbackMap = {
  ziran: [
    '日月星辰真美丽',
    '山水花草有风雨',
    '蓝天白云好风光',
    '山林里的小花开了',
    '月光照亮了花草',
    '星星在云朵里眨眼',
    '风雨过后见彩虹',
  ],
  dongwu: [
    '小猫小狗真可爱',
    '小鸟飞在蓝天上',
    '小兔子吃胡萝卜',
    '鱼儿在水里游来游去',
    '小马在草地上跑',
    '小鸡小鸭做朋友',
    '大熊猫爱吃竹子',
  ],
  yanse: [
    '红红的太阳真好看',
    '蓝蓝的天空白云飘',
    '绿绿的草地真漂亮',
    '金色的阳光洒满大地',
    '白云在蓝天上飘',
    '花儿红草儿绿',
    '夜空中有银色的星星',
  ],
  jiating: [
    '爸爸妈妈我爱你们',
    '爷爷奶奶辛苦了',
    '哥哥姐姐陪我玩',
    '弟弟妹妹真可爱',
    '叔叔阿姨好',
    '一家人在一起真开心',
    '我给妈妈倒杯茶',
  ],
  shiwei: [
    '大米饭真香呀',
    '苹果甜甜的真好吃',
    '牛奶又香又好喝',
    '面包和果酱是好朋友',
    '鸡蛋汤真好喝',
    '糖很甜不能吃太多',
    '水果蔬菜都要吃',
  ],
  shenti: [
    '小手真能干',
    '眼睛看世界',
    '耳朵听声音',
    '鼻子闻花香',
    '嘴巴会说话',
    '小脚走天下',
    '牙齿白又亮',
  ],
  dongzuo: [
    '我走路去上学',
    '小鸟在唱歌',
    '妈妈说读书真好',
    '我画了一幅画',
    '小朋友在操场上跑',
    '一起跳绳真快乐',
    '我喜欢听故事',
  ],
  shuzi: [
    '一二三爬上山',
    '十百千都是大数',
    '我有一双小手',
    '半杯水也能喝',
    '万以内的数我都会',
    '多吃水果身体好',
    '一人一半刚刚好',
  ],
  xuexiao: [
    '书包里有课本',
    '铅笔和纸是好朋友',
    '桌椅摆得真整齐',
    '我有一把新尺子',
    '课本里有很多知识',
    '画画我喜欢',
    '书包背在肩上',
  ],
  jijie: [
    '春天花开真美丽',
    '夏天暖风吹过来',
    '秋天果实成熟了',
    '冬天雪花飘下来',
    '冰雪融化春天到',
    '春暖和花开',
    '秋凉风吹落叶',
  ],
};

/** 通用保底句（任何字库兜底） */
const GENERIC_FALLBACK = [
  '今天真是个好日子',
  '我喜欢学习新知识',
  '大家一起真开心',
  '天天向上快乐多',
  '美好的世界真奇妙',
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
