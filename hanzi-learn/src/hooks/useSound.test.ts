/**
 * 音效 Hook 测试（mock SoundEngine，避免真实 AudioContext）
 */
import { describe, it, expect, vi, afterEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useSound } from "./useSound";
import { SoundEngine } from "@/lib/soundEngine";

vi.mock("@/lib/soundEngine", () => {
  return {
    // Vitest 4 要求 new 用的 mock 实现必须是 function/class（箭头函数不可构造）
    SoundEngine: vi.fn(function () {
      return {
        ensureContext: vi.fn(),
        ding: vi.fn(),
        rocket: vi.fn(),
        success: vi.fn(),
        error: vi.fn(),
        tick: vi.fn(),
        speak: vi.fn(),
        dispose: vi.fn(),
      };
    }),
  };
});

const SoundEngineMock = SoundEngine as unknown as ReturnType<typeof vi.fn>;

describe("useSound", () => {
  afterEach(() => vi.clearAllMocks());

  it("init 创建引擎并恢复上下文", () => {
    const { result } = renderHook(() => useSound());
    act(() => result.current.init());
    expect(SoundEngineMock).toHaveBeenCalledTimes(1);
    expect(SoundEngineMock.mock.results[0].value.ensureContext).toHaveBeenCalledTimes(1);
  });

  it("play 只初始化一次并调用对应音效", () => {
    const { result } = renderHook(() => useSound());
    act(() => result.current.play("ding"));
    act(() => result.current.play("success"));
    expect(SoundEngineMock).toHaveBeenCalledTimes(1);
    const engine = SoundEngineMock.mock.results[0].value;
    expect(engine.ding).toHaveBeenCalledTimes(1);
    expect(engine.success).toHaveBeenCalledTimes(1);
  });

  it("speak 朗读文本", () => {
    const { result } = renderHook(() => useSound());
    act(() => result.current.speak("小猫"));
    const engine = SoundEngineMock.mock.results[0].value;
    expect(engine.speak).toHaveBeenCalledWith("小猫");
  });

  it("卸载时释放引擎", () => {
    const { result, unmount } = renderHook(() => useSound());
    act(() => result.current.init());
    const engine = SoundEngineMock.mock.results[0].value;
    unmount();
    expect(engine.dispose).toHaveBeenCalledTimes(1);
  });
});
