"use client";

/**
 * 角落版本徽标（全站显示，见 src/app/layout.tsx）
 *
 * - 固定在左下角，极小字号 + 低透明度，不遮挡触摸操作（pointer-events-none）
 * - 长文本（含 commit）只在 title 中展示，页面保持干净
 * - 打印时隐藏（print:hidden），不污染字卡输出
 */

import { getVersionInfo, formatVersion } from "@/lib/version";

export default function VersionBadge() {
  const info = getVersionInfo();
  const text = formatVersion(info);

  return (
    <div
      data-testid="version-badge"
      title={`快乐识字 ${text}`}
      aria-label={`版本 ${text}`}
      className="fixed bottom-2 left-3 z-10 select-none pointer-events-none
                 text-[10px] leading-none text-gray-400/70 font-mono
                 [text-shadow:0_1px_2px_rgba(255,255,255,0.8)]
                 print:hidden"
    >
      {text}
    </div>
  );
}
