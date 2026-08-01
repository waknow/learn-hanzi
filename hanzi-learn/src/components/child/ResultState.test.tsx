/**
 * 结果状态组件测试
 */
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import ResultState from "./ResultState";

const { speakMock, playMock } = vi.hoisted(() => ({
  speakMock: vi.fn(),
  playMock: vi.fn(),
}));
vi.mock("@/hooks/useSound", () => ({
  useSound: () => ({ init: vi.fn(), play: playMock, speak: speakMock }),
}));

const BASE_PROPS = {
  text: "小猫",
  usedChars: ["小", "猫"],
  isFallback: false,
  consecutiveCount: 2,
  onRegenerate: vi.fn(),
};

describe("ResultState", () => {
  it("渲染句子与已用字标签", () => {
    render(<ResultState {...BASE_PROPS} />);
    expect(screen.getAllByText("小").length).toBeGreaterThan(0);
    expect(screen.getAllByText("猫").length).toBeGreaterThan(0);
    expect(screen.getByText(/已连造 2 句/)).toBeInTheDocument();
  });

  it("点击句子触发朗读", () => {
    render(<ResultState {...BASE_PROPS} />);
    // ResultState 逐字渲染（text.split('')），DOM 顺序：句子字 span 在前、已用字标签在后
    // 点击句子首字 span，事件冒泡到带 onClick 的句子容器 → speak(text)
    fireEvent.click(screen.getAllByText("小")[0]);
    expect(speakMock).toHaveBeenCalledWith("小猫");
  });

  it("isFallback 时显示备用句子提示", () => {
    render(<ResultState {...BASE_PROPS} isFallback />);
    expect(screen.getByText(/AI 偷懒了，这是备用句子/)).toBeInTheDocument();
  });

  it("isDirectShow 时显示复习单字提示", () => {
    render(<ResultState {...BASE_PROPS} isDirectShow text="大" usedChars={["大"]} />);
    expect(screen.getByText(/复习单字/)).toBeInTheDocument();
    expect(screen.queryByText(/AI 偷懒/)).not.toBeInTheDocument();
  });

  it("点击「再来一句」触发 onRegenerate", () => {
    const onRegenerate = vi.fn();
    render(<ResultState {...BASE_PROPS} onRegenerate={onRegenerate} />);
    fireEvent.click(screen.getByText("🔁 再来一句"));
    expect(onRegenerate).toHaveBeenCalledTimes(1);
  });
});
