// @vitest-environment node
/**
 * /api/generate 路由测试
 *
 * 覆盖：缺参 400、无 Key 保底、AI 校验链（越界/敏感词/最少字数/最大长度）、
 * 3 次全败降级、HTTP 错误降级、评分后缀剥离（防御性兼容）。
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import fs from "fs";
import os from "os";
import path from "path";
import { POST } from "./route";
import { readState, writeState } from "@/lib/server/stateStore";
import { clearModelCache } from "@/lib/server/modelStore";
import { DEFAULT_MODEL } from "@/lib/modelCatalog";

let tmpDir: string;
beforeEach(() => {
  vi.spyOn(console, "log").mockImplementation(() => {});
  vi.spyOn(console, "warn").mockImplementation(() => {});
  clearModelCache();
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "hanzi-api-gen-"));
  vi.stubEnv("STATE_FILE", path.join(tmpDir, "state.json"));
  // 默认关闭重试退避，保持重试用例快速；专门的退避用例会单独覆盖
  vi.stubEnv("DEEPSEEK_RETRY_BASE_MS", "0");
  // 默认无环境变量模型，走内置默认；模型相关用例单独覆盖
  vi.stubEnv("DEEPSEEK_MODEL", "");
});

/** 挂起直到 signal 中止的 fetch（模拟 DeepSeek 超时场景） */
function hangingFetch(init?: RequestInit): Promise<Response> {
  return new Promise((_resolve, reject) => {
    init?.signal?.addEventListener("abort", () => {
      reject(Object.assign(new Error("The operation was aborted"), { name: "AbortError" }));
    });
  });
}
afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

