"use client";

import { Suspense, useState, useCallback, useEffect, useMemo, useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { AnimatePresence } from "framer-motion";
import IdleState from "@/components/child/IdleState";
import LoadingState from "@/components/child/LoadingState";
import ResultState from "@/components/child/ResultState";
import BackButton from "@/components/child/BackButton";
import { findBankById, getMergedBankChars } from "@/lib/wordBanks";
import { loadConfig } from "@/lib/storage";
import type { WordBank } from "@/lib/types";
import { useWeightEngine } from "@/hooks/useWeightEngine";
import { useSound } from "@/hooks/useSound";
import { useStats } from "@/hooks/useStats";

type PageState = "idle" | "loading" | "result";

/** Suspense 包装器（useSearchParams 需要） */
export default function SentencePageWrapper() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center">
          <span className="text-gray-300 text-lg">加载中…</span>
        </div>
      }
    >
      <SentencePage />
    </Suspense>
  );
}

/**
 * 句子生成三态页 ⭐
 *
 * idle    → 仅大按钮 + 引导动效
 * loading → 火箭动画 + 文案轮换
 * result  → 句子展示 + 重生成按钮
 */
function SentencePage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const bankId = searchParams.get("bank") || "";
  const isComprehensive = bankId === "comprehensive";

  // 字库解析：综合字库 / 内置字库优先；内置找不到时（自定义字库）在 effect 中补查
  const [bank, setBank] = useState<WordBank | undefined>(() =>
    isComprehensive
      ? { id: "comprehensive", name: "综合", emoji: "📚", chars: getMergedBankChars() }
      : findBankById(bankId),
  );

  const { play } = useSound();
  const { recordCall } = useStats();

  const [state, setState] = useState<PageState>("idle");
  const [sentence, setSentence] = useState("");
  const [usedChars, setUsedChars] = useState<string[]>([]);
  const [isFallback, setIsFallback] = useState(false);
  const [isDirectShow, setIsDirectShow] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  // 当前会话连续生成计数
  const [consecutiveCount, setConsecutiveCount] = useState(0);

  // 请求生命周期管理（见 handleGenerate）：
  // - generatingRef：防重入，快速连点只触发一次
  // - requestSeqRef：请求序号，用于丢弃过期响应
  // - abortRef：可取消在途请求（重新生成 / 15s 超时兜底）
  const generatingRef = useRef(false);
  const requestSeqRef = useRef(0);
  const abortRef = useRef<AbortController | null>(null);

  // 权重引擎
  // useMemo：bank 为空时 `|| []` 会每次渲染新建数组，导致依赖它的 useCallback 每次重建
  const chars = useMemo(() => bank?.chars || [], [bank]);
  const weightEngine = useWeightEngine(bankId, chars);

  // 解析字库：内置找不到时查自定义字库；都没有则跳回选择页
  useEffect(() => {
    if (isComprehensive || bank) return;
    const custom = (loadConfig().customBanks || []).find((b) => b.id === bankId);
    if (custom) {
      setBank(custom);
    } else {
      router.push("/child");
    }
  }, [isComprehensive, bank, bankId, router]);

  // 客户端日志
  function clientLog(...args: unknown[]) {
    const time = new Date().toISOString().slice(11, 23);
    console.log(`[${time}] [client]`, ...args);
  }

  // 生成句子
  //
  // 请求生命周期管理：
  // - generatingRef 防重入：快速连点只触发一次
  // - requestSeqRef + isCurrent()：丢弃过期响应（重新生成后，旧请求的迟到结果不再覆盖界面）
  // - abortRef：可取消在途请求（重新生成 / 15s 超时兜底），防止超时后句子"迟到"出现
  const handleGenerate = useCallback(async () => {
    // 防重入：已有请求在途时忽略本次点击
    if (generatingRef.current) {
      clientLog("⏸ 已有请求在途，忽略本次点击");
      return;
    }
    generatingRef.current = true;

    // 新一轮请求：取消上一轮未完成的请求，并记录本请求序号
    const requestId = ++requestSeqRef.current;
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    const isCurrent = () => requestId === requestSeqRef.current;

    try {
      // 先设 loading，再检查 bank，确保无论什么路径 loading 状态都生效
      setState("loading");
      play("rocket");
      if (!bank) {
        clientLog("❌ bank 为空，无法生成");
        setTimeout(() => setState("idle"), 500);
        return;
      }

      clientLog("===== 开始生成 =====");
      clientLog("字库:", bankId, bank.name);
      clientLog("字库汉字:", bank.chars);
      // 获取权重数据
      const weightData = weightEngine.getWeightData();
      clientLog("当前权重:", weightData.chars.map((c) => `${c.char}:${c.weight}`).join(", "));
      clientLog("当前轮次:", weightData.round);

      const weightChars = new Set(weightData.chars.map((c) => c.char));
      const missing = chars.filter((c) => !weightChars.has(c));
      const extra = weightData.chars.filter((c) => !chars.includes(c.char)).map((c) => c.char);
      if (missing.length > 0) clientLog("⚠️ 权重中缺少的字:", missing);
      if (extra.length > 0) clientLog("⚠️ 权重中多余的字:", extra);

      // 直示检查：存在超过阈值的字 → 跳过 API，直接展示单字
      const directChar = weightEngine.getDirectShowChar();
      if (directChar) {
        clientLog(`🌟 单字直示: "${directChar}"`);
        play("success");
        setSentence(directChar);
        setUsedChars([directChar]);
        setIsFallback(false);
        setIsDirectShow(true);
        weightEngine.update(new Set([directChar]));
        weightEngine.markDirectShown();
        recordCall(directChar, bankId, [directChar]);
        setConsecutiveCount((c) => c + 1);
        const afterWeight = weightEngine.getWeightData();
        clientLog("更新后权重:", afterWeight.chars.map((c) => `${c.char}:${c.weight}`).join(", "));
        setState("result");
        return;
      }

      const sortedChars = weightEngine.getSortedChars();
      const themeWeights = JSON.stringify(
        weightData.chars.map((c) => ({ char: c.char, weight: c.weight })),
      );
      clientLog("加权排序:", sortedChars);
      clientLog("权重JSON:", themeWeights);

      const startTime = Date.now();

      const res = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          bankId,
          sortedChars: sortedChars,
          themeWeights,
        }),
        signal: controller.signal,
      });

      const elapsed = Date.now() - startTime;
      clientLog(`API 耗时: ${elapsed}ms, 状态码: ${res.status}`);

      const data = (await res.json()) as {
        text?: string;
        usedChars?: string[];
        extraChars?: string[];
        isFallback?: boolean;
        error?: string;
      };

      // 过期响应丢弃：期间已发起新一轮请求（如重新生成），本次结果作废
      if (!isCurrent()) {
        clientLog("⏹ 响应已过期（新一轮请求已发起），丢弃");
        return;
      }

      clientLog("API 响应:", data);

      if (res.ok && data.text) {
        clientLog(`✅ 生成成功: "${data.text}"`);
        clientLog(`用字:`, data.usedChars);
        clientLog(`是否保底句: ${data.isFallback}`);

        play("success");
        setSentence(data.text);
        setUsedChars(data.usedChars || []);
        setIsFallback(data.isFallback || false);

        // 更新权重
        const usedSet = new Set<string>(data.usedChars || []);
        weightEngine.update(usedSet);

        // 更新后权重
        const afterWeight = weightEngine.getWeightData();
        clientLog("更新后权重:", afterWeight.chars.map((c) => `${c.char}:${c.weight}`).join(", "));

        // 记录统计
        recordCall(data.text, bankId, data.usedChars || []);

        // 连续计数 +1
        setConsecutiveCount((c) => c + 1);

        setState("result");
      } else {
        clientLog(`❌ 请求失败: ${data.error || "未知错误"}`);
        throw new Error(data.error || "生成失败");
      }
    } catch (err) {
      if (controller.signal.aborted) {
        // 主动取消（重新生成 / 15s 超时）：不改变状态，提示已由对应逻辑处理
        clientLog("⏹ 请求已取消（超时或重新生成）");
        return;
      }
      clientLog(`💥 异常:`, err instanceof Error ? err.message : err);
      play("error");
      setErrorMsg("哎呀，出错了！");
      setState("idle");
    } finally {
      // 仅当没有更新请求接管时清理（新请求的 finally 会负责自己的清理）
      if (abortRef.current === controller) {
        abortRef.current = null;
        generatingRef.current = false;
      }
    }
    // chars 由 bank 派生，与 bank 同变；显式列出满足 exhaustive-deps
  }, [bank, bankId, weightEngine, play, recordCall, chars]);

  // 安全兜底：loading 超过 15 秒强制回到 idle
  useEffect(() => {
    if (state !== "loading") return;
    const timer = setTimeout(() => {
      clientLog("⏰ 加载超时（15s），强制回到 idle");
      abortRef.current?.abort(); // 取消在途请求，防止迟到响应覆盖界面
      play("error");
      setErrorMsg("小脑袋想太久了，再试一次吧！");
      setState("idle");
    }, 15000);
    return () => clearTimeout(timer);
  }, [state, play]);

  // 加载超时（传递给 LoadingState 的 12s 超时 UI 反馈）
  const handleTimeout = useCallback(() => {
    clientLog("⏰ LoadingState 12s 超时");
    play("error");
    setErrorMsg("小脑袋想太久了，再试一次吧！");
    setState("idle");
  }, [play]);

  // 再来一句：清空旧数据，直接重新生成
  const handleRegenerate = useCallback(() => {
    setSentence("");
    setUsedChars([]);
    setIsFallback(false);
    setIsDirectShow(false);
    setErrorMsg("");
    setState("loading");
    handleGenerate();
  }, [handleGenerate]);

  if (!bank) return null;

  return (
    <div className="relative min-h-screen">
      <BackButton href="/child" />

      {/* 错误提示 */}
      {errorMsg && state === "idle" && (
        <div className="absolute top-24 left-0 right-0 text-center z-10">
          <p className="inline-block bg-red-50 text-red-400 px-6 py-2 rounded-full text-sm">
            {errorMsg}
          </p>
        </div>
      )}

      <AnimatePresence mode="wait">
        {state === "idle" && (
          <IdleState key="idle" onGenerate={handleGenerate} consecutiveCount={consecutiveCount} />
        )}
        {state === "loading" && <LoadingState key="loading" onTimeout={handleTimeout} />}
        {state === "result" && (
          <ResultState
            key="result"
            text={sentence}
            usedChars={usedChars}
            isFallback={isFallback}
            isDirectShow={isDirectShow}
            consecutiveCount={consecutiveCount}
            onRegenerate={handleRegenerate}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
