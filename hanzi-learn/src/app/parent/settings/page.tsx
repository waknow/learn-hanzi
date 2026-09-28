"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import {
  loadConfig,
  loadWeightData,
  replaceWeightData,
  saveBanks,
  saveConfig,
  saveStats,
} from "@/lib/storage";
import { useBanks } from "@/hooks/useBanks";
import { getActiveChars, getDisabledChars } from "@/lib/banks";
import ModelSelector from "@/components/parent/ModelSelector";
import type { BankRecord, ConfigSection, WordBank } from "@/lib/types";

/** 设置管理页 */
export default function SettingsPage() {
  const router = useRouter();
  const [config, setConfig] = useState<ConfigSection | null>(null);
  // 字库来自数据源（banks.json 的镜像）；draftBanks 是本地草稿，改动后立即写回并驱动重渲染
  const { items: bankItems, ready: banksReady } = useBanks();
  const [draftBanks, setDraftBanks] = useState<BankRecord[] | null>(null);
  const [showCustomEditor, setShowCustomEditor] = useState(false);
  const [editBank, setEditBank] = useState<WordBank | null>(null);
  const [editName, setEditName] = useState("");
  const [editEmoji, setEditEmoji] = useState("");
  const [editChars, setEditChars] = useState("");
  const [passwordModal, setPasswordModal] = useState(false);
  const [oldPwd, setOldPwd] = useState("");
  const [newPwd, setNewPwd] = useState("");
  const [confirmPwd, setConfirmPwd] = useState("");

  useEffect(() => {
    setConfig(loadConfig());
  }, []);

  const banks = draftBanks ?? bankItems;
  const enabledBanks = banks.filter((b) => b.enabled);
  const disabledBanks = banks.filter((b) => !b.enabled);
  const customBanks = banks.filter((b) => b.origin === "custom");

  if (!config || !banksReady) return null;

  /** 写入新配置（不可变更新，state 即唯一真相，无需回读 localStorage） */
  const commit = (next: ConfigSection) => {
    setConfig(next);
    saveConfig(next);
  };

  /** 写入字库分区（不可变更新） */
  const commitBanks = (next: BankRecord[]) => {
    setDraftBanks(next);
    saveBanks({ items: next });
  };

  // 切换启用/禁用：v2 起每个字库自带 enabled 字段，
  // 不再有 v1 那套"enabledBanks 为空数组 = 全部启用"的约定与展开技巧
  const toggleBank = (id: string) => {
    commitBanks(banks.map((bank) => (bank.id === id ? { ...bank, enabled: !bank.enabled } : bank)));
  };

  // 重置权重
  const resetWeights = () => {
    if (!confirm("确定要重置所有字的权重吗？")) return;
    // 用 replaceWeightData：显式要求服务端整体覆盖，否则重置会被"按 bankId 合并"吃掉
    replaceWeightData({});
    alert("权重已重置");
  };

  // 清除学习记录
  const clearStats = () => {
    if (!confirm("确定要清除所有学习记录吗？此操作不可恢复！")) return;
    saveStats({
      totalCalls: 0,
      todayCalls: 0,
      todayDate: "",
      weeklyCalls: 0,
      history: {},
      sentenceHistory: [],
      charUsage: {},
      progress: {},
    });
    alert("学习记录已清除");
  };

  // 打开自定义字库编辑
  const openEditor = (bank?: WordBank) => {
    if (bank) {
      setEditBank(bank);
      setEditName(bank.name);
      setEditEmoji(bank.emoji);
      setEditChars(bank.chars.join(""));
    } else {
      setEditBank(null);
      setEditName("");
      setEditEmoji("📦");
      setEditChars("");
    }
    setShowCustomEditor(true);
  };

  // 保存自定义字库
  const saveCustom = () => {
    if (!editName || !editChars) {
      alert("请输入字库名称和汉字");
      return;
    }
    const chars = Array.from(new Set(editChars.split("").filter((c) => /[\u4e00-\u9fff]/.test(c))));
    if (chars.length < 2) {
      alert("至少需要 2 个汉字");
      return;
    }

    if (editBank) {
      // 编辑（不可变更新）
      commitBanks(
        banks.map((b) =>
          b.id === editBank.id ? { ...b, name: editName, emoji: editEmoji, chars } : b,
        ),
      );
    } else {
      // 新增
      const now = new Date().toISOString();
      const newBank: BankRecord = {
        id: `custom_${Date.now()}`,
        name: editName,
        emoji: editEmoji,
        chars,
        origin: "custom",
        enabled: true,
        createdAt: now,
        updatedAt: now,
      };
      commitBanks([...banks, newBank]);
    }

    setShowCustomEditor(false);
  };

  // 删除自定义字库
  const deleteCustom = (id: string) => {
    if (!confirm("确定要删除这个自定义字库吗？")) return;
    commitBanks(banks.filter((b) => b.id !== id));

    // 同步清理该字库的权重进度，避免留下孤儿数据
    const progress = loadWeightData();
    if (progress[id]) {
      const next = { ...progress };
      delete next[id];
      replaceWeightData(next);
    }
  };

  // 修改密码
  const changePassword = () => {
    if (oldPwd !== config.password) {
      alert("旧密码错误");
      return;
    }
    if (newPwd.length !== 4 || confirmPwd.length !== 4) {
      alert("密码必须是 4 位数字");
      return;
    }
    if (newPwd !== confirmPwd) {
      alert("两次密码不一致");
      return;
    }
    commit({ ...config, password: newPwd });
    setPasswordModal(false);
    setOldPwd("");
    setNewPwd("");
    setConfirmPwd("");
    alert("密码已修改");
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-candy-purple/10 to-candy-sky/10 p-6 pb-32">
      {/* 顶部导航 */}
      <div className="flex items-center justify-between mb-8">
        <button onClick={() => router.push("/parent/dashboard")} className="text-gray-400 text-lg">
          ← 统计
        </button>
        <h1 className="text-2xl font-cartoon text-gray-700">⚙️ 字库管理</h1>
        <div className="w-8" />
      </div>

      {/* AI 模型（自动获取 + 手动切换） */}
      <motion.div initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} className="mb-6">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-gray-500 font-cartoon">🤖 AI 模型</h2>
          <span className="text-xs text-gray-300">切换后下次生成即生效</span>
        </div>
        <ModelSelector />
      </motion.div>

      {/* 已启用 */}
      <motion.div initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} className="mb-6">
        <h2 className="text-gray-500 font-cartoon mb-3">已启用字库</h2>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          {enabledBanks.map((bank) => (
            <BankToggleCard
              key={bank.id}
              bank={bank}
              enabled={true}
              onToggle={() => toggleBank(bank.id)}
              onContent={() => router.push(`/parent/banks?bank=${bank.id}`)}
              onEdit={bank.origin === "custom" ? () => openEditor(bank) : undefined}
              onDelete={bank.origin === "custom" ? () => deleteCustom(bank.id) : undefined}
            />
          ))}
        </div>
      </motion.div>

      {/* 已禁用 */}
      {disabledBanks.length > 0 && (
        <motion.div
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.1 }}
          className="mb-6"
        >
          <h2 className="text-gray-500 font-cartoon mb-3">已禁用字库</h2>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            {disabledBanks.map((bank) => (
              <BankToggleCard
                key={bank.id}
                bank={bank}
                enabled={false}
                onToggle={() => toggleBank(bank.id)}
                onContent={() => router.push(`/parent/banks?bank=${bank.id}`)}
                onEdit={bank.origin === "custom" ? () => openEditor(bank) : undefined}
                onDelete={bank.origin === "custom" ? () => deleteCustom(bank.id) : undefined}
              />
            ))}
          </div>
        </motion.div>
      )}

      {/* 自定义字库 */}
      <motion.div
        initial={{ y: 20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.15 }}
        className="mb-6"
      >
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-gray-500 font-cartoon">自定义字库</h2>
          <button
            onClick={() => openEditor()}
            className="px-4 py-2 bg-candy-green text-white rounded-full text-sm active:scale-95 transition-transform"
          >
            + 新增
          </button>
        </div>
        {customBanks.length === 0 ? (
          <p className="text-gray-300 text-sm text-center py-6">
            还没有自定义字库，点击「+ 新增」创建
          </p>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            {customBanks.map((bank) => (
              <BankToggleCard
                key={bank.id}
                bank={bank}
                enabled={bank.enabled}
                onToggle={() => toggleBank(bank.id)}
                onContent={() => router.push(`/parent/banks?bank=${bank.id}`)}
                onEdit={() => openEditor(bank)}
                onDelete={() => deleteCustom(bank.id)}
              />
            ))}
          </div>
        )}
      </motion.div>

      {/* 分隔线 */}
      <hr className="border-gray-200 my-8" />

      {/* 操作按钮 */}
      <div className="space-y-3">
        <button
          onClick={resetWeights}
          className="w-full py-4 rounded-2xl bg-white shadow-sm text-gray-600 
                     active:scale-95 transition-transform text-left px-6"
        >
          🔄 权重重置
        </button>
        <button
          onClick={() => setPasswordModal(true)}
          className="w-full py-4 rounded-2xl bg-white shadow-sm text-gray-600 
                     active:scale-95 transition-transform text-left px-6"
        >
          🔐 修改家长密码
        </button>
        <button
          onClick={clearStats}
          className="w-full py-4 rounded-2xl bg-white shadow-sm text-red-400 
                     active:scale-95 transition-transform text-left px-6"
        >
          🧹 清除所有学习记录
        </button>
      </div>

      {/* 自定义字库编辑器弹窗 */}
      {showCustomEditor && (
        <div className="fixed inset-0 bg-black/30 z-50 flex items-center justify-center p-6">
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="bg-white rounded-4xl p-6 w-full max-w-md shadow-2xl"
          >
            <h3 className="text-xl font-cartoon text-gray-700 mb-4">
              {editBank ? "编辑字库" : "新增字库"}
            </h3>

            <div className="space-y-4">
              <div>
                <label className="text-sm text-gray-400 block mb-1">名称</label>
                <input
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  className="w-full px-4 py-3 rounded-2xl bg-gray-50 text-gray-700 text-lg"
                  placeholder="如：动物园"
                  maxLength={10}
                />
              </div>

              <div>
                <label className="text-sm text-gray-400 block mb-1">图标（一个 emoji）</label>
                <input
                  value={editEmoji}
                  onChange={(e) => setEditEmoji(e.target.value)}
                  className="w-full px-4 py-3 rounded-2xl bg-gray-50 text-gray-700 text-lg"
                  placeholder="如：🐼"
                  maxLength={2}
                />
              </div>

              <div>
                <label className="text-sm text-gray-400 block mb-1">汉字（≥2个字，最多15个）</label>
                <input
                  value={editChars}
                  onChange={(e) => setEditChars(e.target.value)}
                  className="w-full px-4 py-3 rounded-2xl bg-gray-50 text-gray-700 text-lg"
                  placeholder="如：熊猫老虎狮子..."
                  maxLength={15}
                />
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  onClick={() => setShowCustomEditor(false)}
                  className="flex-1 py-3 rounded-2xl bg-gray-100 text-gray-500 active:scale-95 transition-transform"
                >
                  取消
                </button>
                <button
                  onClick={saveCustom}
                  className="flex-1 py-3 rounded-2xl bg-candy-green text-white active:scale-95 transition-transform"
                >
                  保存
                </button>
              </div>
            </div>
          </motion.div>
        </div>
      )}

      {/* 密码修改弹窗 */}
      {passwordModal && (
        <div className="fixed inset-0 bg-black/30 z-50 flex items-center justify-center p-6">
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="bg-white rounded-4xl p-6 w-full max-w-md shadow-2xl"
          >
            <h3 className="text-xl font-cartoon text-gray-700 mb-4">🔐 修改密码</h3>
            <div className="space-y-4">
              <input
                value={oldPwd}
                onChange={(e) => setOldPwd(e.target.value.replace(/\D/g, "").slice(0, 4))}
                className="w-full px-4 py-3 rounded-2xl bg-gray-50 text-gray-700 text-lg text-center"
                placeholder="旧密码（4位数字）"
                type="password"
                inputMode="numeric"
                maxLength={4}
              />
              <input
                value={newPwd}
                onChange={(e) => setNewPwd(e.target.value.replace(/\D/g, "").slice(0, 4))}
                className="w-full px-4 py-3 rounded-2xl bg-gray-50 text-gray-700 text-lg text-center"
                placeholder="新密码（4位数字）"
                type="password"
                inputMode="numeric"
                maxLength={4}
              />
              <input
                value={confirmPwd}
                onChange={(e) => setConfirmPwd(e.target.value.replace(/\D/g, "").slice(0, 4))}
                className="w-full px-4 py-3 rounded-2xl bg-gray-50 text-gray-700 text-lg text-center"
                placeholder="确认新密码"
                type="password"
                inputMode="numeric"
                maxLength={4}
              />
              <div className="flex gap-3 pt-2">
                <button
                  onClick={() => setPasswordModal(false)}
                  className="flex-1 py-3 rounded-2xl bg-gray-100 text-gray-500 active:scale-95 transition-transform"
                >
                  取消
                </button>
                <button
                  onClick={changePassword}
                  className="flex-1 py-3 rounded-2xl bg-candy-teal text-white active:scale-95 transition-transform"
                >
                  保存
                </button>
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </div>
  );
}

