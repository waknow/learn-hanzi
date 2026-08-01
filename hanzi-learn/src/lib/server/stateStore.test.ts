/**
 * 服务端状态存储层单测（Node 环境 + 临时目录，不污染 data/）
 */
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import fs from "fs";
import os from "os";
import path from "path";
import { getStateFilePath, defaultState, readState, writeState } from "./stateStore";

let tmpDir: string;
beforeEach(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "hanzi-store-"));
  vi.stubEnv("STATE_FILE", path.join(tmpDir, "state.json"));
});
afterEach(() => {
  vi.unstubAllEnvs();
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

describe("getStateFilePath", () => {
  it("优先使用 STATE_FILE 环境变量", () => {
    expect(getStateFilePath()).toBe(path.join(tmpDir, "state.json"));
  });
});

describe("defaultState", () => {
  it("返回默认结构", () => {
    const s = defaultState();
    expect(s.updatedAt).toBeNull();
    expect(s.weightData).toEqual({});
    expect(s.stats.totalCalls).toBe(0);
    expect(s.config.password).toBe("1234");
  });
});

describe("readState / writeState", () => {
  it("文件不存在时返回默认", () => {
    expect(readState().updatedAt).toBeNull();
  });

  it("写入后可读回，updatedAt 非空", () => {
    writeState({ stats: { ...defaultState().stats, totalCalls: 5 } });
    const s = readState();
    expect(s.stats.totalCalls).toBe(5);
    expect(s.updatedAt).not.toBeNull();
  });

  it("weightData 按 bank 合并，不互相覆盖", () => {
    writeState({ weightData: { level1: { round: 1, chars: [] } } });
    writeState({ weightData: { level2: { round: 2, chars: [] } } });
    const s = readState();
    expect(s.weightData.level1).toBeDefined();
    expect(s.weightData.level2).toBeDefined();
  });

  it("局部更新不覆盖未传的块", () => {
    writeState({ config: { password: "6666", enabledBanks: [], customBanks: [] } });
    writeState({ stats: { ...defaultState().stats, totalCalls: 3 } });
    const s = readState();
    expect(s.config.password).toBe("6666");
    expect(s.stats.totalCalls).toBe(3);
  });

  it("损坏文件返回默认，不抛异常", () => {
    fs.writeFileSync(path.join(tmpDir, "state.json"), "{broken");
    expect(readState().updatedAt).toBeNull();
  });
});
