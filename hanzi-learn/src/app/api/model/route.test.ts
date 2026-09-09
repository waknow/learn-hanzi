// @vitest-environment node
/**
 * /api/model 路由测试
 *
 * 覆盖：GET 自动获取模型列表（含 ?refresh=1 跳过缓存）、无 Key 降级、
 * PUT 保存手动选择、非法入参 400。
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import fs from "fs";
import os from "os";
import path from "path";
import { GET, PUT } from "./route";
import { clearModelCache } from "@/lib/server/modelStore";

let tmpDir: string;

beforeEach(() => {
  clearModelCache();
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "hanzi-api-model-"));
  vi.stubEnv("STATE_FILE", path.join(tmpDir, "state.json"));
  vi.stubEnv("DEEPSEEK_API_KEY", "sk-test");
  vi.stubEnv("DEEPSEEK_MODEL", "");
  vi.spyOn(console, "warn").mockImplementation(() => {});
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  clearModelCache();
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

function modelsResponse(ids: string[]): Response {
  return new Response(
    JSON.stringify({ object: "list", data: ids.map((id) => ({ id, object: "model" })) }),
    { status: 200, headers: { "Content-Type": "application/json" } },
  );
}

function getReq(query = ""): Request {
  return new Request(`http://localhost/api/model${query}`, { method: "GET" });
}

function putReq(body: string): Request {
  return new Request("http://localhost/api/model", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body,
  });
}

describe("GET /api/model", () => {
  it("返回自动获取的模型列表与当前模型", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(modelsResponse(["deepseek-v4-pro", "deepseek-v4-flash"])) as never,
    );

    const res = await GET(getReq());
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.listSource).toBe("api");
    expect(body.current).toBe("deepseek-v4-flash");
    expect(body.currentSource).toBe("default");
    expect(body.models.map((m: { id: string }) => m.id)).toEqual([
      "deepseek-v4-flash",
      "deepseek-v4-pro",
    ]);
  });

  it("?refresh=1 跳过缓存重新获取", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(modelsResponse(["deepseek-v4-flash"]))
      .mockResolvedValueOnce(modelsResponse(["deepseek-v4-pro"]));
    vi.stubGlobal("fetch", fetchMock as never);

    const first = await (await GET(getReq())).json();
    expect(first.models.map((m: { id: string }) => m.id)).toEqual(["deepseek-v4-flash"]);
    expect(first.currentAvailable).toBe(true);

    const second = await (await GET(getReq("?refresh=1"))).json();
    expect(fetchMock).toHaveBeenCalledTimes(2);
    // 新列表里没有当前模型 → 仍然展示出来并标记不可用，方便家长改选
    expect(second.models.map((m: { id: string }) => m.id)).toEqual([
      "deepseek-v4-flash",
      "deepseek-v4-pro",
    ]);
    expect(second.currentAvailable).toBe(false);
  });

  it("无 API Key 时返回兜底目录与提示", async () => {
    vi.stubEnv("DEEPSEEK_API_KEY", "");
    const res = await GET(getReq());
    const body = await res.json();
    expect(body.hasApiKey).toBe(false);
    expect(body.listSource).toBe("fallback");
    expect(body.error).toContain("DEEPSEEK_API_KEY");
  });
});

describe("PUT /api/model", () => {
  it("保存手动选择的模型", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(modelsResponse(["deepseek-v4-flash", "deepseek-v4-pro"])) as never,
    );

    const res = await PUT(putReq(JSON.stringify({ model: "deepseek-v4-pro" })));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(body.current).toBe("deepseek-v4-pro");
    expect(body.currentSource).toBe("manual");

    // 再次 GET 应读回同一选择
    const getBody = await (await GET(getReq())).json();
    expect(getBody.selected).toBe("deepseek-v4-pro");
  });

  it("空串表示自动选择", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(modelsResponse(["deepseek-v4-flash"])) as never,
    );
    const res = await PUT(putReq(JSON.stringify({ model: "" })));
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(body.currentSource).toBe("default");
  });

  it("model 非字符串返回 400", async () => {
    const res = await PUT(putReq(JSON.stringify({ model: 123 })));
    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe("invalid_model");
  });

  it("模型 id 非法返回 400", async () => {
    const res = await PUT(putReq(JSON.stringify({ model: "bad id" })));
    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe("invalid_model");
  });

  it("请求体不是 JSON 返回 400", async () => {
    const res = await PUT(putReq("{not json"));
    expect(res.status).toBe(400);
  });
});
