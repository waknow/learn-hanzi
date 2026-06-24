'use client';

import { useCallback, useMemo } from 'react';
import {
  weightedShuffle,
  updateWeights,
  initCharEntries,
} from '@/lib/weightEngine';
import { loadWeightData, saveWeightData } from '@/lib/storage';
import type { CharEntry } from '@/lib/types';

/**
 * 权重引擎 Hook
 *
 * 管理指定字库的权重数据，提供加权排序和更新功能。
 */
export function useWeightEngine(bankId: string, bankChars: string[]) {
  /** 获取当前权重数据，自动适配字库变化 */
  const getWeightData = useCallback(() => {
    const allData = loadWeightData();
    const bankData = allData[bankId];

    if (bankData) {
      // 检查字库是否变化（字数不同则重新初始化）
      if (bankData.chars.length !== bankChars.length) {
        console.log(`[weightEngine] 字库 ${bankId} 已变化: ${bankData.chars.length} → ${bankChars.length}，重新初始化`);
        const fresh = {
          round: 0,
          chars: initCharEntries(bankChars),
        };
        allData[bankId] = fresh;
        saveWeightData(allData);
        return fresh;
      }
      return bankData;
    }

    // 初始化新字库
    const fresh: { round: number; chars: CharEntry[] } = {
      round: 0,
      chars: initCharEntries(bankChars),
    };
    allData[bankId] = fresh;
    saveWeightData(allData);
    return fresh;
  }, [bankId, bankChars]);

  /** 加权排序，返回排序后的汉字串 */
  const getSortedChars = useCallback((): string => {
    const data = getWeightData();
    return weightedShuffle(data.chars);
  }, [getWeightData]);

  /** 更新权重：本轮使用了哪些字 */
  const update = useCallback(
    (usedSet: Set<string>) => {
      const allData = loadWeightData();
      const bankData = allData[bankId];
      if (!bankData) return;

      const nextRound = bankData.round + 1;
      bankData.chars = updateWeights(bankData.chars, usedSet, nextRound);
      bankData.round = nextRound;
      saveWeightData(allData);
    },
    [bankId]
  );

  /** 重置权重 */
  const reset = useCallback(() => {
    const allData = loadWeightData();
    allData[bankId] = {
      round: 0,
      chars: initCharEntries(bankChars),
    };
    saveWeightData(allData);
  }, [bankId, bankChars]);

  /** 获取各字的当前权重（供家长看板用） */
  const getWeights = useCallback((): { char: string; weight: number }[] => {
    const data = getWeightData();
    return data.chars.map((c) => ({ char: c.char, weight: c.weight }));
  }, [getWeightData]);

  return {
    getSortedChars,
    update,
    reset,
    getWeights,
    getWeightData,
  };
}
