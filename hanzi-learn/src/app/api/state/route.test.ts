// @vitest-environment node
/**
 * /api/state 路由测试（临时文件）
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
  it("无数据时返回默认状态", async () => {
    const res = await GET();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.updatedAt).toBeNull();
    expect(body.weightData).toEqual({});
    expect(body.stats.totalCalls).toBe(0);
  });
});

describe("PUT /api/state", () => {
  it("合并写入并可读回", async () => {
    const res = await PUT(putReq(JSON.stringify({ stats: { totalCalls: 3 } })));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(body.updatedAt).toBeTruthy();

    const getRes = await GET();
    const state = await getRes.json();
    expect(state.stats.totalCalls).toBe(3);
  });

  it("非法 body 返回 400", async () => {
    const res = await PUT(putReq("{not json"));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe("invalid_body");
  });
});
