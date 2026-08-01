/**
 * Vitest 全局测试环境（jsdom）
 *
 * - 注册 jest-dom matchers（toBeInTheDocument 等）
 * - polyfill 浏览器 API：matchMedia（framer-motion）、ResizeObserver（recharts）、
 *   AudioContext（soundEngine 兜底）、window.print、requestAnimationFrame
 * - 每个用例后清理 RTL 挂载与 localStorage
 */
import "@testing-library/jest-dom/vitest";
import { afterEach } from "vitest";
import { cleanup } from "@testing-library/react";

// matchMedia（framer-motion 的 useReducedMotion 需要）
if (typeof window !== "undefined" && !window.matchMedia) {
  Object.defineProperty(window, "matchMedia", {
    writable: true,
    value: (query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: () => {},
      removeListener: () => {},
      addEventListener: () => {},
      removeEventListener: () => {},
      dispatchEvent: () => false,
    }),
  });
}

// ResizeObserver（recharts 需要）
if (typeof window !== "undefined" && !window.ResizeObserver) {
  class ResizeObserverMock {
    observe() {}
    unobserve() {}
    disconnect() {}
  }
  Object.defineProperty(window, "ResizeObserver", {
    writable: true,
    value: ResizeObserverMock,
  });
}

// AudioContext（soundEngine 兜底；组件测试中 useSound 通常被 mock）
if (typeof window !== "undefined" && !window.AudioContext) {
  class AudioContextMock {
    state = "running";
    currentTime = 0;
    sampleRate = 44100;
    destination = {};
    createOscillator() {
      return {
        connect: () => {},
        start: () => {},
        stop: () => {},
        type: "sine",
        frequency: { setValueAtTime: () => {}, exponentialRampToValueAtTime: () => {} },
      };
    }
    createGain() {
      return {
        connect: () => {},
        gain: {
          setValueAtTime: () => {},
          exponentialRampToValueAtTime: () => {},
          linearRampToValueAtTime: () => {},
        },
      };
    }
    createBuffer() {
      return { getChannelData: () => new Float32Array(8) };
    }
    createBufferSource() {
      return { connect: () => {}, start: () => {}, buffer: null };
    }
    resume() {
      return Promise.resolve();
    }
    close() {
      return Promise.resolve();
    }
  }
  Object.defineProperty(window, "AudioContext", {
    writable: true,
    value: AudioContextMock,
  });
}

// window.print（打印页）
if (typeof window !== "undefined" && !window.print) {
  Object.defineProperty(window, "print", { writable: true, value: () => {} });
}

// requestAnimationFrame（framer-motion 需要；vitest jsdom 通常自带，缺则补）
if (typeof window !== "undefined" && !window.requestAnimationFrame) {
  window.requestAnimationFrame = (cb: FrameRequestCallback) =>
    setTimeout(() => cb(Date.now()), 16) as unknown as number;
  window.cancelAnimationFrame = (id: number) => clearTimeout(id);
}

// 每个用例后清理挂载与本地存储
afterEach(() => {
  cleanup();
  localStorage.clear();
});
