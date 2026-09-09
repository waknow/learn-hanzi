/**
 * 调试日志开关测试
 */
import { describe, it, expect, vi, afterEach } from "vitest";
import { DEBUG_ENABLED, debugLog, logError } from "./debug";

describe("debug", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  it("默认（未设置 NEXT_PUBLIC_DEBUG）不输出详细日志", () => {
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});

    debugLog("weightEngine", "应被丢弃");

    expect(DEBUG_ENABLED).toBe(false);
    expect(logSpy).not.toHaveBeenCalled();
  });

  it("NEXT_PUBLIC_DEBUG=1 时输出带 scope 的日志", async () => {
    vi.stubEnv("NEXT_PUBLIC_DEBUG", "1");
    vi.resetModules();
    const mod = await import("./debug");
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});

    mod.debugLog("client", "句子", "小猫");

    expect(mod.DEBUG_ENABLED).toBe(true);
    expect(logSpy).toHaveBeenCalledWith(expect.stringContaining("[client]"), "句子", "小猫");
  });

  it("logError 始终输出（生产也保留异常线索）", () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

    logError("client", "生成失败");

    expect(warnSpy).toHaveBeenCalledWith("[client]", "生成失败");
  });
});
