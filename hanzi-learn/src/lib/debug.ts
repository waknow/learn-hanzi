/**
 * 调试日志开关（客户端 / 服务端共用）
 *
 * 背景：加权洗牌、权重明细、每次请求的参数等日志在生产环境里既刷屏
 * （一次生成可能几十行），又会让儿童设备上的控制台无意义地增长。
 *
 * 规则：
 * - 详细信息（`debugLog`）默认静默；需要现场排查时用 `NEXT_PUBLIC_DEBUG=1` 重新构建开启
 * - 异常信息（`logError`）始终输出，保证线上问题可排查
 *
 * ⚠️ `process.env.NEXT_PUBLIC_*` 在构建期被内联，改值必须重新 build 才生效。
 */

/** 是否开启详细调试日志（构建期内联；生产默认关闭） */
export const DEBUG_ENABLED = process.env.NEXT_PUBLIC_DEBUG === "1";

/** 详细日志：仅在 DEBUG_ENABLED 时输出（默认关闭，调用点零副作用） */
export function debugLog(scope: string, ...args: unknown[]): void {
  if (!DEBUG_ENABLED) return;
  const time = new Date().toISOString().slice(11, 23);
  console.log(`[${time}] [${scope}]`, ...args);
}

/** 异常日志：始终输出（用 warn 级别，便于过滤） */
export function logError(scope: string, ...args: unknown[]): void {
  console.warn(`[${scope}]`, ...args);
}
