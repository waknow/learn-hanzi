/**
 * 模型管理 API
 *
 * GET  /api/model  → 账号可用模型列表 + 当前生效模型（自动获取，带缓存与降级）
 * PUT  /api/model  → 保存家长的手动选择（body: { model: string }，空串 = 自动）
 *
 * 说明：模型选择持久化在 data/state.json 的 config.model，
 * 句子生成时由 /api/generate 读取（见 lib/server/modelStore.ts）。
 */

import { NextResponse } from "next/server";
import { clearModelCache, getModelList, saveSelectedModel } from "@/lib/server/modelStore";

// 强制动态执行：模型列表与当前选择随时可能变化，禁止静态缓存
export const dynamic = "force-dynamic";

/**
 * GET /api/model
 * ?refresh=1 时跳过缓存重新向上游拉取
 * → 200 { models, current, currentSource, selected, listSource, hasApiKey, error, fetchedAt }
 */
export async function GET(req: Request) {
  const url = new URL(req.url);
  if (url.searchParams.get("refresh") === "1") {
    clearModelCache();
  }
  const result = await getModelList();
  return NextResponse.json(result);
}

/**
 * PUT /api/model
 * body: { model: string }  // "" = 自动（env → 内置默认）
 * → 200 { ok: true, ...模型列表结果 }
 */
export async function PUT(req: Request) {
  let body: { model?: unknown };
  try {
    body = (await req.json()) as { model?: unknown };
  } catch {
    return NextResponse.json(
      { ok: false, error: "invalid_body", message: "请求体格式不正确" },
      { status: 400 },
    );
  }

  const model = body?.model;
  if (typeof model !== "string") {
    return NextResponse.json(
      { ok: false, error: "invalid_model", message: "model 必须是字符串" },
      { status: 400 },
    );
  }

  try {
    const result = await saveSelectedModel(model);
    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    if (err instanceof Error && err.message === "invalid_model") {
      return NextResponse.json(
        { ok: false, error: "invalid_model", message: "模型 id 格式不正确" },
        { status: 400 },
      );
    }
    return NextResponse.json(
      { ok: false, error: "server_error", message: "保存模型失败" },
      { status: 500 },
    );
  }
}
