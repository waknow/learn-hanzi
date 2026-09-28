"use client";

import { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { motion } from "framer-motion";

import { useBanks } from "@/hooks/useBanks";
import { saveBanks } from "@/lib/storage";
import {
  addBankChars,
  extractHanziChars,
  getActiveChars,
  getDisabledChars,
  isBuiltinChar,
  removeBankChars,
  setBankCharsEnabled,
} from "@/lib/banks";
import type { BankRecord } from "@/lib/types";

type Filter = "all" | "active" | "disabled";

const FILTERS: { id: Filter; label: string }[] = [
  { id: "all", label: "全部" },
  { id: "active", label: "生效" },
  { id: "disabled", label: "已禁用" },
];

/** 空字库占位（保证 useMemo 依赖稳定，不每次渲染新建对象） */
const EMPTY_BANK: Pick<BankRecord, "chars" | "disabledChars"> = { chars: [], disabledChars: [] };

/**
 * 字库内容维护页 —— 添加 / 删除 / 禁用汉字
 *
 * 规则（与 lib/banks.ts 的纯函数一致）：
 * - 内置字库里来自初始化默认值的「内置字」只能禁用，不能删除
 * - 家长新增到内置字库的字、以及自定义字库里的字都可以删除
 * - 禁用只是把字从"生效字"里摘掉：字仍在字库中，可随时重新启用
 * - 每个字库至少要保留 1 个生效字，避免留下用不了的空字库
 */
function BankContentPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const bankId = searchParams.get("bank") || "";

  const { ready, items } = useBanks();
  // 本地草稿：改动立即写回镜像并驱动重渲染（与设置页 commitBanks 同一策略）
  const [draftItems, setDraftItems] = useState<BankRecord[] | null>(null);
  const [input, setInput] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  const [notice, setNotice] = useState("");

  const banks = draftItems ?? items;
  const bank = useMemo(() => banks.find((b) => b.id === bankId), [banks, bankId]);

  // 就绪后仍找不到字库 → 回到设置页（就绪前 items 为空，此时跳转会误伤冷启动）
  useEffect(() => {
    if (ready && !bank) router.push("/parent/settings");
  }, [ready, bank, router]);

  const activeChars = useMemo(() => getActiveChars(bank ?? EMPTY_BANK), [bank]);
  const disabledChars = useMemo(() => getDisabledChars(bank ?? EMPTY_BANK), [bank]);
  const activeSet = useMemo(() => new Set(activeChars), [activeChars]);

  const replaceBank = useCallback(
    (next: BankRecord) => {
      const merged = banks.map((b) => (b.id === next.id ? next : b));
      setDraftItems(merged);
      saveBanks({ items: merged });
    },
    [banks],
  );

  // 添加：新字追加到末尾；已在字库但被禁用的字会被重新启用
  const handleAdd = () => {
    if (!bank) return;
    const parsed = extractHanziChars(input);
    if (parsed.length === 0) {
      setNotice("请输入汉字（只支持汉字）");
      return;
    }
    const result = addBankChars(bank, parsed);
    if (!result.changed) {
      setNotice("这些字都已经在字库里了");
      return;
    }
    replaceBank(result.bank);
    setInput("");
    const parts: string[] = [];
    if (result.added.length > 0)
      parts.push(`新增 ${result.added.length} 字：${result.added.join("")}`);
    if (result.restored.length > 0)
      parts.push(`重新启用 ${result.restored.length} 字：${result.restored.join("")}`);
    setNotice(parts.join("；"));
  };

  // 禁用 / 启用：单字
  const handleToggle = (char: string, enabled: boolean) => {
    if (!bank) return;
    const result = setBankCharsEnabled(bank, [char], enabled);
    if (!result.changed) {
      setNotice("至少要保留 1 个生效的汉字");
      return;
    }
    replaceBank(result.bank);
    setNotice(enabled ? `已启用「${char}」` : `已禁用「${char}」`);
  };

  // 批量启用 / 禁用
  const handleToggleAll = (enabled: boolean) => {
    if (!bank) return;
    const targets = enabled ? disabledChars : activeChars;
    if (targets.length === 0) {
      setNotice(enabled ? "没有已禁用的汉字" : "没有生效的汉字");
      return;
    }
    const result = setBankCharsEnabled(bank, targets, enabled);
    if (!result.changed) {
      setNotice("至少要保留 1 个生效的汉字");
      return;
    }
    replaceBank(result.bank);
    setNotice(
      enabled ? `已启用 ${result.toggled.length} 字` : `已禁用 ${result.toggled.length} 字`,
    );
  };

  // 删除：内置字拒绝，其余二次确认
  const handleDelete = (char: string) => {
    if (!bank) return;
    if (isBuiltinChar(bank, char)) {
      setNotice("内置字不能删除，只能禁用");
      return;
    }
    if (!confirm(`确定要从「${bank.name}」删除「${char}」吗？`)) return;
    const result = removeBankChars(bank, [char]);
    if (!result.changed) {
      setNotice(
        result.rejected.length > 0 ? "内置字不能删除，只能禁用" : "至少要保留 1 个生效的汉字",
      );
      return;
    }
    replaceBank(result.bank);
    setNotice(`已删除「${char}」`);
  };

  if (!ready) {
    return (
      <div className="min-h-screen flex items-center justify-center text-gray-300 text-lg">
        加载中…
      </div>
    );
  }

  if (!bank) return null;

  const visibleChars = bank.chars.filter((char) => {
    if (filter === "all") return true;
    return filter === "active" ? activeSet.has(char) : !activeSet.has(char);
  });

  return (
    <div className="min-h-screen bg-gradient-to-b from-candy-purple/10 to-candy-sky/10 p-6 pb-32">
      {/* 顶部导航 */}
      <div className="flex items-center justify-between mb-6">
        <button
          onClick={() => router.push("/parent/settings")}
          className="text-gray-400 text-lg"
          aria-label="返回字库管理"
        >
          ← 字库管理
        </button>
        <h1 className="text-2xl font-cartoon text-gray-700">
          {bank.emoji} {bank.name}
        </h1>
        <div className="w-8" />
      </div>

      {/* 概览 */}
      <motion.div
        initial={{ y: 20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        className="bg-white rounded-3xl shadow-sm p-4 mb-6 flex items-center justify-around text-center"
      >
        <div>
          <div className="text-2xl font-cartoon text-gray-700">{bank.chars.length}</div>
          <div className="text-xs text-gray-400">共</div>
        </div>
        <div>
          <div className="text-2xl font-cartoon text-candy-green">{activeChars.length}</div>
          <div className="text-xs text-gray-400">生效</div>
        </div>
        <div>
          <div className="text-2xl font-cartoon text-gray-400">{disabledChars.length}</div>
          <div className="text-xs text-gray-400">已禁用</div>
        </div>
      </motion.div>

      {/* 添加汉字 */}
      <motion.div
        initial={{ y: 20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.05 }}
        className="mb-6"
      >
        <h2 className="text-gray-500 font-cartoon mb-3">➕ 添加汉字</h2>
        <div className="flex gap-3">
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") handleAdd();
            }}
            className="flex-1 px-4 py-3 rounded-2xl bg-white text-gray-700 text-lg shadow-sm"
            placeholder="输入汉字，如：熊猫老虎"
            maxLength={50}
            aria-label="要添加的汉字"
          />
          <button
            onClick={handleAdd}
            className="px-6 py-3 rounded-2xl bg-candy-green text-white text-lg active:scale-95 transition-transform"
          >
            添加
          </button>
        </div>
        <p className="text-xs text-gray-400 mt-2">
          {bank.origin === "builtin"
            ? "内置字库可以补充新字；补充后该字库不再随版本升级自动更新"
            : "只支持汉字，重复的字会自动忽略"}
        </p>
        {notice && (
          <p className="text-sm text-candy-teal mt-2" role="status">
            {notice}
          </p>
        )}
      </motion.div>

      {/* 汉字列表 */}
      <motion.div
        initial={{ y: 20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.1 }}
      >
        <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
          <h2 className="text-gray-500 font-cartoon">📝 字库内容</h2>
          <div className="flex items-center gap-2">
            {FILTERS.map((f) => (
              <button
                key={f.id}
                onClick={() => setFilter(f.id)}
                className={`px-3 py-1.5 rounded-full text-sm active:scale-95 transition-transform ${
                  filter === f.id
                    ? "bg-candy-purple text-white"
                    : "bg-white text-gray-500 shadow-sm"
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>
        </div>

        <div className="flex gap-3 mb-4">
          <button
            onClick={() => handleToggleAll(false)}
            className="flex-1 py-2.5 rounded-2xl bg-white shadow-sm text-gray-500 text-sm active:scale-95 transition-transform"
          >
            全部禁用
          </button>
          <button
            onClick={() => handleToggleAll(true)}
            className="flex-1 py-2.5 rounded-2xl bg-white shadow-sm text-gray-500 text-sm active:scale-95 transition-transform"
          >
            全部启用
          </button>
        </div>

        {bank.chars.length === 0 ? (
          <p className="text-gray-300 text-sm text-center py-10">
            这个字库还没有汉字，用上面的输入框添加
          </p>
        ) : visibleChars.length === 0 ? (
          <p className="text-gray-300 text-sm text-center py-10">没有符合条件的汉字</p>
        ) : (
          <div className="grid grid-cols-4 md:grid-cols-6 gap-3">
            {visibleChars.map((char) => {
              const enabled = activeSet.has(char);
              const builtin = isBuiltinChar(bank, char);
              return (
                <motion.div layout key={char} className="relative">
                  <button
                    onClick={() => handleToggle(char, !enabled)}
                    title={`${enabled ? "点击禁用" : "点击启用"}${builtin ? "（内置字不可删除）" : ""}`}
                    aria-label={`${enabled ? "禁用" : "启用"}${char}`}
                    className={`w-full aspect-square rounded-2xl flex flex-col items-center justify-center gap-1 shadow-sm active:scale-95 transition-transform ${
                      enabled ? "bg-white text-gray-700" : "bg-gray-100 text-gray-300"
                    }`}
                  >
                    <span className="text-2xl">{char}</span>
                    <span className="text-[10px]">{enabled ? "生效" : "已禁用"}</span>
                  </button>
                  {builtin && (
                    <span
                      className="absolute -top-1 -left-1 w-5 h-5 rounded-full bg-white shadow-sm
                                 flex items-center justify-center text-[10px] text-gray-300"
                      title="内置字：只能禁用，不能删除"
                      aria-hidden="true"
                    >
                      🔒
                    </span>
                  )}
                  {!builtin && (
                    <button
                      onClick={() => handleDelete(char)}
                      aria-label={`删除${char}`}
                      title="从字库删除"
                      className="absolute -top-1 -right-1 w-6 h-6 rounded-full bg-white shadow-sm
                                 flex items-center justify-center text-xs text-red-400
                                 active:scale-90 transition-transform"
                    >
                      🗑
                    </button>
                  )}
                </motion.div>
              );
            })}
          </div>
        )}

        <p className="text-xs text-gray-400 mt-4 leading-relaxed">
          {bank.origin === "builtin"
            ? "🔒 带「内置」标记的字来自应用内置字库，只能禁用、不能删除；你自己添加的字可以删除。"
            : "自定义字库里的汉字都可以删除。"}
        </p>
      </motion.div>
    </div>
  );
}

export default function ParentBanksPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center text-gray-300 text-lg">
          加载中…
        </div>
      }
    >
      <BankContentPage />
    </Suspense>
  );
}
