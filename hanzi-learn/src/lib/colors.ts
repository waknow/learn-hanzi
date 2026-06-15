/**
 * 染色系统：为每个汉字分配不同的前景色+背景色组合
 * 24 组视觉可区分的配色，超过循环
 */

export interface ColorPair {
  bg: string;  // 背景色
  fg: string;  // 文字色
}

const PALETTE: ColorPair[] = [
  { bg: '#FFE0E0', fg: '#990000' },  // 浅红/深红
  { bg: '#D0F0D0', fg: '#005500' },  // 浅绿/深绿
  { bg: '#D0D0FF', fg: '#000099' },  // 浅蓝/深蓝
  { bg: '#FFE8CC', fg: '#994400' },  // 浅橙/深橙
  { bg: '#E8D0F0', fg: '#550099' },  // 浅紫/深紫
  { bg: '#D0F5F0', fg: '#005555' },  // 浅青/深青
  { bg: '#FFF5CC', fg: '#887700' },  // 浅黄/深棕
  { bg: '#FFD6E8', fg: '#990055' },  // 浅粉/深粉
  { bg: '#D6E8FF', fg: '#003377' },  // 浅天蓝/深蓝
  { bg: '#E8FFCC', fg: '#336600' },  // 浅草绿/深绿
  { bg: '#FFD0D0', fg: '#880000' },  // 浅珊瑚/深红
  { bg: '#D0FFE8', fg: '#006633' },  // 浅薄荷/深绿
  { bg: '#E8D6FF', fg: '#440088' },  // 浅淡紫/深紫
  { bg: '#FFE0D6', fg: '#883300' },  // 浅杏色/深棕
  { bg: '#D6FFF0', fg: '#005544' },  // 浅湖水绿/深绿
  { bg: '#F0FFD6', fg: '#556600' },  // 浅柠檬/深绿
  { bg: '#FFD6F0', fg: '#880066' },  // 浅玫红/深紫红
  { bg: '#D6E0FF', fg: '#002288' },  // 浅靛蓝/深蓝
  { bg: '#FFE8E8', fg: '#992222' },  // 浅米红/深红
  { bg: '#E0FFE0', fg: '#006600' },  // 亮绿/深绿
  { bg: '#F5E0FF', fg: '#660099' },  // 浅薰衣草/深紫
  { bg: '#FFF0D6', fg: '#775500' },  // 浅奶油/深棕
  { bg: '#D6FFF5', fg: '#006655' },  // 浅冰蓝/深青
  { bg: '#F0D6E8', fg: '#663355' },  // 浅灰紫/深紫
];

/** 获取某字的染色方案 */
export function getCharColor(char: string, uniqueChars: string[]): ColorPair {
  const idx = uniqueChars.indexOf(char);
  if (idx < 0) return { bg: '#FFFFFF', fg: '#000000' };
  return PALETTE[idx % PALETTE.length];
}
