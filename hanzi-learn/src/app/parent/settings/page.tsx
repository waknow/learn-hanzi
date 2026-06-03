'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { BUILT_IN_BANKS, getEffectiveUseHelpers } from '@/lib/wordBanks';
import { loadConfig, saveConfig, saveWeightData, loadWeightData, saveStats } from '@/lib/storage';
import type { ParentConfig, WordBank } from '@/lib/types';

/** 设置管理页 */
export default function SettingsPage() {
  const router = useRouter();
  const [config, setConfig] = useState<ParentConfig | null>(null);
  const [showCustomEditor, setShowCustomEditor] = useState(false);
  const [editBank, setEditBank] = useState<WordBank | null>(null);
  const [editName, setEditName] = useState('');
  const [editEmoji, setEditEmoji] = useState('');
  const [editChars, setEditChars] = useState('');
  const [passwordModal, setPasswordModal] = useState(false);
  const [oldPwd, setOldPwd] = useState('');
  const [newPwd, setNewPwd] = useState('');
  const [confirmPwd, setConfirmPwd] = useState('');

  useEffect(() => {
    setConfig(loadConfig());
  }, []);

  const refresh = useCallback(() => {
    setConfig(loadConfig());
  }, []);

  if (!config) return null;

  // 切换启用/禁用
  const toggleBank = (id: string) => {
    const idx = config.enabledBanks.indexOf(id);
    if (idx >= 0) {
      config.enabledBanks.splice(idx, 1);
    } else {
      config.enabledBanks.push(id);
    }
    saveConfig(config);
    refresh();
  };

  // 切换助字
  const toggleHelpers = (id: string) => {
    if (!config.bankHelpers) config.bankHelpers = {};
    const current = config.bankHelpers[id] !== false; // 默认 true
    config.bankHelpers[id] = !current;
    saveConfig(config);
    refresh();
  };

  // 重置权重
  const resetWeights = () => {
    if (!confirm('确定要重置所有字的权重吗？')) return;
    saveWeightData({});
    alert('权重已重置');
  };

  // 清除学习记录
  const clearStats = () => {
    if (!confirm('确定要清除所有学习记录吗？此操作不可恢复！')) return;
    saveStats({
      totalCalls: 0,
      todayCalls: 0,
      todayDate: '',
      weeklyCalls: 0,
      history: {},
      sentenceHistory: [],
      charUsage: {},
    });
    alert('学习记录已清除');
  };

  // 打开自定义字库编辑
  const openEditor = (bank?: WordBank) => {
    if (bank) {
      setEditBank(bank);
      setEditName(bank.name);
      setEditEmoji(bank.emoji);
      setEditChars(bank.chars.join(''));
    } else {
      setEditBank(null);
      setEditName('');
      setEditEmoji('📦');
      setEditChars('');
    }
    setShowCustomEditor(true);
  };

  // 保存自定义字库
  const saveCustom = () => {
    if (!editName || !editChars) {
      alert('请输入字库名称和汉字');
      return;
    }
    const chars = Array.from(new Set(editChars.split('').filter((c) => /[\u4e00-\u9fff]/.test(c))));
    if (chars.length < 2) {
      alert('至少需要 2 个汉字');
      return;
    }

    if (editBank) {
      // 编辑
      const idx = config.customBanks.findIndex((b) => b.id === editBank.id);
      if (idx >= 0) {
        config.customBanks[idx] = { ...editBank, name: editName, emoji: editEmoji, chars };
      }
    } else {
      // 新增
      const newBank: WordBank = {
        id: `custom_${Date.now()}`,
        name: editName,
        emoji: editEmoji,
        chars,
      };
      config.customBanks.push(newBank);
    }

    saveConfig(config);
    setShowCustomEditor(false);
    refresh();
  };

  // 删除自定义字库
  const deleteCustom = (id: string) => {
    if (!confirm('确定要删除这个自定义字库吗？')) return;
    config.customBanks = config.customBanks.filter((b) => b.id !== id);
    saveConfig(config);
    refresh();
  };

  // 修改密码
  const changePassword = () => {
    if (oldPwd !== config.password) {
      alert('旧密码错误');
      return;
    }
    if (newPwd.length !== 4 || confirmPwd.length !== 4) {
      alert('密码必须是 4 位数字');
      return;
    }
    if (newPwd !== confirmPwd) {
      alert('两次密码不一致');
      return;
    }
    config.password = newPwd;
    saveConfig(config);
    setPasswordModal(false);
    setOldPwd('');
    setNewPwd('');
    setConfirmPwd('');
    alert('密码已修改');
  };

  const allEnabled = config.enabledBanks.length === 0;

  return (
    <div className="min-h-screen bg-gradient-to-b from-candy-purple/10 to-candy-sky/10 p-6 pb-32">
      {/* 顶部导航 */}
      <div className="flex items-center justify-between mb-8">
        <button onClick={() => router.push('/parent/dashboard')} className="text-gray-400 text-lg">
          ← 统计
        </button>
        <h1 className="text-2xl font-cartoon text-gray-700">⚙️ 字库管理</h1>
        <div className="w-8" />
      </div>

      {/* 已启用 */}
      <motion.div
        initial={{ y: 20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        className="mb-6"
      >
        <h2 className="text-gray-500 font-cartoon mb-3">
          {allEnabled ? '全部已启用' : '已启用字库'}
        </h2>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          {BUILT_IN_BANKS.filter((b) => allEnabled || config.enabledBanks.includes(b.id)).map(
            (bank) => (
              <BankToggleCard
                key={bank.id}
                bank={bank}
                enabled={true}
                useHelpers={getEffectiveUseHelpers(bank, config.bankHelpers)}
                onToggle={() => toggleBank(bank.id)}
                onToggleHelpers={() => toggleHelpers(bank.id)}
              />
            )
          )}
          {config.customBanks
            .filter((b) => allEnabled || config.enabledBanks.includes(b.id))
            .map((bank) => (
              <BankToggleCard
                key={bank.id}
                bank={bank}
                enabled={true}
                useHelpers={getEffectiveUseHelpers(bank, config.bankHelpers)}
                onToggle={() => toggleBank(bank.id)}
                onToggleHelpers={() => toggleHelpers(bank.id)}
                onEdit={() => openEditor(bank)}
                onDelete={() => deleteCustom(bank.id)}
              />
            ))}
        </div>
      </motion.div>

      {/* 已禁用 */}
      {!allEnabled && (
        <motion.div
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.1 }}
          className="mb-6"
        >
          <h2 className="text-gray-500 font-cartoon mb-3">已禁用字库</h2>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            {BUILT_IN_BANKS.filter((b) => !config.enabledBanks.includes(b.id)).map((bank) => (
              <BankToggleCard
                key={bank.id}
                bank={bank}
                enabled={false}
                useHelpers={getEffectiveUseHelpers(bank, config.bankHelpers)}
                onToggle={() => toggleBank(bank.id)}
                onToggleHelpers={() => toggleHelpers(bank.id)}
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
        {config.customBanks.length === 0 ? (
          <p className="text-gray-300 text-sm text-center py-6">
            还没有自定义字库，点击「+ 新增」创建
          </p>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            {config.customBanks.map((bank) => (
              <BankToggleCard
                key={bank.id}
                bank={bank}
                enabled={allEnabled || config.enabledBanks.includes(bank.id)}
                useHelpers={getEffectiveUseHelpers(bank, config.bankHelpers)}
                onToggle={() => toggleBank(bank.id)}
                onToggleHelpers={() => toggleHelpers(bank.id)}
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
              {editBank ? '编辑字库' : '新增字库'}
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
                onChange={(e) => setOldPwd(e.target.value.replace(/\D/g, '').slice(0, 4))}
                className="w-full px-4 py-3 rounded-2xl bg-gray-50 text-gray-700 text-lg text-center"
                placeholder="旧密码（4位数字）"
                type="password"
                inputMode="numeric"
                maxLength={4}
              />
              <input
                value={newPwd}
                onChange={(e) => setNewPwd(e.target.value.replace(/\D/g, '').slice(0, 4))}
                className="w-full px-4 py-3 rounded-2xl bg-gray-50 text-gray-700 text-lg text-center"
                placeholder="新密码（4位数字）"
                type="password"
                inputMode="numeric"
                maxLength={4}
              />
              <input
                value={confirmPwd}
                onChange={(e) => setConfirmPwd(e.target.value.replace(/\D/g, '').slice(0, 4))}
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
  useHelpers,
  onToggle,
  onToggleHelpers,
  onEdit,
  onDelete,
}: {
  bank: WordBank;
  enabled: boolean;
  useHelpers: boolean;
  onToggle: () => void;
  onToggleHelpers: () => void;
  onEdit?: () => void;
  onDelete?: () => void;
}) {
  return (
    <motion.div
      layout
      initial={{ scale: 0.9, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      className={`rounded-2xl p-4 text-center relative ${
        enabled ? 'bg-white shadow-sm' : 'bg-gray-50 opacity-50'
      }`}
    >
      <button onClick={onToggle} className="w-full">
        <div className="text-2xl mb-1">{bank.emoji}</div>
        <div className="text-sm font-cartoon text-gray-600">{bank.name}</div>
        <div className="text-xs text-gray-300 mt-1">{bank.chars.length}字</div>
        <div className={`mt-2 text-xs ${enabled ? 'text-candy-green' : 'text-gray-300'}`}>
          {enabled ? '✅ 已启用' : '❌ 已禁用'}
        </div>
      </button>

      {/* 助字开关 */}
      <div className="mt-2 flex items-center justify-center gap-1 text-xs">
        <button
          onClick={(e) => { e.stopPropagation(); onToggleHelpers(); }}
          className={`px-2 py-0.5 rounded-full transition-colors ${
            useHelpers
              ? 'bg-candy-sky/20 text-candy-teal'
              : 'bg-gray-100 text-gray-400'
          }`}
        >
          {useHelpers ? '📖 助字开' : '📕 助字关'}
        </button>
      </div>

      {/* 编辑/删除按钮（仅自定义字库） */}
      {onEdit && onDelete && (
        <div className="flex justify-center gap-3 mt-2">
          <button onClick={onEdit} className="text-xs text-candy-teal">
            ✏️ 编辑
          </button>
          <button onClick={onDelete} className="text-xs text-red-400">
            🗑️ 删除
          </button>
        </div>
      )}
    </motion.div>
  );
}
