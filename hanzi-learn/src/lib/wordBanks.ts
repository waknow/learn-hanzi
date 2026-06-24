import { WordBank } from './types';

/**
 * 通用助字集
 * 每个字库都自动包含这些高频汉字（虚词 + 常见动词/代词），
 * 帮助 AI 组成通顺的句子。
 * 权重引擎只追踪主题字，助字永远可用。
 */
export const HELPERS = [
  // 结构助词
  '的', '了', '是', '在', '有', '和', '不', '很',
  '也', '都', '会', '可', '以', '还', '就',
  // 人称
  '我', '你', '他', '她', '它', '们', '自', '己',
  // 方位/时间
  '上', '下', '里', '外', '前', '后', '来', '去',
  // 常见形容词/动词
  '小', '大', '好', '多', '少', '真', '快', '乐',
  '一', '起', '爱', '看', '想', '说', '笑',
  // 常见名词
  '人', '家', '天', '地', '水', '火', '花', '树', '草',
  // 社交/关系
  '朋', '友', '同',
  // 儿童故事高频角色
  '兔', '鱼', '鸟', '星',
  // 其他高频
  '子', '儿', '个', '只', '到', '出', '进',
];

/**
 * 内置字库（只读）
 * 每个字库自动附加通用助字集，确保能组成通顺句子。
 * 8-12 个主题字 + 7 个通用助字 = 15-19 总字数。
 */
export const BUILT_IN_BANKS: WordBank[] = [
  {
    id: 'default',
    name: '默认',
    emoji: '🔤',
    useHelpers: false,
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
    id: 'ziran',
    name: '自然',
    emoji: '🌸',
    chars: ['日', '月', '星', '云', '山', '水', '花', '草', '风', '雨', '林'],
  },
  {
    id: 'dongwu',
    name: '动物',
    emoji: '🐶',
    chars: ['猫', '狗', '鸟', '鱼', '马', '羊', '兔', '叫', '跑', '可', '爱'],
  },
  {
    id: 'yanse',
    name: '颜色',
    emoji: '🎨',
    chars: ['红', '黄', '蓝', '绿', '白', '花', '云', '天', '叶', '美'],
  },
  {
    id: 'jiating',
    name: '家庭',
    emoji: '🏠',
    chars: ['爸', '妈', '爷', '奶', '哥', '姐', '弟', '妹', '爱', '抱', '笑'],
  },
  {
    id: 'shiwei',
    name: '食物',
    emoji: '🍎',
    chars: ['米', '果', '菜', '肉', '蛋', '奶', '糖', '茶', '汤', '吃', '香', '甜'],
  },
  {
    id: 'shenti',
    name: '身体',
    emoji: '🖐️',
    chars: ['头', '手', '眼', '耳', '口', '鼻', '足', '发', '拍', '洗', '看'],
  },
  {
    id: 'dongzuo',
    name: '动作',
    emoji: '🏃',
    chars: ['走', '跑', '跳', '看', '听', '说', '读', '写', '吃', '画', '唱'],
  },
  {
    id: 'shuzi',
    name: '数字',
    emoji: '🔢',
    chars: ['一', '二', '三', '十', '百', '千', '万', '半', '多', '大', '小'],
  },
  {
    id: 'xuexiao',
    name: '校园',
    emoji: '📚',
    chars: ['书', '包', '本', '笔', '纸', '桌', '椅', '尺', '画', '读', '写'],
  },
  {
    id: 'jijie',
    name: '季节',
    emoji: '🌤️',
    chars: ['春', '夏', '秋', '冬', '暖', '凉', '热', '雪', '花', '叶', '来', '去'],
  },
];

/** 获取字库完整字符集（根据 useHelpers 决定是否追加助字） */
export function getFullBankChars(bank: WordBank): string[] {
  if (bank.useHelpers === false) {
    return [...bank.chars];
  }
  return [...bank.chars, ...HELPERS];
}

/**
 * 获取字库的有效 useHelpers 值
 * parentOverride 来自 ParentConfig.bankHelpers[bankId]
 */
export function getEffectiveUseHelpers(
  bank: WordBank,
  parentOverride?: Record<string, boolean>
): boolean {
  if (parentOverride && bank.id in parentOverride) {
    return parentOverride[bank.id];
  }
  return bank.useHelpers !== false; // 默认 true
}

/** 按 id 查找内置字库 */
export function findBankById(id: string): WordBank | undefined {
  return BUILT_IN_BANKS.find((b) => b.id === id);
}

/** 获取所有内置字库 id 集合 */
export function getBuiltInBankIds(): string[] {
  return BUILT_IN_BANKS.map((b) => b.id);
}
