/**
 * 无操作超时 Hook 测试（fake timers）
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useIdleTimeout } from "./useIdleTimeout";

describe("useIdleTimeout", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it("超时后触发回调并显示提示", () => {
    const onTimeout = vi.fn();
    const { result } = renderHook(() => useIdleTimeout(5000, onTimeout));
    expect(result.current.showHint).toBe(false);
    act(() => vi.advanceTimersByTime(5000));
    expect(onTimeout).toHaveBeenCalledTimes(1);
    expect(result.current.showHint).toBe(true);
  });

  it("reset 清除提示", () => {
    const { result } = renderHook(() => useIdleTimeout(5000, vi.fn()));
    act(() => vi.advanceTimersByTime(5000));
    expect(result.current.showHint).toBe(true);
    act(() => result.current.reset());
    expect(result.current.showHint).toBe(false);
  });

  it("enabled=false 时不启动计时", () => {
    const onTimeout = vi.fn();
    const { result } = renderHook(() => useIdleTimeout(5000, onTimeout, false));
    act(() => vi.advanceTimersByTime(10000));
    expect(onTimeout).not.toHaveBeenCalled();
    expect(result.current.showHint).toBe(false);
  });

  it("卸载时清理计时器", () => {
    const onTimeout = vi.fn();
    const { unmount } = renderHook(() => useIdleTimeout(5000, onTimeout));
    unmount();
    act(() => vi.advanceTimersByTime(10000));
    expect(onTimeout).not.toHaveBeenCalled();
  });
});
