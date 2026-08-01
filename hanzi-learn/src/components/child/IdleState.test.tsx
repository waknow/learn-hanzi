/**
 * 空闲状态组件测试
 *
 * 说明：8 秒引导箭头依赖真实计时 + framer-motion 无限动画循环，
 * 与 fake timers 组合易产生 act 抖动，故不测箭头出现时机，只测渲染与交互。
 */
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import IdleState from "./IdleState";

vi.mock("@/hooks/useSound", () => ({
  useSound: () => ({ init: vi.fn(), play: vi.fn(), speak: vi.fn() }),
}));

describe("IdleState", () => {
  it("渲染大按钮，点击触发 onGenerate", () => {
    const onGenerate = vi.fn();
    render(<IdleState onGenerate={onGenerate} />);
    fireEvent.click(screen.getByText("造句子"));
    expect(onGenerate).toHaveBeenCalledTimes(1);
  });

  it("有连续计数时显示鼓励信息", () => {
    render(<IdleState onGenerate={vi.fn()} consecutiveCount={3} />);
    expect(screen.getByText(/上次连造了 3 句/)).toBeInTheDocument();
  });

  it("无连续计数时不显示鼓励信息", () => {
    render(<IdleState onGenerate={vi.fn()} />);
    expect(screen.queryByText(/上次连造了/)).not.toBeInTheDocument();
  });
});
