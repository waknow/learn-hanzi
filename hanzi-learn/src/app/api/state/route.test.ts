// @vitest-environment node
/**
 * /api/state 路由测试（三分区契约）
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import fs from "fs";
import os from "os";
import path from "path";
import { GET, PUT } from "./route";

let tmpDir: string;
beforeEach(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "hanzi-api-state-"));
  vi.stubEnv("STATE_FILE", path.join(tmpDir, "state.json"));
});
afterEach(() => {
  vi.unstubAllEnvs();
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

function putReq(body: string): Request {
  return new Request("http://localhost/api/state", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body,
  });
}

describe("GET /api/state", () => {
  it("首次访问即完成初始化，返回三分区数据", async () => {
    const res = await GET();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.schemaVersion).toBe(2);
    expect(body.config.password).toBe("1234");
    expect(body.stats.totalCalls).toBe(0);
    expect(body.stats.progress).toEqual({});
    expect(body.banks.items.map((i: { id: string }) => i.id)).toContain("level1");
    expect(body.updatedAt).toBeTruthy();
    expect(body.updatedAtByPart.banks).toBeTruthy();
    // 初始化落盘：文件真的写出来了
    expect(fs.existsSync(path.join(tmpDir, "banks.json"))).toBe(true);
  });
});

describe("PUT /api/state", () => {
  it("局部写入 stats 并可读回", async () => {
    const res = await PUT(putReq(JSON.stringify({ stats: { totalCalls: 3 } })));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(body.updatedAt).toBeTruthy();

    const state = await (await GET()).json();
    expect(state.stats.totalCalls).toBe(3);
  });

  it("写入 progress（旧客户端用 weightData）", async () => {
    await PUT(putReq(JSON.stringify({ weightData: { level1: { round: 2, chars: [] } } })));
    const state = await (await GET()).json();
    expect(state.stats.progress.level1.round).toBe(2);
  });

  it("写入字库启停", async () => {
    const state = await (await GET()).json();
    const items = state.banks.items.map((i: { id: string }, idx: number) =>
      idx === 0 ? { ...i, enabled: false } : i,
    );
    const res = await PUT(putReq(JSON.stringify({ banks: { ...state.banks, items } })));
    expect(res.status).toBe(200);
    const after = await (await GET()).json();
    expect(after.banks.items[0].enabled).toBe(false);
  });

  it("非法 body 返回 400", async () => {
    const res = await PUT(putReq("{not json"));
    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe("invalid_body");
  });

  it("非对象 body 返回 400", async () => {
    const res = await PUT(putReq("[1,2,3]"));
    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe("invalid_body");
  });
});
