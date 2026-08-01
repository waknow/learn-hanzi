/**
 * 返回按钮组件测试
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import BackButton from "./BackButton";

const pushMock = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: pushMock }),
}));

describe("BackButton", () => {
  beforeEach(() => pushMock.mockClear());

  it("渲染返回按钮并跳转指定路径", () => {
    render(<BackButton href="/" />);
    fireEvent.click(screen.getByLabelText("返回"));
    expect(pushMock).toHaveBeenCalledWith("/");
  });
});
