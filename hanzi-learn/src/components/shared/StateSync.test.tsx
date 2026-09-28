/**
 * 启动同步组件测试
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, waitFor } from "@testing-library/react";
import StateSync from "./StateSync";
import { syncOnce } from "@/lib/stateSync";

vi.mock("@/lib/stateSync", () => ({
  syncOnce: vi.fn().mockResolvedValue(undefined),
}));

describe("StateSync", () => {
  beforeEach(() => {
    vi.mocked(syncOnce).mockClear();
  });

  it("挂载时调用 syncOnce 并广播同步完成事件", async () => {
    const listener = vi.fn();
    window.addEventListener("hanzi-state-synced", listener);
    render(<StateSync />);
    expect(syncOnce).toHaveBeenCalledTimes(1);
    await waitFor(() => expect(listener).toHaveBeenCalledTimes(1));
    window.removeEventListener("hanzi-state-synced", listener);
  });

  it("窗口重新可见时补一次同步（iPad 从后台切回不重挂载页面）", async () => {
    render(<StateSync />);
    expect(syncOnce).toHaveBeenCalledTimes(1);

    Object.defineProperty(document, "visibilityState", {
      value: "visible",
      configurable: true,
    });
    document.dispatchEvent(new Event("visibilitychange"));

    await waitFor(() => expect(syncOnce).toHaveBeenCalledTimes(2));
    Object.defineProperty(document, "visibilityState", {
      value: "visible",
      configurable: true,
    });
  });

  it("窗口获得焦点时补一次同步", async () => {
    render(<StateSync />);
    await waitFor(() => expect(syncOnce).toHaveBeenCalled());

    window.dispatchEvent(new Event("focus"));

    await waitFor(() => expect(syncOnce).toHaveBeenCalledTimes(2));
  });
});
