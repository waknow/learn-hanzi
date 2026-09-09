// @vitest-environment node
/**
 * 服务端模型存储测试
 *
 * 覆盖：自动获取 + 缓存 + 在途合并、无 Key/上游异常降级兜底目录、
 * 生效模型解析、可用性判断、家长选择持久化到 state.json。
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import fs from "fs";
import os from "os";
import path from "path";
import {
  clearModelCache,
  getApiKey,
  getEffectiveModel,
  getModelList,
  isModelAvailable,
  saveSelectedModel,
} from "./modelStore";
import { readState } from "./stateStore";

let tmpDir: string;
let statePath: string;

beforeEach(() => {
  clearModelCache();
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "hanzi-model-"));
  statePath = path.join(tmpDir, "state.json");
  vi.stubEnv("STATE_FILE", statePath);
  vi.stubEnv("DEEPSEEK_API_KEY", "sk-test");
  vi.stubEnv("DEEPSEEK_MODEL", "");
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  clearModelCache();
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

/** 上游 /models 成功响应 */
function modelsResponse(ids: string[]): Response {
  return new Response(
    JSON.stringify({ object: "list", data: ids.map((id) => ({ id, object: "model" })) }),
    { status: 200, headers: { "Content-Type": "application/json" } },
  );
}

describe("getApiKey", () => {
  it("占位值视为未配置", () => {
    vi.stubEnv("DEEPSEEK_API_KEY", "your_deepseek_api_key_here");
    expect(getApiKey()).toBeNull();
  });

  it("正常值返回原样", () => {
    vi.stubEnv("DEEPSEEK_API_KEY", "sk-abc");
    expect(getApiKey()).toBe("sk-abc");
  });
});

describe("getModelList", () => {
  it("自动获取模型列表并标注来源为 api", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(modelsResponse(["deepseek-v4-pro", "deepseek-v4-flash"]));
    vi.stubGlobal("fetch", fetchMock as never);

    const result = await getModelList();
    expect(result.listSource).toBe("api");
    expect(result.hasApiKey).toBe(true);
    expect(result.error).toBeNull();
    expect(result.models.map((m) => m.id)).toEqual(["deepseek-v4-flash", "deepseek-v4-pro"]);
    expect(result.current).toBe("deepseek-v4-flash");
    expect(result.currentSource).toBe("default");
    expect(result.currentAvailable).toBe(true);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("命中缓存时不再请求上游", async () => {
    const fetchMock = vi.fn().mockResolvedValue(modelsResponse(["deepseek-v4-flash"]));
    vi.stubGlobal("fetch", fetchMock as never);

    await getModelList();
    await getModelList();
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("并发调用合并为一次上游请求", async () => {
    const fetchMock = vi.fn().mockResolvedValue(modelsResponse(["deepseek-v4-flash"]));
    vi.stubGlobal("fetch", fetchMock as never);

    const [a, b] = await Promise.all([getModelList(), getModelList()]);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(a.models.length).toBe(b.models.length);
  });

  it("无 API Key 时降级内置目录并给出提示", async () => {
    vi.stubEnv("DEEPSEEK_API_KEY", "");
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock as never);

    const result = await getModelList();
    expect(result.hasApiKey).toBe(false);
    expect(result.listSource).toBe("fallback");
    expect(result.error).toContain("DEEPSEEK_API_KEY");
    expect(result.models.length).toBeGreaterThan(0);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("上游 HTTP 错误时降级内置目录", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(new Response("boom", { status: 500 })) as never,
    );
    const result = await getModelList();
    expect(result.listSource).toBe("fallback");
    expect(result.error).toContain("无法从 DeepSeek 获取模型列表");
  });

  it("上游网络异常时降级内置目录", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("ECONNREFUSED")) as never);
    const result = await getModelList();
    expect(result.listSource).toBe("fallback");
    expect(result.error).toBeTruthy();
  });

  it("上游返回空列表时降级内置目录", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(modelsResponse([])) as never);
    const result = await getModelList();
    expect(result.listSource).toBe("fallback");
    expect(result.models.length).toBeGreaterThan(0);
  });

  it("环境变量模型作为当前模型（来源 env）", async () => {
    vi.stubEnv("DEEPSEEK_MODEL", "deepseek-v4-pro");
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(modelsResponse(["deepseek-v4-pro"])) as never);

    const result = await getModelList();
    expect(result.current).toBe("deepseek-v4-pro");
    expect(result.currentSource).toBe("env");
  });

  it("家长手动选择优先，并标记为 manual", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(modelsResponse(["deepseek-v4-flash", "deepseek-v4-pro"])) as never,
    );
    await saveSelectedModel("deepseek-v4-pro");

    const result = await getModelList();
    expect(result.selected).toBe("deepseek-v4-pro");
    expect(result.current).toBe("deepseek-v4-pro");
    expect(result.currentSource).toBe("manual");
    expect(result.currentAvailable).toBe(true);
  });

  it("手动选择的模型不在列表中时仍展示并标记不可用", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(modelsResponse(["deepseek-v4-flash"])) as never,
    );
    await saveSelectedModel("deepseek-legacy-x");

    const result = await getModelList();
    expect(result.currentAvailable).toBe(false);
    expect(result.models.map((m) => m.id)).toContain("deepseek-legacy-x");
    // 不可用模型排在末尾（非推荐）
    expect(result.models[result.models.length - 1].id).toBe("deepseek-legacy-x");
  });
});

