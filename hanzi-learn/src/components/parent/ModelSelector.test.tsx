/**
 * 模型选择卡片测试
 *
 * 覆盖：自动获取列表、当前模型与来源展示、切换模型（PUT + 本地配置）、
 * 空串「自动」选项、降级提示与重新获取。
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import ModelSelector from "./ModelSelector";
import { loadConfig, saveConfig } from "@/lib/storage";
import type { ModelInfo } from "@/lib/modelCatalog";

const FLASH: ModelInfo = {
  id: "deepseek-v4-flash",
  label: "DeepSeek V4 Flash",
  contextWindow: 128000,
  description: "速度快、成本低",
  recommended: true,
};
const PRO: ModelInfo = {
  id: "deepseek-v4-pro",
  label: "DeepSeek V4 Pro",
  contextWindow: 128000,
  description: "能力更强",
  recommended: true,
};

/** 构造 /api/model 响应体 */
function modelListBody(overrides: Record<string, unknown> = {}) {
  return {
    models: [FLASH, PRO],
    listSource: "api",
    current: "deepseek-v4-flash",
    currentSource: "default",
    selected: "",
    currentAvailable: true,
    hasApiKey: true,
    error: null,
    fetchedAt: "2026-08-14T00:00:00.000Z",
    ...overrides,
  };
}

/** 记录 PUT 请求体的 fetch 桩 */
function stubFetch(putBody: Record<string, unknown> = {}) {
  const calls: { url: string; init?: RequestInit }[] = [];
  const fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
    calls.push({ url, init });
    if (init?.method === "PUT") {
      const parsed = JSON.parse(String(init.body)) as { model: string };
      const model = parsed.model || "deepseek-v4-flash";
      return new Response(
        JSON.stringify(
          modelListBody({
            current: model,
            currentSource: parsed.model ? "manual" : "default",
            selected: parsed.model,
            ...putBody,
          }),
        ),
        { status: 200, headers: { "Content-Type": "application/json" } },
      );
    }
    return new Response(JSON.stringify(modelListBody()), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  });
  vi.stubGlobal("fetch", fetchMock as never);
  return { fetchMock, calls };
}

beforeEach(() => localStorage.clear());
afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("ModelSelector", () => {
  it("自动获取模型列表并展示当前模型与来源", async () => {
    stubFetch();
    render(<ModelSelector />);

    expect(await screen.findByText("DeepSeek V4 Flash")).toBeInTheDocument();
    expect(screen.getByText("DeepSeek V4 Pro")).toBeInTheDocument();
    // 当前模型 + 来源
    expect(screen.getByText("内置默认模型")).toBeInTheDocument();
    // 自动选项说明跟随服务端配置
    expect(screen.getByText(/跟随服务端配置/)).toBeInTheDocument();
    expect(screen.getByTestId("model-option-auto")).toBeInTheDocument();
  });

  it("点击模型：PUT 保存并同步本地配置", async () => {
    const { calls } = stubFetch();
    saveConfig({ password: "1234", model: "" });
    render(<ModelSelector />);
    expect(await screen.findByText("DeepSeek V4 Pro")).toBeInTheDocument();

    await userEvent.click(screen.getByText("DeepSeek V4 Pro"));

    expect(await screen.findByText("已切换模型，下次生成立即生效")).toBeInTheDocument();
    const put = calls.find((c) => c.init?.method === "PUT");
    expect(put?.url).toBe("/api/model");
    expect(JSON.parse(String(put?.init?.body))).toEqual({ model: "deepseek-v4-pro" });
    expect(loadConfig().model).toBe("deepseek-v4-pro");
    expect(screen.getByText("家长手动选择")).toBeInTheDocument();
  });

  it("点击「自动」：保存空串并清除手动选择", async () => {
    const { calls } = stubFetch();
    saveConfig({ password: "1234", model: "deepseek-v4-pro" });
    render(<ModelSelector />);
    expect(await screen.findByTestId("model-option-auto")).toBeInTheDocument();

    await userEvent.click(screen.getByTestId("model-option-auto"));

    expect(await screen.findByText("已设为自动选择模型")).toBeInTheDocument();
    const put = calls.find((c) => c.init?.method === "PUT");
    expect(JSON.parse(String(put?.init?.body))).toEqual({ model: "" });
    expect(loadConfig().model).toBe("");
  });

  it("无 API Key 时展示降级提示与离线目录", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(
        async () =>
          new Response(
            JSON.stringify(
              modelListBody({
                listSource: "fallback",
                hasApiKey: false,
                error: "未配置 DEEPSEEK_API_KEY，无法自动获取模型列表",
              }),
            ),
            { status: 200, headers: { "Content-Type": "application/json" } },
          ),
      ) as never,
    );
    render(<ModelSelector />);

    expect(
      await screen.findByText(/未配置 DEEPSEEK_API_KEY，无法自动获取模型列表/),
    ).toBeInTheDocument();
    expect(screen.getByText(/离线目录/)).toBeInTheDocument();
  });

  it("当前模型不在列表中时给出回退提示", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(
        async () =>
          new Response(
            JSON.stringify(modelListBody({ current: "deepseek-legacy", currentAvailable: false })),
            { status: 200, headers: { "Content-Type": "application/json" } },
          ),
      ) as never,
    );
    render(<ModelSelector />);

    expect(await screen.findByText(/不在账号可用列表中/)).toBeInTheDocument();
  });

  it("获取失败时展示重试按钮，点击后重新请求", async () => {
    const fetchMock = vi
      .fn()
      .mockRejectedValueOnce(new Error("network"))
      .mockResolvedValueOnce(
        new Response(JSON.stringify(modelListBody()), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }),
      );
    vi.stubGlobal("fetch", fetchMock as never);
    render(<ModelSelector />);

    expect(await screen.findByText("重新获取")).toBeInTheDocument();
    await userEvent.click(screen.getByText("重新获取"));

    expect(await screen.findByText("DeepSeek V4 Flash")).toBeInTheDocument();
    expect(fetchMock).toHaveBeenLastCalledWith("/api/model?refresh=1");
  });

  it("保存失败时提示重试且不写入本地配置", async () => {
    const fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
      if (init?.method === "PUT") {
        return new Response(JSON.stringify({ ok: false }), {
          status: 500,
          headers: { "Content-Type": "application/json" },
        });
      }
      return new Response(JSON.stringify(modelListBody()), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    });
    vi.stubGlobal("fetch", fetchMock as never);
    saveConfig({ password: "1234", model: "" });
    render(<ModelSelector />);
    expect(await screen.findByText("DeepSeek V4 Pro")).toBeInTheDocument();

    await userEvent.click(screen.getByText("DeepSeek V4 Pro"));

    expect(await screen.findByText("保存失败，请重试")).toBeInTheDocument();
    expect(loadConfig().model).toBe("");
  });
});
