import { NextResponse } from "next/server";
import { readState, writeState } from "@/lib/server/stateStore";

// 强制动态执行，避免 GET 被静态缓存导致读不到最新数据
export const dynamic = "force-dynamic";

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/**
 * GET /api/state
 * → 200 { schemaVersion, config, stats, banks, updatedAt, updatedAtByPart }
 *
 * 顺带完成 E1 初始化 / E3 升级补种（幂等）：文件缺失或内置字库版本变化时会落盘。
 */
export async function GET() {
  return NextResponse.json(readState());
}

/**
 * PUT /api/state
 * body: { config?, stats?, banks?, progress? }  // 局部更新，只传有变化的块
 *   兼容 v1 旧客户端：weightData 会自动映射到 stats.progress
 * → 200 { ok: true, updatedAt, updatedAtByPart }
 */
export async function PUT(req: Request) {
  let body: Record<string, unknown>;
  try {
    const parsed = await req.json();
    if (!isObject(parsed)) throw new Error("invalid_body");
    body = parsed;
  } catch {
    return NextResponse.json(
      { ok: false, error: "invalid_body", message: "请求体格式不正确" },
      { status: 400 },
    );
  }

  try {
    const state = writeState({
      config: body.config,
      stats: body.stats,
      banks: body.banks,
      progress: body.progress,
      weightData: body.weightData,
      progressMode: body.progressMode,
    });
    return NextResponse.json({
      ok: true,
      updatedAt: state.updatedAt,
      updatedAtByPart: state.updatedAtByPart,
    });
  } catch (err) {
    console.error("[state] 写入失败:", err instanceof Error ? err.message : err);
    return NextResponse.json(
      { ok: false, error: "server_error", message: "状态写入失败" },
      { status: 500 },
    );
  }
}
