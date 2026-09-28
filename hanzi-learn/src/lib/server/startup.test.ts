// @vitest-environment node
/**
 * 服务启动任务单测（E1 初始化入口，见 src/instrumentation.ts）
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import fs from "fs";
import os from "os";
import path from "path";

import { runStartupTasks } from "./startup";

let tmpDir: string;

beforeEach(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "hanzi-startup-"));
  vi.stubEnv("STATE_DIR", tmpDir);
  vi.spyOn(console, "log").mockImplementation(() => {});
  vi.spyOn(console, "warn").mockImplementation(() => {});
});
afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

describe("runStartupTasks", () => {
  it("启动时补齐三个分区文件（内置字库由此落盘）", () => {
    runStartupTasks();

    expect(fs.existsSync(path.join(tmpDir, "config.json"))).toBe(true);
    expect(fs.existsSync(path.join(tmpDir, "stats.json"))).toBe(true);
    expect(fs.existsSync(path.join(tmpDir, "banks.json"))).toBe(true);

    const banks = JSON.parse(fs.readFileSync(path.join(tmpDir, "banks.json"), "utf-8"));
    expect(banks.seedRevision).toBeGreaterThan(0);
    expect(banks.items.map((i: { id: string }) => i.id)).toEqual(["level1", "level2"]);
  });

  it("幂等：重复执行不报错，也不重写内容", () => {
    runStartupTasks();
    const before = fs.readFileSync(path.join(tmpDir, "banks.json"), "utf-8");
    expect(() => runStartupTasks()).not.toThrow();
    expect(fs.readFileSync(path.join(tmpDir, "banks.json"), "utf-8")).toBe(before);
  });

  it("next build 阶段不写数据目录", () => {
    vi.stubEnv("NEXT_PHASE", "phase-production-build");
    runStartupTasks();
    expect(fs.readdirSync(tmpDir)).toHaveLength(0);
  });

  it("目录不可写时只告警不抛（只读卷降级）", () => {
    const blocker = path.join(tmpDir, "blocker");
    fs.writeFileSync(blocker, "not a dir", "utf-8");
    vi.stubEnv("STATE_DIR", path.join(blocker, "nested"));

    expect(() => runStartupTasks()).not.toThrow();
  });
});
