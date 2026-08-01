/**
 * 加载状态组件测试（冒烟：渲染火箭与首条文案）
 *
 * 说明：文案轮换与 12s 超时依赖真实计时 + framer-motion 动画，不测时机逻辑。
 */
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import LoadingState from "./LoadingState";

describe("LoadingState", () => {
  it("渲染火箭与首条加载文案", () => {
    render(<LoadingState onTimeout={vi.fn()} />);
    expect(screen.getByText("小脑袋正在想…")).toBeInTheDocument();
    expect(screen.getByText("🚀")).toBeInTheDocument();
  });
});
