const POEM_LINES = [
  '牧童骑黄牛',
  '歌声振林樾',
  '意欲捕鸣蝉',
  '忽然闭口立',
  '锄禾日当午',
  '汗滴禾下土',
  '谁知盘中餐',
  '粒粒皆辛苦',
  '松下问童子',
  '言师采药去',
  '只在此山中',
  '云深不知处',
  '床前明月光',
  '疑是地上霜',
  '举头望明月',
  '低头思故乡',
  '春眠不觉晓',
  '处处闻啼鸟',
  '夜来风雨声',
  '花落知多少',
  '千山鸟飞绝',
  '万径人踪灭',
  '孤舟蓑笠翁',
  '独钓寒江雪',
  '空山不见人',
  '但闻人语响',
  '返景入深林',
  '复照青苔上',
  '小娃撑小艇',
  '偷采白莲回',
  '不解藏踪迹',
  '浮萍一道开',
  '红豆生南国',
  '春来发几枝',
  '愿君多采撷',
  '此物最相思',
];

export function getFallbackSentence(): string {
  return POEM_LINES[Math.floor(Math.random() * POEM_LINES.length)];
}

export function pickFallbackUsedChars(
  sentence: string,
  allowedSet: Set<string>
): string[] {
  const chars = [...sentence].filter((c) => /[\u4e00-\u9fff]/.test(c));
  return [...new Set(chars.filter((c) => allowedSet.has(c)))];
}
