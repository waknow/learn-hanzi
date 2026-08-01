import { NextResponse } from "next/server";
import { readState, writeState } from "@/lib/server/stateStore";

// 强制动态执行，避免 GET 被静态缓存导致读不到最新数据
export const dynamic = "force-dynamic";

/**
 * GET /api/state
 * → 200 { weightData, stats, config, updatedAt }
 */
export async function GET() {
  return NextResponse.json(readState());
}

/**
 * PUT /api/state
 * body: { weightData?, stats?, config? }  // 局部更新，只传有变化的块
 * → 200 { ok: true, updatedAt }
 */
export async function PUT(req: Request) {
  try {
    const body = (await req.json()) as {
      weightData?: unknown;
      stats?: unknown;
      config?: unknown;
    };
    const state = writeState({
      weightData: body?.weightData as never,
      stats: body?.stats as never,
      config: body?.config as never,
    });
    return NextResponse.json({ ok: true, updatedAt: state.updatedAt });
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: "invalid_body", message: "请求体格式不正确" },
      { status: 400 },
    );
  }
}
