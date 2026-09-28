/**
 * Next.js 服务启动钩子（入口）
 *
 * ⚠️ instrumentation 会被同时编译到 nodejs 与 edge 两个运行时：
 * 必须把 fs / path 相关的实现放在 `process.env.NEXT_RUNTIME === "nodejs"` 分支的
 * 动态 import 里，否则 edge 打包会因解析不到 fs 而失败（见 Next 文档 instrumentation 示例）。
 *
 * 需要在 next.config.js 打开 experimental.instrumentationHook（Next 14）。
 */
export async function register(): Promise<void> {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { runStartupTasks } = await import("./lib/server/startup");
    runStartupTasks();
  }
}
