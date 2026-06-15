/**
 * 拼音映射表（所有字库 + 助字合并，无重复）
 *
 * 按拼音字母序排列，方便增删。
 */
export const PINYIN_MAP: Record<string, string> = {
  // A
  爱: 'ài',
  // B
  八: 'bā', 巴: 'bā', 白: 'bái', 百: 'bǎi', 半: 'bàn',
  包: 'bāo', 抱: 'bào', 杯: 'bēi', 北: 'běi', 本: 'běn',
  笔: 'bǐ', 冰: 'bīng', 不: 'bù',
  // C
  草: 'cǎo', 茶: 'chá', 车: 'chē', 虫: 'chóng',
  吃: 'chī', 尺: 'chǐ', 春: 'chūn', 唱: 'chàng',
  出: 'chū',
  // D
  大: 'dà', 蛋: 'dàn', 到: 'dào', 的: 'de',
  地: 'dì', 弟: 'dì', 点: 'diǎn', 冬: 'dōng',
  都: 'dōu', 读: 'dú', 多: 'duō',
  // E
  儿: 'ér', 耳: 'ěr',
  // F
  发: 'fà', 方: 'fāng', 飞: 'fēi', 风: 'fēng',
  父: 'fù',
  // G
  哥: 'gē', 个: 'gè', 狗: 'gǒu', 果: 'guǒ',
  // H
  海: 'hǎi', 好: 'hǎo', 和: 'hé', 很: 'hěn',
  红: 'hóng', 后: 'hòu', 呼: 'hū', 花: 'huā',
  画: 'huà', 黄: 'huáng', 火: 'huǒ',
  // J
  鸡: 'jī', 家: 'jiā', 叫: 'jiào', 姐: 'jiě',
  进: 'jìn', 就: 'jiù', 己: 'jǐ',
  // K
  开: 'kāi', 看: 'kàn', 可: 'kě', 口: 'kǒu',
  快: 'kuài',
  // L
  来: 'lái', 蓝: 'lán', 老: 'lǎo', 乐: 'lè',
  了: 'le', 里: 'lǐ', 凉: 'liáng', 林: 'lín',
  绿: 'lǜ',
  // M
  马: 'mǎ', 妈: 'mā', 猫: 'māo', 美: 'měi',
  妹: 'mèi', 们: 'men', 米: 'mǐ', 奶: 'nǎi',
  南: 'nán',
  // N
  鸟: 'niǎo', 牛: 'niú', 暖: 'nuǎn',
  // P
  跑: 'pǎo', 拍: 'pāi', 朋: 'péng',
  // Q
  千: 'qiān', 前: 'qián', 起: 'qǐ', 秋: 'qiū',
  去: 'qù',
  // R
  人: 'rén', 日: 'rì', 肉: 'ròu', 热: 'rè',
  // S
  三: 'sān', 山: 'shān', 上: 'shàng', 少: 'shǎo',
  声: 'shēng', 师: 'shī', 十: 'shí', 手: 'shǒu',
  书: 'shū', 树: 'shù', 水: 'shuǐ', 说: 'shuō',
  四: 'sì', 霜: 'shuāng',
  // T
  他: 'tā', 她: 'tā', 它: 'tā', 糖: 'táng',
  汤: 'tāng', 天: 'tiān', 甜: 'tián', 跳: 'tiào',
  听: 'tīng', 同: 'tóng', 头: 'tóu', 兔: 'tù',
  // W
  外: 'wài', 万: 'wàn', 我: 'wǒ', 五: 'wǔ',
  // X
  西: 'xī', 洗: 'xǐ', 下: 'xià', 夏: 'xià',
  香: 'xiāng', 想: 'xiǎng', 笑: 'xiào', 小: 'xiǎo',
  写: 'xiě', 星: 'xīng', 雪: 'xuě',
  // Y
  眼: 'yǎn', 羊: 'yáng', 叶: 'yè', 一: 'yī',
  也: 'yě', 椅: 'yǐ', 以: 'yǐ', 音: 'yīn',
  有: 'yǒu', 游: 'yóu', 鱼: 'yú', 雨: 'yǔ',
  月: 'yuè', 云: 'yún', 爷: 'yé', 园: 'yuán',
  // Z
  在: 'zài', 走: 'zǒu', 足: 'zú', 子: 'zǐ',
  自: 'zì', 桌: 'zhuō', 纸: 'zhǐ', 只: 'zhǐ',
  真: 'zhēn',
};

/** 获取单个汉字的拼音 */
export function getPinyin(char: string): string | undefined {
  return PINYIN_MAP[char];
}

/** 获取一排汉字的拼音串 */
export function getPinyinLine(chars: string[]): string {
  return chars.map(c => PINYIN_MAP[c] || '').join(' ');
}