describe("saveSelectedModel", () => {
  it("写入 state.json 的 config.model 并保留其他配置", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(modelsResponse(["deepseek-v4-pro"])) as never);
    const result = await saveSelectedModel("deepseek-v4-pro");

    expect(result.current).toBe("deepseek-v4-pro");
    expect(result.currentSource).toBe("manual");
    const state = readState();
    expect(state.config.model).toBe("deepseek-v4-pro");
    expect(state.config.password).toBe("1234");
  });

  it("空串表示自动（清除手动选择）", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(modelsResponse(["deepseek-v4-pro"])) as never);
    await saveSelectedModel("deepseek-v4-pro");
    const result = await saveSelectedModel("");

    expect(readState().config.model).toBe("");
    expect(result.selected).toBe("");
    expect(result.currentSource).toBe("default");
  });

  it("非法模型 id 抛出 invalid_model", async () => {
    await expect(saveSelectedModel("bad id")).rejects.toThrow("invalid_model");
    await expect(saveSelectedModel("x")).rejects.toThrow("invalid_model");
  });

  it("非字符串输入按自动处理", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(modelsResponse(["deepseek-v4-flash"])) as never,
    );
    const result = await saveSelectedModel(undefined as unknown as string);
    expect(result.selected).toBe("");
  });
});

describe("getEffectiveModel", () => {
  it("默认返回内置默认模型", () => {
    expect(getEffectiveModel()).toEqual({ model: "deepseek-v4-flash", source: "default" });
  });

  it("读取家长保存的选择", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(modelsResponse(["deepseek-v4-pro"])) as never);
    await saveSelectedModel("deepseek-v4-pro");
    expect(getEffectiveModel()).toEqual({ model: "deepseek-v4-pro", source: "manual" });
  });

  it("env 优先于默认", () => {
    vi.stubEnv("DEEPSEEK_MODEL", "deepseek-v4-pro");
    expect(getEffectiveModel()).toEqual({ model: "deepseek-v4-pro", source: "env" });
  });
});

describe("isModelAvailable", () => {
  it("列表包含该模型时为 true", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(modelsResponse(["deepseek-v4-pro"])) as never);
    expect(await isModelAvailable("deepseek-v4-pro")).toBe(true);
  });

  it("列表不含该模型时为 false", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(modelsResponse(["deepseek-v4-flash"])) as never,
    );
    expect(await isModelAvailable("deepseek-v4-pro")).toBe(false);
  });

  it("无 Key 或上游失败时不拦截（返回 true）", async () => {
    vi.stubEnv("DEEPSEEK_API_KEY", "");
    expect(await isModelAvailable("anything-model")).toBe(true);

    vi.stubEnv("DEEPSEEK_API_KEY", "sk-test");
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("down")) as never);
    expect(await isModelAvailable("deepseek-v4-pro")).toBe(true);
  });
});
