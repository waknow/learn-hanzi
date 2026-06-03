import { CharEntry } from './types';

/**
 * 加权不放回抽样排序
 *
 * 权重越高的汉字越容易被排到前面。
 * 每次排序结果不同（概率性），但长期分布与权重正相关。
 */
export function weightedShuffle(chars: CharEntry[]): string {
  const candidates = [...chars];
  const result: string[] = [];

  while (candidates.length > 0) {
    const totalWeight = candidates.reduce((sum, c) => sum + c.weight, 0);
    let rand = Math.random() * totalWeight;

    for (let i = 0; i < candidates.length; i++) {
      rand -= candidates[i].weight;
      if (rand <= 0) {
        result.push(candidates[i].char);
        candidates.splice(i, 1);
        break;
      }
    }
  }

  return result.join('');
}

/** 权重上限 */
export const MAX_WEIGHT = 20;

/** 初始权重（每个汉字从 1 开始） */
export const INITIAL_WEIGHT = 1;

/**
 * 更新权重
 *
 * 规则:
 * - 本轮被用到的字 → weight 重置为 1
 * - 本轮未用到的字 → weight +1（上限 MAX_WEIGHT）
 */
export function updateWeights(
  chars: CharEntry[],
  usedSet: Set<string>,
  round: number
): CharEntry[] {
  return chars.map((c) => {
    if (usedSet.has(c.char)) {
      return {
        ...c,
        weight: INITIAL_WEIGHT,
        totalUsed: c.totalUsed + 1,
        lastUsedRound: round,
      };
    } else {
      return {
        ...c,
        weight: Math.min(c.weight + 1, MAX_WEIGHT),
      };
    }
  });
}

/**
 * 从字符串数组初始化 CharEntry 列表
 */
export function initCharEntries(chars: string[]): CharEntry[] {
  return chars.map((char) => ({
    char,
    weight: INITIAL_WEIGHT,
    totalUsed: 0,
    lastUsedRound: 0,
  }));
}
