import { WordBank } from './types';

/**
 * 内置字库（只读）
 * 每个字库 8-15 个字，适合儿童注意力跨度
 */
export const BUILT_IN_BANKS: WordBank[] = [
  {
    id: 'ziran',
    name: '自然',
    emoji: '🌸',
    chars: ['日', '月', '星', '云', '山', '水', '花', '草', '风', '雨', '石', '林'],
  },
  {
    id: 'dongwu',
    name: '动物',
    emoji: '🐶',
    chars: ['猫', '狗', '鸟', '鱼', '虫', '马', '牛', '羊', '兔', '鸡', '鸭', '鹅'],
  },
  {
    id: 'yanse',
    name: '颜色',
    emoji: '🎨',
    chars: ['红', '黄', '蓝', '绿', '黑', '白', '紫', '粉', '灰', '金', '银'],
  },
  {
    id: 'jiating',
    name: '家庭',
    emoji: '🏠',
    chars: ['爸', '妈', '爷', '奶', '哥', '姐', '弟', '妹', '叔', '姨'],
  },
  {
    id: 'shiwei',
    name: '食物',
    emoji: '🍎',
    chars: ['米', '面', '果', '菜', '肉', '蛋', '奶', '糖', '茶', '汤'],
  },
  {
    id: 'shenti',
    name: '身体',
    emoji: '🖐️',
    chars: ['头', '手', '眼', '耳', '口', '鼻', '足', '牙', '脸', '发'],
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
    chars: ['一', '二', '三', '十', '百', '千', '万', '亿', '半', '多'],
  },
  {
    id: 'xuexiao',
    name: '校园',
    emoji: '📚',
    chars: ['书', '包', '课', '本', '笔', '纸', '桌', '椅', '尺', '画'],
  },
  {
    id: 'jijie',
    name: '季节',
    emoji: '🌤️',
    chars: ['春', '夏', '秋', '冬', '暖', '凉', '热', '雪', '霜', '冰'],
  },
];

/** 按 id 查找内置字库 */
export function findBankById(id: string): WordBank | undefined {
  return BUILT_IN_BANKS.find((b) => b.id === id);
}

/** 获取所有内置字库 id 集合 */
export function getBuiltInBankIds(): string[] {
  return BUILT_IN_BANKS.map((b) => b.id);
}
