"use client";

import { useCallback, useMemo } from "react";
import { weightedShuffle, updateWeights, initCharEntries, MAX_WEIGHT } from "@/lib/weightEngine";
import { loadWeightData, saveWeightData } from "@/lib/storage";
import type { CharEntry } from "@/lib/types";

/** 单字直示节流间隔（轮）：每 DIRECT_SHOW_GAP 轮最多直示一次 */
export const DIRECT_SHOW_GAP = 3;

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
      // 检查字库是否变化：按字符内容比较（仅比长度会漏掉“字数相同但字不同”的修改）
      const currentChars = bankData.chars.map((c) => c.char).join("");
      const expectedChars = bankChars.join("");
      if (currentChars !== expectedChars) {
        console.log(`[weightEngine] 字库 ${bankId} 内容已变化，重新初始化`);
        const fresh: { round: number; chars: CharEntry[]; lastDirectShowRound?: number } = {
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
    const fresh: { round: number; chars: CharEntry[]; lastDirectShowRound?: number } = {
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
    [bankId],
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

  /** 检查是否需要单字直示：存在 weight > MAX_WEIGHT 的字且距上次直示 ≥ 3 轮 → 返回权重最大的字；否则 null */
  const getDirectShowChar = useCallback((): string | null => {
    const data = getWeightData();
    let best: CharEntry | null = null;
    for (const c of data.chars) {
      if (c.weight > MAX_WEIGHT && (!best || c.weight > best.weight)) best = c;
    }
    if (!best) return null;
    const last = data.lastDirectShowRound ?? -DIRECT_SHOW_GAP;
    if (data.round - last >= DIRECT_SHOW_GAP) return best.char;
    return null;
  }, [getWeightData]);

  /** 标记本轮已直示（持久化 lastDirectShowRound = 当前轮次；应在 update 之后调用） */
  const markDirectShown = useCallback(() => {
    const allData = loadWeightData();
    const bankData = allData[bankId];
    if (!bankData) return;
    bankData.lastDirectShowRound = bankData.round;
    saveWeightData(allData);
  }, [bankId]);

  return {
    getSortedChars,
    update,
    reset,
    getWeights,
    getWeightData,
    getDirectShowChar,
    markDirectShown,
  };
}
