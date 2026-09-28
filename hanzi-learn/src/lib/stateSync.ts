/**
 * 客户端启动同步（服务端三个分区文件 ←→ 浏览器镜像）
 *
 * 应用挂载时（以及 iPad 从后台切回时）调用 syncOnce()：
 * 1. **先推后拉**：把本地未同步的改动推上去，避免随后拉取的服务端旧值把它覆盖
 * 2. 首次同步且本地有用户数据、服务端没有 → 推本地（老用户平滑迁移）
 * 3. 其余情况 → 以服务端为准，**按分区时间戳**比较后只覆盖服务端更新的那份
 *
 * 网络失败时静默，保持本地缓存可用，下次挂载/聚焦/网络恢复自动重试。
 */

import {
  loadBanks,
  loadConfig,
  loadStats,
  saveBanks,
  saveConfig,
  saveStats,
  flushServerSync,
  withSuppressedServerSync,
} from "./storage";
import { hasUserData, type PartialState } from "./stateShape";
import type { AppState } from "./types";

/** 已完成 v2 同步的标记（升版以便老用户重新评估一次首迁移） */
export const SYNCED_FLAG = "hanzi_state_synced_v2";

/** 在途同步合并：并发触发（挂载 + 聚焦）只跑一次 */
let inflight: Promise<void> | null = null;

/**
 * 与服务端同步一次。幂等，可在应用挂载 / 窗口重新可见时安全调用。
 */
export async function syncOnce(): Promise<void> {
  if (typeof window === "undefined") return;
  if (inflight) return inflight;

  inflight = runSync().finally(() => {
    inflight = null;
  });
  return inflight;
}

async function runSync(): Promise<void> {
  try {
    // 1) 先把积压的本地改动推上去（离线期间的改动可能还在队列里）
    flushServerSync();

    const res = await fetch("/api/state", { cache: "no-store" });
    if (!res.ok) return;
    const state = (await res.json()) as Partial<AppState>;

    const local = localState();
    const alreadySynced = localStorage.getItem(SYNCED_FLAG) === "1";

    // 2) 首次迁移：本地有用户数据、服务端没有 → 推本地
    if (!alreadySynced && hasUserData(local) && !hasUserData(state)) {
      await pushLocal(local);
      localStorage.setItem(SYNCED_FLAG, "1");
      return;
    }

    // 3) 服务端为准（按分区时间戳；抑制回写避免无意义 PUT）
    withSuppressedServerSync(() => applyServerState(state));
    localStorage.setItem(SYNCED_FLAG, "1");
  } catch {
    // 网络失败：保持本地缓存，静默，下次挂载/聚焦重试
  }
}

/** 本地镜像的"用户数据"视图（首次迁移判定用） */
function localState(): PartialState {
  return { config: loadConfig(), stats: loadStats(), banks: loadBanks() };
}

/** 把本地镜像推送到服务端（只推真的有内容的块） */
async function pushLocal(local: PartialState): Promise<void> {
  const payload: Record<string, unknown> = {};
  if (hasUserData({ config: local.config })) payload.config = local.config;
  if (hasUserData({ stats: local.stats })) payload.stats = local.stats;
  if (hasUserData({ banks: local.banks })) payload.banks = local.banks;
  if (Object.keys(payload).length === 0) return;

  await fetch("/api/state", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
}

/** 服务端该分区是否比本地镜像新（无时间戳时不覆盖，宁可保留本地） */
function serverIsNewer(serverTime: string | null | undefined, localTime: string | null): boolean {
  if (!serverTime) return false;
  if (!localTime) return true;
  return serverTime >= localTime;
}

/** 用服务端数据覆盖本地镜像（分区级：只覆盖服务端更新的那份） */
function applyServerState(state: Partial<AppState>): void {
  const timeOf = (part: "config" | "stats" | "banks"): string | null =>
    state.updatedAtByPart?.[part] ?? state.updatedAt ?? null;

  if (state.config && serverIsNewer(timeOf("config"), loadConfig().updatedAt)) {
    saveConfig(state.config);
  }
  if (state.stats && serverIsNewer(timeOf("stats"), loadStats().updatedAt)) {
    saveStats(state.stats);
  }
  if (state.banks && serverIsNewer(timeOf("banks"), loadBanks().updatedAt)) {
    saveBanks(state.banks);
  }
}
