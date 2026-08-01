import { WordBank } from "./types";

export const BUILT_IN_BANKS: WordBank[] = [
  {
    id: "level1",
    name: "一级",
    emoji: "🏠",
    chars: [
      "小",
      "大",
      "了",
      "虫",
      "我",
      "好",
      "的",
      "家",
      "在",
      "爸",
      "妈",
      "爱",
      "车",
      "可",
      "是",
      "圆",
      "方",
      "半",
      "会",
      "跑",
      "跳",
      "飞",
      "游",
      "少",
      "天",
      "手",
      "海",
      "鱼",
      "朋",
      "友",
      "儿",
      "上",
      "学",
      "老",
      "师",
      "里",
      "听",
      "声",
      "音",
      "呼",
      "睡",
      "着",
      "一",
      "二",
      "三",
      "四",
      "五",
      "多",
      "桥",
      "六",
      "七",
      "八",
      "九",
      "十",
      "以",
      "不",
      "笑",
      "头",
      "他",
      "她",
    ],
  },
  {
    id: "level2",
    name: "二级",
    emoji: "📖",
    chars: [
      // "黑", "空", "地", "晚", "打", "扫", "乌", "云", "星", "马",
      // "河", "过", "浅", "深", "问", "条", "牛", "说", "奶", "个",
      // "鸟", "只", "病", "开", "心", "田", "坐", "公", "鸡", "孩",
      // "果", "红", "出", "吃", "树", "火", "狮", "水", "井", "千",
      // "万", "蚊", "们", "鼻", "嘴", "阳", "光", "叶", "花", "子",
      // "美", "白", "丽", "月", "山", "林", "转", "下", "口", "球",
      // "来", "去", "耳", "爬", "你", "有", "快", "尾", "巴", "看",
      // "见", "走", "石", "种", "活", "生", "气", "风", "冬", "春",
      "雨",
      "伞",
      "闪",
      "电",
      "干",
      "根",
      "土",
      "皮",
      "枝",
      "森",
    ],
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
