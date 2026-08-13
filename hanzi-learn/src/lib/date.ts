/**
 * 本地时区日期工具
 *
 * 学习统计与看板按"本地日期"（YYYY-MM-DD）记录/展示。
 * ⚠️ 不要用 new Date().toISOString().slice(0, 10)：那是 UTC 日期，
 * 在 UTC+8 的凌晨 0:00–8:00 会把统计记到前一天，导致"今日/本周"错位。
 */

/** 本地时区的 YYYY-MM-DD（补齐前导零） */
export function localDateString(d: Date = new Date()): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}
