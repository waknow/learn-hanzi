/**
 * 服务端启动任务（仅 Node 运行时，由 src/instrumentation.ts 调用）
 *
 * E1 数据初始化 / E2 迁移：应用一起来就把 data/ 的三个分区文件补齐，
 * 使读接口（GET /api/state）在正常路径下是纯读；文件在运行期被手工删除时，
 * 读路径的 ensureInitialized() 会兜底自愈（见 lib/server/stateStore.ts）。
 */

import { ensureInitialized, getStateDir } from "./stateStore";

/** 幂等；失败只告警不阻断启动（只读卷、权限不足等） */
export function runStartupTasks(): void {
  // next build 阶段不写数据目录，避免污染仓库 / CI
  if (process.env.NEXT_PHASE === "phase-production-build") return;

  try {
    ensureInitialized();
    console.log(`[state] ✅ 数据初始化完成（config/stats/banks 三个分区）: ${getStateDir()}`);
  } catch (err) {
    console.warn(
      "[state] ⚠️ 数据初始化失败（只读卷？）：",
      err instanceof Error ? err.message : err,
    );
  }
}
