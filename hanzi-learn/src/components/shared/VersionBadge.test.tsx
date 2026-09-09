/**
 * 角落版本徽标测试
 *
 * 覆盖：渲染版本文本、title 提示、不拦截触摸、打印隐藏。
 */
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import VersionBadge from "./VersionBadge";
import { getVersionInfo, formatVersion } from "@/lib/version";

describe("VersionBadge", () => {
  it("展示版本号并带完整提示", () => {
    render(<VersionBadge />);
    const expected = formatVersion(getVersionInfo());

    const badge = screen.getByTestId("version-badge");
    expect(badge).toHaveTextContent(expected);
    expect(badge).toHaveAttribute("title", `快乐识字 ${expected}`);
    expect(badge).toHaveAttribute("aria-label", `版本 ${expected}`);
  });

  it("不拦截触摸且打印时隐藏", () => {
    render(<VersionBadge />);
    const badge = screen.getByTestId("version-badge");
    expect(badge.className).toContain("pointer-events-none");
    expect(badge.className).toContain("fixed");
    expect(badge.className).toContain("print:hidden");
  });
});
