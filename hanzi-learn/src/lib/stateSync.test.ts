/**
 * 客户端启动同步单测
 *
 * 覆盖：首次迁移（推本地）、服务端为准（按分区时间戳）、先推后拉、抑制回写、
 * 并发合并、失败静默。
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { syncOnce, SYNCED_FLAG } from "./stateSync";
import {
  KEYS,
  flushServerSync,
  loadConfig,
  loadStats,
  loadWeightData,
  saveConfig,
  saveStats,
} from "./storage";

const T_LOCAL = "2026-05-01T00:00:00.000Z";
const T_OLD = "2026-01-01T00:00:00.000Z";
const T_NEW = "2026-06-01T00:00:00.000Z";

/** 服务端返回体（默认 = 刚初始化完、没有用户数据） */
function serverState(overrides: Record<string, unknown> = {}) {
  return {
    schemaVersion: 2,
    config: { schemaVersion: 2, updatedAt: T_OLD, password: "1234", model: "" },
    stats: {
      schemaVersion: 2,
      updatedAt: T_OLD,
      totalCalls: 0,
      todayCalls: 0,
      todayDate: "",
      weeklyCalls: 0,
      history: {},
      sentenceHistory: [],
      charUsage: {},
      progress: {},
    },
    banks: {
      schemaVersion: 2,
      updatedAt: T_OLD,
      seedRevision: 1,
      seedFingerprint: "x",
      seededAt: T_OLD,
      items: [],
    },
    updatedAt: T_OLD,
    updatedAtByPart: { config: T_OLD, stats: T_OLD, banks: T_OLD },
    ...overrides,
  };
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status });
}

/** 立即排空保存调度出来的待同步块（用临时 mock 接住，避免真实网络请求） */
function drainPending(): void {
  const spy = vi.spyOn(globalThis, "fetch").mockResolvedValue(jsonResponse({}));
  flushServerSync();
  spy.mockRestore();
}

describe("syncOnce", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.useFakeTimers();
    vi.setSystemTime(new Date(T_LOCAL));
    // 排空上一组用例可能遗留的模块级待同步块
    vi.spyOn(globalThis, "fetch").mockResolvedValue(jsonResponse({}));
    flushServerSync();
    vi.restoreAllMocks();
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.useRealTimers();
    localStorage.clear();
  });

  it("首次同步且本地有用户数据、服务端没有 → 推本地，不再拉取", async () => {
    saveStats({ totalCalls: 5, progress: { level1: { round: 1, chars: [] } } });
    drainPending(); // 清掉保存调度出来的推送，让本次 syncOnce 的调用序列可预测

    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse(serverState()))
      .mockResolvedValueOnce(jsonResponse({ ok: true }));
    vi.stubGlobal("fetch", fetchMock as never);

    await syncOnce();

    const calls = fetchMock.mock.calls as [string, RequestInit][];
    expect(calls[0][0]).toBe("/api/state");
    expect(calls[0][1]?.method).toBeUndefined(); // GET
    expect(calls[1][0]).toBe("/api/state");
    expect(calls[1][1].method).toBe("PUT");
    const body = JSON.parse(String(calls[1][1].body));
    expect(body.stats.totalCalls).toBe(5);
    expect(body.stats.progress.level1).toBeDefined();
    // 本地没有自定义字库 → 不推 banks 块
    expect(body.banks).toBeUndefined();
    expect(localStorage.getItem(SYNCED_FLAG)).toBe("1");
  });

  it("服务端有用户数据 → 按分区时间戳覆盖本地", async () => {
    saveConfig({ password: "8888" });
    saveStats({ totalCalls: 1 });
    drainPending();

    const server = serverState({
      config: { schemaVersion: 2, updatedAt: T_NEW, password: "9999", model: "" },
      stats: {
        ...serverState().stats,
        updatedAt: T_NEW,
        totalCalls: 10,
        progress: { level2: { round: 2, chars: [] } },
      },
      updatedAtByPart: { config: T_NEW, stats: T_NEW, banks: T_NEW },
    });
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse(server)) as never);

    await syncOnce();

    expect(loadConfig().password).toBe("9999");
    expect(loadStats().totalCalls).toBe(10);
    expect(loadWeightData().level2).toBeDefined();
  });

  it("服务端分区时间戳更旧时不覆盖本地（保护尚未推送的改动）", async () => {
    saveConfig({ password: "8888" });
    saveStats({ totalCalls: 7 });
    drainPending();

    // 服务端有用户数据（否则会走首次迁移分支），但时间戳更旧
    const server = serverState({
      config: { schemaVersion: 2, updatedAt: T_OLD, password: "9999", model: "" },
      stats: { ...serverState().stats, updatedAt: T_OLD, totalCalls: 3 },
      updatedAtByPart: { config: T_OLD, stats: T_OLD, banks: T_OLD },
    });
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse(server)) as never);

    await syncOnce();

    expect(loadConfig().password).toBe("8888");
    expect(loadStats().totalCalls).toBe(7);
  });

  it("拉取覆盖本地时抑制回写（不把刚拉下的数据再推回服务端）", async () => {
    saveConfig({ password: "8888" });
    drainPending();
    const server = serverState({
      config: { schemaVersion: 2, updatedAt: T_NEW, password: "9999", model: "" },
      updatedAtByPart: { config: T_NEW, stats: T_NEW, banks: T_NEW },
    });
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(server));
    vi.stubGlobal("fetch", fetchMock as never);

    await syncOnce();
    await vi.advanceTimersByTimeAsync(1000);

    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("先推后拉：存在待同步块时先 PUT 再 GET（G3）", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse({ ok: true }))
      .mockResolvedValueOnce(jsonResponse(serverState()));
    vi.stubGlobal("fetch", fetchMock as never);

    saveStats({ totalCalls: 2 }); // 产生待同步块
    await syncOnce();

    const calls = fetchMock.mock.calls as [string, RequestInit][];
    expect(calls[0][1]?.method).toBe("PUT");
    expect(calls[1][1]?.method).toBeUndefined();
  });

  it("并发调用合并为一次请求", async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(serverState()));
    vi.stubGlobal("fetch", fetchMock as never);

    await Promise.all([syncOnce(), syncOnce(), syncOnce()]);

    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("网络失败时静默，保持本地缓存", async () => {
    saveStats({ totalCalls: 4, progress: { level1: { round: 1, chars: [] } } });
    drainPending();
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("network")) as never);

    await expect(syncOnce()).resolves.toBeUndefined();
    expect(loadStats().totalCalls).toBe(4);
    expect(loadWeightData().level1).toBeDefined();
  });

  it("服务端返回非 200 时静默返回", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(new Response("err", { status: 500 })) as never,
    );
    await expect(syncOnce()).resolves.toBeUndefined();
  });
});
