/**
 * 音效引擎单测
 *
 * 用可断言的 AudioContext mock（vi.stubGlobal 注入，覆盖 setup.ts 的兜底 polyfill）
 * 验证各音效方法的节点创建行为、TTS 朗读与容错（null/closed 静默）。
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { SoundEngine } from "./soundEngine";

/** AudioContext 实例的断言接口（方法均为 vi.fn，可断言调用） */
interface MockContextInstance {
  state: AudioContextState;
  currentTime: number;
  sampleRate: number;
  destination: object;
  createOscillator: ReturnType<typeof vi.fn>;
  createGain: ReturnType<typeof vi.fn>;
  createBuffer: ReturnType<typeof vi.fn>;
  createBufferSource: ReturnType<typeof vi.fn>;
  resume: ReturnType<typeof vi.fn>;
  close: ReturnType<typeof vi.fn>;
}

interface MockAudioContextCtor {
  new (): MockContextInstance;
  mock: { instances: MockContextInstance[] };
}

/** 构造可断言的 AudioContext mock */
function createMockContext(state: AudioContextState = "running"): MockAudioContextCtor {
  return vi.fn(function (this: MockContextInstance) {
    this.state = state;
    this.currentTime = 10;
    this.sampleRate = 44100;
    this.destination = {};
    this.createOscillator = vi.fn(() => ({
      connect: vi.fn(),
      start: vi.fn(),
      stop: vi.fn(),
      type: "",
      frequency: {
        setValueAtTime: vi.fn(),
        exponentialRampToValueAtTime: vi.fn(),
      },
    }));
    this.createGain = vi.fn(() => ({
      connect: vi.fn(),
      gain: {
        setValueAtTime: vi.fn(),
        exponentialRampToValueAtTime: vi.fn(),
        linearRampToValueAtTime: vi.fn(),
      },
    }));
    this.createBuffer = vi.fn(() => ({ getChannelData: () => new Float32Array(8) }));
    this.createBufferSource = vi.fn(() => ({ connect: vi.fn(), start: vi.fn(), buffer: null }));
    this.resume = vi.fn(() => Promise.resolve());
    this.close = vi.fn(() => Promise.resolve());
  }) as unknown as MockAudioContextCtor;
}

let MockAudioContext: MockAudioContextCtor;
let engine: SoundEngine;

// setup.ts 用 defineProperty 注入的兜底 AudioContext（不可配置），测试后需恢复
const ORIGINAL_AUDIO_CONTEXT = globalThis.AudioContext;

/** 注入可断言的 AudioContext mock（vi.stubGlobal 对不可配置属性会抛错，改用赋值） */
function stubAudioContext(mock: MockAudioContextCtor) {
  (globalThis as unknown as { AudioContext: unknown }).AudioContext = mock;
}

beforeEach(() => {
  MockAudioContext = createMockContext();
  stubAudioContext(MockAudioContext);
  engine = new SoundEngine();
});

afterEach(() => {
  // 恢复 setup.ts 的兜底 polyfill
  stubAudioContext(ORIGINAL_AUDIO_CONTEXT as unknown as MockAudioContextCtor);
  vi.unstubAllGlobals();
  vi.clearAllMocks();
  Object.defineProperty(window, "speechSynthesis", {
    configurable: true,
    writable: true,
    value: undefined,
  });
});

describe("ensureContext", () => {
  it("首次调用创建 AudioContext", () => {
    const ctx = engine.ensureContext();
    expect(MockAudioContext).toHaveBeenCalledTimes(1);
    expect(ctx.state).toBe("running");
  });

  it("已创建时复用同一实例", () => {
    const first = engine.ensureContext();
    const second = engine.ensureContext();
    expect(MockAudioContext).toHaveBeenCalledTimes(1);
    expect(second).toBe(first);
  });

  it("suspended 时调用 resume", () => {
    MockAudioContext = createMockContext("suspended");
    stubAudioContext(MockAudioContext);
    engine.ensureContext();
    const ctx = MockAudioContext.mock.instances[0];
    expect(ctx.resume).toHaveBeenCalledTimes(1);
  });
});

