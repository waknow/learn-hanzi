import { WordBank } from './types';

export const BUILT_IN_BANKS: WordBank[] = [
  {
    id: 'level1',
    name: '一级',
    emoji: '🏠',
    chars: [
      "小", "大", "了", "虫", "我", "好", "的", "家", "在", "爸",
      "妈", "爱", "车", "可", "是", "圆", "方", "半", "会", "跑",
      "跳", "飞", "游", "少", "天", "手", "海", "鱼", "朋", "友",
      "儿", "上", "学", "老", "师", "里", "听", "声", "音", "呼",
      "睡", "着", "一", "二", "三", "四", "五", "多", "桥", "六",
      "七", "八", "九", "十", "以", "不", "笑", "头", "他", "她"
    ],
  },
  {
    id: 'level2',
    name: '二级',
    emoji: '📖',
    chars: [],
  },
];

export function findBankById(id: string): WordBank | undefined {
  return BUILT_IN_BANKS.find((b) => b.id === id);
}

export function getBuiltInBankIds(): string[] {
  return BUILT_IN_BANKS.map((b) => b.id);
}

export function getMergedBankChars(): string[] {
  const merged = new Set<string>();
  for (const bank of BUILT_IN_BANKS) {
    for (const c of bank.chars) {
      merged.add(c);
    }
  }
  return [...merged];
}
