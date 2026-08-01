/**
 * 启动同步组件测试
 */
import { describe, it, expect, vi } from "vitest";
import { render, waitFor } from "@testing-library/react";
import StateSync from "./StateSync";
import { syncOnce } from "@/lib/stateSync";

vi.mock("@/lib/stateSync", () => ({
  syncOnce: vi.fn().mockResolvedValue(undefined),
}));

describe("StateSync", () => {
  it("挂载时调用 syncOnce 并广播同步完成事件", async () => {
    const listener = vi.fn();
    window.addEventListener("hanzi-state-synced", listener);
    render(<StateSync />);
    expect(syncOnce).toHaveBeenCalledTimes(1);
    await waitFor(() => expect(listener).toHaveBeenCalledTimes(1));
    window.removeEventListener("hanzi-state-synced", listener);
  });
});
