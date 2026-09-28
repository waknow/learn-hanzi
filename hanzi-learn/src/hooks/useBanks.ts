"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import { findBank, getEnabledBanks, mergeBankChars } from "@/lib/banks";
import { loadBanks } from "@/lib/storage";
import type { BankRecord, BanksSection } from "@/lib/types";

/**
 * 词库数据源 Hook
 *
 * 数据来自浏览器镜像（服务端 data/banks.json 的副本）。镜像为空时 loadBanks()
 * 会用初始化默认值做一次本地初始化，因此离线首启也不会白屏。
 *
 * ⚠️ ready 用于门控跳转：就绪前 items 可能为空，不能据此判断"字库不存在"。
 */
export function useBanks() {
  const [section, setSection] = useState<BanksSection | null>(null);
  const [ready, setReady] = useState(false);

  const refresh = useCallback(() => {
    setSection(loadBanks());
    setReady(true);
  }, []);

  useEffect(() => {
    refresh();
    // 服务端同步完成后刷新（跨设备改字库后立即生效）
    window.addEventListener("hanzi-state-synced", refresh);
    return () => window.removeEventListener("hanzi-state-synced", refresh);
  }, [refresh]);

  const items = useMemo<BankRecord[]>(() => section?.items ?? [], [section]);
  const enabledBanks = useMemo(() => getEnabledBanks(items), [items]);

  const find = useCallback((id: string) => findBank(items, id), [items]);
  const merged = useCallback(
    (opts?: { enabledOnly?: boolean }) => mergeBankChars(items, opts),
    [items],
  );

  return { section, items, enabledBanks, ready, refresh, findBank: find, mergedChars: merged };
}