/** 字库卡片子组件 */
function BankToggleCard({
  bank,
  enabled,
  onToggle,
  onContent,
  onEdit,
  onDelete,
}: {
  bank: BankRecord;
  enabled: boolean;
  onToggle: () => void;
  /** 进入字库内容维护页（添加 / 删除 / 禁用汉字） */
  onContent: () => void;
  onEdit?: () => void;
  onDelete?: () => void;
}) {
  const activeCount = getActiveChars(bank).length;
  const disabledCount = getDisabledChars(bank).length;

  return (
    <motion.div
      layout
      initial={{ scale: 0.9, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      className={`rounded-2xl p-4 text-center relative ${
        enabled ? "bg-white shadow-sm" : "bg-gray-50 opacity-50"
      }`}
    >
      <button onClick={onToggle} className="w-full">
        <div className="text-2xl mb-1">{bank.emoji}</div>
        <div className="text-sm font-cartoon text-gray-600">{bank.name}</div>
        <div className="text-xs text-gray-300 mt-1">
          {activeCount}字
          {disabledCount > 0 && <span className="text-gray-400"> · 禁用{disabledCount}</span>}
        </div>
        <div className={`mt-2 text-xs ${enabled ? "text-candy-green" : "text-gray-300"}`}>
          {enabled ? "✅ 已启用" : "❌ 已禁用"}
        </div>
      </button>

      {/* 内容维护（所有字库都可进：内置字库只能禁用/添加，自定义字库还能删除） */}
      <div className="flex justify-center gap-3 mt-2">
        <button onClick={onContent} className="text-xs text-candy-purple">
          📝 内容
        </button>
        {onEdit && (
          <button onClick={onEdit} className="text-xs text-candy-teal">
            ✏️ 编辑
          </button>
        )}
        {onDelete && (
          <button onClick={onDelete} className="text-xs text-red-400">
            🗑️ 删除
          </button>
        )}
      </div>
    </motion.div>
  );
}
