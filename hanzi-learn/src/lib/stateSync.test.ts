/**
 * 客户端启动同步单测：首次迁移 / 服务端为准 / 失败静默 / 幂等
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { syncOnce } from "./stateSync";
import { KEYS, loadWeightData, loadStats, loadConfig } from "./storage";

const SYNCED_FLAG = "hanzi_state_synced";

describe("syncOnce", () => {
  beforeEach(() => {
    localStorage.clear();
    // fake timers：syncOnce 内部调用的 save* 会调度 500ms 防抖推送，
    // 避免测试结束后遗留定时器触发真实网络请求
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.useRealTimers();
    localStorage.clear();
  });

  it("首次使用且本地有数据、服务端为空 → 推送本地（首次迁移）", async () => {
    const weight = {
      level1: { round: 3, chars: [{ char: "小", weight: 4, totalUsed: 2, lastUsedRound: 3 }] },
    };
    localStorage.setItem(KEYS.WEIGHT_DATA, JSON.stringify(weight));

    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ weightData: {}, stats: {}, config: {}, updatedAt: null }), {
          status: 200,
        }),
      )
      .mockResolvedValueOnce(new Response(JSON.stringify({ ok: true }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock as never);

    await syncOnce();

    const calls = fetchMock.mock.calls as [string, RequestInit][];
    expect(calls[0][0]).toBe("/api/state");
    expect(calls[1][0]).toBe("/api/state");
    expect(calls[1][1].method).toBe("PUT");
    expect(JSON.parse(String(calls[1][1].body)).weightData).toEqual(weight);
    expect(localStorage.getItem(SYNCED_FLAG)).toBe("1");
  });

  it("服务端有数据 → 拉取覆盖本地", async () => {
    localStorage.setItem(KEYS.WEIGHT_DATA, JSON.stringify({ old: { round: 0, chars: [] } }));
    const serverState = {
      weightData: {
        level1: { round: 9, chars: [{ char: "大", weight: 5, totalUsed: 1, lastUsedRound: 9 }] },
      },
      stats: {
        totalCalls: 10,
        todayCalls: 2,
        todayDate: "2026-08-01",
        weeklyCalls: 10,
        history: {},
        sentenceHistory: [],
        charUsage: {},
      },
      config: { password: "9999", enabledBanks: [], customBanks: [] },
      updatedAt: "2026-08-01T00:00:00.000Z",
    };
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValue(new Response(JSON.stringify(serverState), { status: 200 })) as never,
    );

    await syncOnce();

    expect(loadWeightData()).toEqual(serverState.weightData);
    expect(loadStats().totalCalls).toBe(10);
    expect(loadConfig().password).toBe("9999");
  });

  it("网络失败时静默，保持本地缓存", async () => {
    const local = { level1: { round: 1, chars: [] } };
    localStorage.setItem(KEYS.WEIGHT_DATA, JSON.stringify(local));
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("network")) as never);
    await expect(syncOnce()).resolves.toBeUndefined();
    expect(loadWeightData()).toEqual(local);
  });

  it("服务端返回非 200 时静默返回", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(new Response("err", { status: 500 })) as never,
    );
    await expect(syncOnce()).resolves.toBeUndefined();
  });
});
