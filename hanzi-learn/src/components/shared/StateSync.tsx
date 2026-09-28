"use client";

import { useEffect } from "react";
import { syncOnce } from "@/lib/stateSync";

/**
 * 应用启动 / 窗口重新可见时与服务端同步。
 *
 * - 换浏览器/设备后打开应用，进度自动恢复；老用户本地数据自动迁移
 * - iPad PWA 从后台切回不会重挂载页面，因此额外监听 visibilitychange / focus
 *   补一次同步（否则手机改了字库，iPad 要整页刷新才生效）
 * - 无 UI，渲染空节点
 */
export default function StateSync() {
  useEffect(() => {
    let cancelled = false;

    const run = () => {
      void syncOnce().then(() => {
        // 同步完成后广播事件，让依赖配置的页面（如字库选择）刷新
        if (!cancelled && typeof window !== "undefined") {
          window.dispatchEvent(new Event("hanzi-state-synced"));
        }
      });
    };

    run();

    const onVisible = () => {
      if (document.visibilityState === "visible") run();
    };
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("focus", onVisible);

    return () => {
      cancelled = true;
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("focus", onVisible);
    };
  }, []);

  return null;
}
