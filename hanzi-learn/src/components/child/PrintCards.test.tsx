/**
 * 字卡打印组件测试
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import PrintCards from "./PrintCards";

/** 等待配置加载完成（工具栏出现） */
async function waitLoaded() {
  await screen.findByText("打印");
}

describe("PrintCards", () => {
  beforeEach(() => localStorage.clear());

  it("按字频份数渲染卡片（Tier1 字 3 份）", async () => {
    render(<PrintCards chars={["小", "大"]} />);
    await waitLoaded();
    // 限定卡片字 span：工具栏字号按钮「小」「大」也有同名文本
    expect(screen.getAllByText("小", { selector: "span" })).toHaveLength(3);
    expect(screen.getAllByText("大", { selector: "span" })).toHaveLength(3);
  });

  it("切换拼音开关后显示拼音", async () => {
    // 「桥」未收录在 FREQ_TIER（基准 1 份），拼音 qiáo 已映射，避免多份卡片重复匹配
    render(<PrintCards chars={["桥"]} />);
    await waitLoaded();
    expect(screen.queryByText("qiáo")).not.toBeInTheDocument();
    fireEvent.click(screen.getByText("拼音关"));
    expect(await screen.findByText("qiáo")).toBeInTheDocument();
  });

  it("切换份数系数 2.0x 后卡片翻倍", async () => {
    render(<PrintCards chars={["龘"]} />);
    await waitLoaded();
    fireEvent.click(screen.getByText("2.0x"));
    await waitFor(() => expect(screen.getAllByText("龘")).toHaveLength(2));
  });

  it("点击打印按钮调用 window.print", async () => {
    const printSpy = vi.spyOn(window, "print").mockImplementation(() => {});
    render(<PrintCards chars={["小"]} />);
    await waitLoaded();
    fireEvent.click(screen.getByText("打印"));
    expect(printSpy).toHaveBeenCalledTimes(1);
    printSpy.mockRestore();
  });
});