function makeReq(body: unknown): Request {
  return new Request("http://localhost/api/generate", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

/** DeepSeek 风格的成功响应 */
function aiResponse(text: string): Response {
  return new Response(JSON.stringify({ choices: [{ message: { content: text } }] }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
}

const GOOD = "小猫【自然程度-9 口语化-9 完整度-9】";

describe("POST /api/generate", () => {
  it("缺少参数返回 400", async () => {
    const res = await POST(makeReq({}));
    expect(res.status).toBe(400);
  });

  it("无 API Key 时返回权重最大的单字", async () => {
    vi.stubEnv("DEEPSEEK_API_KEY", "");
    const res = await POST(
      makeReq({
        bankId: "level1",
        sortedChars: "小猫",
        themeWeights: JSON.stringify([
          { char: "小", weight: 1 },
          { char: "猫", weight: 25 },
        ]),
      }),
    );
    const body = await res.json();
    expect(body.isFallback).toBe(true);
    expect(body.text).toBe("猫");
    expect(body.usedChars).toEqual(["猫"]);
    expect(body.extraChars).toEqual([]);
  });

  it("无 themeWeights 时取 sortedChars 第一个字", async () => {
    vi.stubEnv("DEEPSEEK_API_KEY", "");
    const res = await POST(makeReq({ bankId: "level1", sortedChars: "小猫" }));
    const body = await res.json();
    expect(body.isFallback).toBe(true);
    expect(body.text).toBe("小");
  });

  it("AI 返回合规句子：剥离评分后缀并返回用字", async () => {
    vi.stubEnv("DEEPSEEK_API_KEY", "sk-test");
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(aiResponse(GOOD)) as never);
    const res = await POST(makeReq({ bankId: "bank-a", sortedChars: "小猫鱼" }));
    const body = await res.json();
    expect(body.isFallback).toBe(false);
    expect(body.text).toBe("小猫");
    expect(body.usedChars.sort()).toEqual(["小", "猫"]);
    expect(body.extraChars).toEqual([]);
  });

  it("越界字触发重试，最终返回合规结果", async () => {
    vi.stubEnv("DEEPSEEK_API_KEY", "sk-test");
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(aiResponse("小狗【自然程度-9 口语化-9 完整度-9】"))
      .mockResolvedValueOnce(aiResponse(GOOD));
    vi.stubGlobal("fetch", fetchMock as never);
    const res = await POST(makeReq({ bankId: "bank-b", sortedChars: "小猫" }));
    const body = await res.json();
    expect(body.text).toBe("小猫");
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("敏感词触发重试", async () => {
    vi.stubEnv("DEEPSEEK_API_KEY", "sk-test");
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(aiResponse("坏蛋【自然程度-9 口语化-9 完整度-9】"))
      .mockResolvedValueOnce(aiResponse(GOOD));
    vi.stubGlobal("fetch", fetchMock as never);
    const res = await POST(makeReq({ bankId: "bank-c", sortedChars: "小猫" }));
    const body = await res.json();
    expect(body.text).toBe("小猫");
  });

  it("单字输出触发重试（最少 2 个可用字）", async () => {
    vi.stubEnv("DEEPSEEK_API_KEY", "sk-test");
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(aiResponse("猫"))
      .mockResolvedValueOnce(aiResponse(GOOD));
    vi.stubGlobal("fetch", fetchMock as never);
    const res = await POST(makeReq({ bankId: "bank-d", sortedChars: "小猫" }));
    const body = await res.json();
    expect(body.isFallback).toBe(false);
    expect(body.text).toBe("小猫");
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("输出过长触发重试（超过 12 个字）", async () => {
    vi.stubEnv("DEEPSEEK_API_KEY", "sk-test");
    const long = "一二三四五六七八九十小大猫"; // 13 个可用字，超过 MAX_OUTPUT_CHARS
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(aiResponse(long))
      .mockResolvedValueOnce(aiResponse(GOOD));
    vi.stubGlobal("fetch", fetchMock as never);
    const res = await POST(makeReq({ bankId: "bank-d2", sortedChars: long }));
    const body = await res.json();
    expect(body.isFallback).toBe(false);
    expect(body.text).toBe("小猫");
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("3 次均未通过时直示权重最大单字", async () => {
    vi.stubEnv("DEEPSEEK_API_KEY", "sk-test");
    // 每次返回同一越界句：第 2、3 次会被"重复输出"拦截
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(aiResponse("出界字句【自然程度-9 口语化-9 完整度-9】")) as never,
    );
    const res = await POST(
      makeReq({
        bankId: "bank-e",
        sortedChars: "小猫",
        themeWeights: JSON.stringify([
          { char: "小", weight: 5 },
          { char: "猫", weight: 30 },
        ]),
      }),
    );
    const body = await res.json();
    expect(body.isFallback).toBe(true);
    expect(body.text).toBe("猫");
  });

  it("DeepSeek 请求超时时重试 3 次并降级直示", async () => {
    vi.stubEnv("DEEPSEEK_API_KEY", "sk-test");
    vi.stubEnv("DEEPSEEK_TIMEOUT_MS", "50");
    const fetchMock = vi
      .fn()
      .mockImplementation((_url: string, init?: RequestInit) => hangingFetch(init));
    vi.stubGlobal("fetch", fetchMock as never);
    const res = await POST(
      makeReq({
        bankId: "bank-g",
        sortedChars: "小猫",
        themeWeights: JSON.stringify([
          { char: "小", weight: 5 },
          { char: "猫", weight: 30 },
        ]),
      }),
    );
    const body = await res.json();
    expect(body.isFallback).toBe(true);
    expect(body.text).toBe("猫");
    // 超时视为失败 → 3 次尝试全部超时
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it("重试前应用指数退避（第二次请求等 base 毫秒后才发起）", async () => {
    vi.stubEnv("DEEPSEEK_API_KEY", "sk-test");
    vi.stubEnv("DEEPSEEK_RETRY_BASE_MS", "100");
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(new Response("server error", { status: 500 }))
      .mockResolvedValueOnce(aiResponse(GOOD));
    vi.stubGlobal("fetch", fetchMock as never);
    vi.useFakeTimers();
    try {
      const promise = POST(makeReq({ bankId: "bank-h", sortedChars: "小猫" }));
      // 排空微任务：首次 fetch 已调用并返回 HTTP 500
      await vi.advanceTimersByTimeAsync(0);
      expect(fetchMock).toHaveBeenCalledTimes(1);
      // 退避 100ms 结束后才发起第二次请求
      await vi.advanceTimersByTimeAsync(100);
      expect(fetchMock).toHaveBeenCalledTimes(2);
      const res = await promise;
      const body = await res.json();
      expect(body.isFallback).toBe(false);
      expect(body.text).toBe("小猫");
    } finally {
      vi.useRealTimers();
    }
  });

  it("DeepSeek HTTP 错误时重试并降级", async () => {
    vi.stubEnv("DEEPSEEK_API_KEY", "sk-test");
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(new Response("server error", { status: 500 })) as never,
    );
    const res = await POST(
      makeReq({
        bankId: "bank-f",
        sortedChars: "小猫",
        themeWeights: JSON.stringify([
          { char: "小", weight: 5 },
          { char: "猫", weight: 30 },
        ]),
      }),
    );
    const body = await res.json();
    expect(body.isFallback).toBe(true);
    expect(body.text).toBe("猫");
  });

  it("未选择模型时使用内置默认模型，并在响应中回传 model", async () => {
    vi.stubEnv("DEEPSEEK_API_KEY", "sk-test");
    const chatBodies: string[] = [];
    const fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
      if (String(url).includes("/chat/completions")) chatBodies.push(String(init?.body));
      return aiResponse(GOOD);
    });
    vi.stubGlobal("fetch", fetchMock as never);

    const res = await POST(makeReq({ bankId: "bank-model-1", sortedChars: "小猫" }));
    const body = await res.json();
    expect(body.model).toBe(DEFAULT_MODEL);
    expect((JSON.parse(chatBodies[0]) as { model: string }).model).toBe(DEFAULT_MODEL);
  });

  it("环境变量 DEEPSEEK_MODEL 优先于内置默认", async () => {
    vi.stubEnv("DEEPSEEK_API_KEY", "sk-test");
    vi.stubEnv("DEEPSEEK_MODEL", "deepseek-v4-pro");
    const fetchMock = vi.fn().mockResolvedValue(aiResponse(GOOD));
    vi.stubGlobal("fetch", fetchMock as never);

    const res = await POST(makeReq({ bankId: "bank-model-2", sortedChars: "小猫" }));
    const body = await res.json();
    expect(body.model).toBe("deepseek-v4-pro");
  });

  it("家长手动选择的模型生效（每次请求读取最新选择）", async () => {
    vi.stubEnv("DEEPSEEK_API_KEY", "sk-test");
    writeState({ config: { ...readState().config, model: "deepseek-v4-pro" } });

    const chatBodies: string[] = [];
    const fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
      // 手动选择时先校验模型是否在账号可用列表中
      if (String(url).endsWith("/models")) {
        return new Response(
          JSON.stringify({ data: [{ id: "deepseek-v4-pro" }, { id: "deepseek-v4-flash" }] }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        );
      }
      chatBodies.push(String(init?.body));
      return aiResponse(GOOD);
    });
    vi.stubGlobal("fetch", fetchMock as never);

    const res = await POST(makeReq({ bankId: "bank-model-3", sortedChars: "小猫" }));
    const body = await res.json();
    expect(body.model).toBe("deepseek-v4-pro");
    expect((JSON.parse(chatBodies[0]) as { model: string }).model).toBe("deepseek-v4-pro");
  });

  it("手动选择的模型已下线时回退内置默认", async () => {
    vi.stubEnv("DEEPSEEK_API_KEY", "sk-test");
    writeState({ config: { ...readState().config, model: "deepseek-retired" } });

    const fetchMock = vi.fn(async (url: string) => {
      if (String(url).endsWith("/models")) {
        return new Response(JSON.stringify({ data: [{ id: "deepseek-v4-flash" }] }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      }
      return aiResponse(GOOD);
    });
    vi.stubGlobal("fetch", fetchMock as never);

    const res = await POST(makeReq({ bankId: "bank-model-4", sortedChars: "小猫" }));
    const body = await res.json();
    expect(body.model).toBe("deepseek-v4-flash");
  });
});
