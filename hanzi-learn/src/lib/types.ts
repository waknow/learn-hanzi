/* ========== 核心类型定义 ========== */

/** 单字在权重引擎中的状态 */
export interface CharEntry {
  char: string;
  weight: number; // ≥ 1, 上限 20
  totalUsed: number;
  lastUsedRound: number;
}

/** 字库定义（只读存储结构） */
export interface WordBank {
  id: string;
  name: string;
  emoji: string;
  chars: string[];
  useHelpers?: boolean; // 默认 true，家长页可关闭
}

/** 权重持久化结构 */
export interface WeightData {
  [bankId: string]: {
    round: number;
    chars: CharEntry[];
  };
}

/** API 请求体 */
export interface GenerateRequest {
  bankId: string;
  sortedChars: string;
}

/** API 响应体 */
export interface GenerateResponse {
  text: string;
  usedChars: string[];
  extraChars: string[];
  isFallback: boolean;
}

/** 学习统计 */
export interface StudyStats {
  totalCalls: number;
  todayCalls: number;
  todayDate: string; // YYYY-MM-DD
  weeklyCalls: number;
  history: Record<string, number>; // date → count
  sentenceHistory: SentenceRecord[];
  charUsage: Record<string, number>; // char → totalUsed
}

export interface SentenceRecord {
  text: string;
  date: string; // YYYY-MM-DD
  bankId: string;
}

/** 家长配置 */
export interface ParentConfig {
  password: string;
  enabledBanks: string[];
  customBanks: WordBank[];
  bankHelpers?: Record<string, boolean>; // bankId → useHelpers(true/false)
}
