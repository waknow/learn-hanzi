'use client';

import { useCallback } from 'react';
import { loadStats, saveStats } from '@/lib/storage';
import type { SentenceRecord } from '@/lib/types';

/**
 * 学习统计 Hook
 */
export function useStats() {
  /** 获取当前统计 */
  const getStats = useCallback(() => {
    return loadStats();
  }, []);

  /** 记录一次请求 */
  const recordCall = useCallback(
    (text: string, bankId: string, usedChars: string[]) => {
      const stats = loadStats();
      const today = new Date().toISOString().slice(0, 10);

      // 更新日期相关
      if (stats.todayDate !== today) {
        stats.todayDate = today;
        stats.todayCalls = 0;
      }
      stats.totalCalls += 1;
      stats.todayCalls += 1;
      stats.weeklyCalls += 1; // 简化：每周从不清零，看板上显示

      // 历史记录
      stats.history[today] = (stats.history[today] || 0) + 1;

      // 句子记录（最多保留 200 条）
      stats.sentenceHistory.unshift({
        text,
        date: today,
        bankId,
      } satisfies SentenceRecord);
      if (stats.sentenceHistory.length > 200) {
        stats.sentenceHistory = stats.sentenceHistory.slice(0, 200);
      }

      // 汉字使用统计
      usedChars.forEach((char) => {
        stats.charUsage[char] = (stats.charUsage[char] || 0) + 1;
      });

      saveStats(stats);
    },
    []
  );

  /** 重置统计 */
  const resetStats = useCallback(() => {
    saveStats({
      totalCalls: 0,
      todayCalls: 0,
      todayDate: '',
      weeklyCalls: 0,
      history: {},
      sentenceHistory: [],
      charUsage: {},
    });
  }, []);

  return { getStats, recordCall, resetStats };
}
