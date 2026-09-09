/**
 * 家长设置页集成测试（聚焦 AI 模型卡片）
 *
 * 覆盖：模型卡片渲染、切换模型后本地配置同步、与字库管理共存。
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import SettingsPage from "./page";
import { loadConfig } from "@/lib/storage";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
}));

const MODEL_BODY = {
  models: [
    {
      id: "deepseek-v4-flash",
      label: "DeepSeek V4 Flash",
      contextWindow: 128000,
      description: "速度快",
      recommended: true,
    },
    {
      id: "deepseek-v4-pro",
      label: "DeepSeek V4 Pro",
      contextWindow: 128000,
      description: "能力更强",
      recommended: true,
    },
  ],
  listSource: "api",
  current: "deepseek-v4-flash",
  currentSource: "default",
  selected: "",
  currentAvailable: true,
  hasApiKey: true,
  error: null,
  fetchedAt: "2026-08-14T00:00:00.000Z",
};

beforeEach(() => {
  localStorage.clear();
  vi.stubGlobal(
    "fetch",
    vi.fn(async (_url: string, init?: RequestInit) => {
      const body =
        init?.method === "PUT"
          ? {
              ok: true,
              ...MODEL_BODY,
              current: "deepseek-v4-pro",
              currentSource: "manual",
              selected: "deepseek-v4-pro",
            }
          : MODEL_BODY;
      return new Response(JSON.stringify(body), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }) as never,
  );
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("家长设置页 — AI 模型卡片", () => {
  it("渲染模型卡片与字库管理区块", async () => {
    render(<SettingsPage />);

    expect(await screen.findByText("🤖 AI 模型")).toBeInTheDocument();
    expect(await screen.findByText("DeepSeek V4 Flash")).toBeInTheDocument();
    expect(screen.getByText("⚙️ 字库管理")).toBeInTheDocument();
  });

  it("切换模型后写入本地家长配置", async () => {
    render(<SettingsPage />);
    expect(await screen.findByText("DeepSeek V4 Pro")).toBeInTheDocument();

    await userEvent.click(screen.getByText("DeepSeek V4 Pro"));

    expect(await screen.findByText("已切换模型，下次生成立即生效")).toBeInTheDocument();
    expect(loadConfig().model).toBe("deepseek-v4-pro");
  });
});
