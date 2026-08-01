/**
 * 打印配置 Hook 测试
 */
import { describe, it, expect, beforeEach } from "vitest";
import { renderHook, act, waitFor } from "@testing-library/react";
import { usePrintConfig } from "./usePrintConfig";

const STORAGE_KEY = "hanzi_print_config";

describe("usePrintConfig", () => {
  beforeEach(() => localStorage.clear());

  it("默认配置", async () => {
    const { result } = renderHook(() => usePrintConfig());
    await waitFor(() => expect(result.current.loaded).toBe(true));
    expect(result.current.config.font).toBe("楷体");
    expect(result.current.config.size).toBe("48pt");
    expect(result.current.config.cutLine).toBe("虚线");
    expect(result.current.config.showPinyin).toBe(false);
    expect(result.current.config.coefficient).toBe(1.0);
  });

  it("setConfig 局部更新并持久化", async () => {
    const { result } = renderHook(() => usePrintConfig());
    await waitFor(() => expect(result.current.loaded).toBe(true));
    act(() => result.current.setConfig({ showPinyin: true, coefficient: 2.0 }));
    expect(result.current.config.showPinyin).toBe(true);
    expect(result.current.config.coefficient).toBe(2.0);
    expect(JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}")).toMatchObject({
      showPinyin: true,
      coefficient: 2.0,
    });
  });

  it("读取已保存配置，未提供的字段保留默认", async () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ font: "黑体", size: "72pt" }));
    const { result } = renderHook(() => usePrintConfig());
    await waitFor(() => expect(result.current.loaded).toBe(true));
    expect(result.current.config.font).toBe("黑体");
    expect(result.current.config.size).toBe("72pt");
    expect(result.current.config.cutLine).toBe("虚线");
  });

  it("损坏的存储数据回退默认", async () => {
    localStorage.setItem(STORAGE_KEY, "{bad");
    const { result } = renderHook(() => usePrintConfig());
    await waitFor(() => expect(result.current.loaded).toBe(true));
    expect(result.current.config.font).toBe("楷体");
  });
});
