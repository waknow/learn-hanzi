/* ========== 核心类型定义 ========== */

/** 单字在权重引擎中的状态 */
export interface CharEntry {
  char: string;
  weight: number; // ≥ 0，未命中 +1 无上限；命中归 0
  totalUsed: number;
  lastUsedRound: number;
}

/** 字库定义（只读存储结构） */
export interface WordBank {
  id: string;
  name: string;
  emoji: string;
  chars: string[];
}

/** 权重持久化结构 */
export interface WeightData {
  [bankId: string]: {
    round: number;
    chars: CharEntry[];
    /** 最近一次单字直示的轮次（节流用）；未直示过则缺省 */
    lastDirectShowRound?: number;
  };
}

/** API 响应体 */
export interface GenerateResponse {
  text: string;
  usedChars: string[];
  extraChars: string[];
  isFallback: boolean;
  /** 实际使用的模型 id（服务端解析后的结果，便于排查） */
  model?: string;
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

/* ========== 持久化结构 v2（配置类 / 统计类 / 词库，分三个文件） ========== */

/**
 * 字库来源
 * - builtin：初始化默认值写入，可被"升级补种"更新
 * - custom：家长自建，永不被覆盖
 */
export type BankOrigin = "builtin" | "custom";

/**
 * 字库持久化条目（banks.json 的 items 元素）
 *
 * 在基础字库结构上补充来源与启停：
 * - origin 决定升级补种时能否被覆盖（见 lib/banks.ts reconcileBanks）
 * - enabled 取代 v1 的 ParentConfig.enabledBanks（"空数组 = 全部启用"的约定已淘汰）
 */
export interface BankRecord extends WordBank {
  origin: BankOrigin;
  enabled: boolean;
  /** 内置条目被家长改过 → 升级补种不再覆盖 */
  customized?: boolean;
  createdAt?: string;
  updatedAt?: string;
}

/** 词库分区（banks.json） */
export interface BanksSection {
  schemaVersion: number;
  updatedAt: string | null;
  /** 初始化默认值版本号（人工维护，见 lib/seed/builtinBanks.ts） */
  seedRevision: number;
  /** 初始化默认值内容指纹（自动检测，防"忘记改 seedRevision"） */
  seedFingerprint: string;
  seededAt: string | null;
  items: BankRecord[];
}

/** 配置分区（config.json）：字库定义与启停已移入词库分区 */
export interface ConfigSection {
  schemaVersion: number;
  updatedAt: string | null;
  password: string;
  /** 家长手动选定的模型 id；空串/缺省 = 自动（env DEEPSEEK_MODEL → 内置默认） */
  model?: string;
}

/** 统计分区（stats.json）：学习过程中产生的全部数据 */
export interface StatsSection extends StudyStats {
  schemaVersion: number;
  updatedAt: string | null;
  /** 字库权重进度（原顶层 weightData），按 bankId 存放 */
  progress: WeightData;
}

/** /api/state 的聚合返回体（三个分区的合并视图） */
export interface AppState {
  schemaVersion: number;
  config: ConfigSection;
  stats: StatsSection;
  banks: BanksSection;
  /** 三份文件中最新的 updatedAt（兼容旧客户端判断"服务端是否已有数据"） */
  updatedAt: string | null;
  /** 分区级时间戳：客户端按分区比较后只覆盖较新的那份 */
  updatedAtByPart: {
    config: string | null;
    stats: string | null;
    banks: string | null;
  };
}