describe("音效方法", () => {
  it("ding 使用 sine 振荡器并连线发声", () => {
    engine.ensureContext();
    engine.ding();
    const ctx = MockAudioContext.mock.instances[0];
    expect(ctx.createOscillator).toHaveBeenCalledTimes(1);
    const osc = ctx.createOscillator.mock.results[0].value;
    expect(osc.type).toBe("sine");
    expect(osc.connect).toHaveBeenCalledTimes(1);
    expect(osc.start).toHaveBeenCalledTimes(1);
    expect(osc.stop).toHaveBeenCalledTimes(1);
    expect(osc.frequency.setValueAtTime).toHaveBeenCalledWith(880, 10);
  });

  it("rocket 使用 sawtooth", () => {
    engine.ensureContext();
    engine.rocket();
    const ctx = MockAudioContext.mock.instances[0];
    const osc = ctx.createOscillator.mock.results[0].value;
    expect(osc.type).toBe("sawtooth");
  });

  it("error 使用 square", () => {
    engine.ensureContext();
    engine.error();
    const ctx = MockAudioContext.mock.instances[0];
    const osc = ctx.createOscillator.mock.results[0].value;
    expect(osc.type).toBe("square");
  });

  it("success 创建 3 音符琶音", () => {
    engine.ensureContext();
    engine.success();
    const ctx = MockAudioContext.mock.instances[0];
    expect(ctx.createOscillator).toHaveBeenCalledTimes(3);
  });

  it("tick 使用 createBuffer + createBufferSource", () => {
    engine.ensureContext();
    engine.tick();
    const ctx = MockAudioContext.mock.instances[0];
    expect(ctx.createBuffer).toHaveBeenCalledTimes(1);
    expect(ctx.createBufferSource).toHaveBeenCalledTimes(1);
  });
});

describe("容错", () => {
  it("dispose 后 ctx 为 null，音效静默", () => {
    engine.ensureContext();
    engine.dispose();
    const ctx = MockAudioContext.mock.instances[0];
    expect(ctx.close).toHaveBeenCalledTimes(1);
    engine.ding();
    engine.tick();
    // dispose 后 createOscillator 从未被调用
    expect(ctx.createOscillator).not.toHaveBeenCalled();
  });

  it("ctx 为 closed 时音效静默", () => {
    MockAudioContext = createMockContext("closed");
    stubAudioContext(MockAudioContext);
    engine.ensureContext();
    engine.ding();
    const ctx = MockAudioContext.mock.instances[0];
    expect(ctx.createOscillator).not.toHaveBeenCalled();
  });
});

describe("speak 语音朗读", () => {
  it("有 speechSynthesis 时取消并朗读，设置中文参数", () => {
    const cancel = vi.fn();
    const speak = vi.fn();
    Object.defineProperty(window, "speechSynthesis", {
      configurable: true, // 与 afterEach 对称，保证独立运行（-t 过滤）时 afterEach 可恢复
      writable: true,
      value: { cancel, speak },
    });
    const MockUtterance = vi.fn(function (
      this: { text: string; lang: string; rate: number; pitch: number },
      text: string,
    ) {
      this.text = text;
    });
    vi.stubGlobal(
      "SpeechSynthesisUtterance",
      MockUtterance as unknown as typeof SpeechSynthesisUtterance,
    );

    engine.speak("小猫");

    expect(cancel).toHaveBeenCalledTimes(1);
    expect(MockUtterance).toHaveBeenCalledWith("小猫");
    const utterance = MockUtterance.mock.instances[0];
    expect(utterance.lang).toBe("zh-CN");
    expect(utterance.rate).toBe(0.9);
    expect(utterance.pitch).toBe(1.2);
    expect(speak).toHaveBeenCalledTimes(1);
  });

  it("无 speechSynthesis 时静默返回", () => {
    Object.defineProperty(window, "speechSynthesis", {
      configurable: true, // 与 afterEach 对称，保证独立运行（-t 过滤）时 afterEach 可恢复
      writable: true,
      value: undefined,
    });
    expect(() => engine.speak("小猫")).not.toThrow();
  });
});
