// @vitest-environment node
/**
 * /api/generate 路由测试
 *
 * 覆盖：缺参 400、无 Key 保底、AI 校验链（越界/敏感词/低分重试）、
 * 3 次全败降级、HTTP 错误降级、评分后缀剥离。
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import fs from "fs";
import os from "os";
import path from "path";
import { POST } from "./route";

let tmpDir: string;
beforeEach(() => {
  vi.spyOn(console, "log").mockImplementation(() => {});
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "hanzi-api-gen-"));
  vi.stubEnv("STATE_FILE", path.join(tmpDir, "state.json"));
});
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

  it("评分过低触发重试", async () => {
    vi.stubEnv("DEEPSEEK_API_KEY", "sk-test");
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(aiResponse("小猫【自然程度-4 口语化-4 完整度-4】"))
      .mockResolvedValueOnce(aiResponse(GOOD));
    vi.stubGlobal("fetch", fetchMock as never);
    const res = await POST(makeReq({ bankId: "bank-d", sortedChars: "小猫" }));
    const body = await res.json();
    expect(body.isFallback).toBe(false);
    expect(body.text).toBe("小猫");
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
});
