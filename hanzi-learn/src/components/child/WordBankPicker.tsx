'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { BUILT_IN_BANKS } from '@/lib/wordBanks';
import { loadConfig } from '@/lib/storage';
import type { WordBank } from '@/lib/types';
import { useSound } from '@/hooks/useSound';

const CARD_COLORS = [
  'from-candy-pink/30 to-candy-orange/30',
  'from-candy-yellow/30 to-candy-green/30',
  'from-candy-teal/30 to-candy-sky/30',
  'from-candy-purple/30 to-candy-pink/30',
  'from-candy-orange/30 to-candy-yellow/30',
  'from-candy-green/30 to-candy-teal/30',
  'from-candy-sky/30 to-candy-purple/30',
  'from-candy-mint/30 to-candy-teal/30',
  'from-candy-pink/20 to-candy-purple/30',
  'from-candy-yellow/20 to-candy-orange/30',
];

// 字库 Emoji 背景色
const EMOJI_BG = [
  'bg-candy-pink/20',
  'bg-candy-orange/20',
  'bg-candy-yellow/20',
  'bg-candy-green/20',
  'bg-candy-teal/20',
  'bg-candy-sky/20',
  'bg-candy-purple/20',
  'bg-candy-mint/20',
];

/** 字库选择卡片网格 */
export default function WordBankPicker() {
  const router = useRouter();
  const { init, play } = useSound();
  const [banks, setBanks] = useState<WordBank[]>([]);

  useEffect(() => {
    const config = loadConfig();
    const enabledIds = config.enabledBanks;

    // 合并内置字库和自定义字库
    // 如果开启了全部（enabledBanks 为空数组），则显示全部
    const allBanks =
      enabledIds.length === 0
        ? BUILT_IN_BANKS
        : BUILT_IN_BANKS.filter((b) => enabledIds.includes(b.id));

    const customs = (config.customBanks || []).filter((b) =>
      enabledIds.length === 0 ? true : enabledIds.includes(b.id)
    );

    setBanks([...allBanks, ...customs]);
  }, []);

  const handleSelect = (bankId: string) => {
    init();
    play('ding');
    router.push(`/child/sentence?bank=${bankId}`);
  };

  if (banks.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen text-gray-400 px-8">
        <div className="text-6xl mb-4">📚</div>
        <p className="text-xl text-center">
          请让家长先开启字库哦
        </p>
      </div>
    );
  }

  return (
    <div className="min-h-screen p-6 flex flex-col">
      <h1 className="text-3xl font-cartoon text-center text-gray-700 mt-4 mb-8">
        ✨ 选一个字库吧 ✨
      </h1>

      <div className="grid grid-cols-2 md:grid-cols-3 gap-4 max-w-2xl mx-auto w-full">
        {banks.map((bank, i) => (
          <motion.button
            key={bank.id}
            initial={{ y: 60, opacity: 0, scale: 0.8 }}
            animate={{ y: 0, opacity: 1, scale: 1 }}
            transition={{
              delay: i * 0.05,
              type: 'spring',
              stiffness: 300,
              damping: 15,
            }}
            whileTap={{ scale: 0.92 }}
            whileHover={{ scale: 1.03 }}
            onClick={() => handleSelect(bank.id)}
            className={`
              aspect-square rounded-3xl relative
              bg-gradient-to-br ${CARD_COLORS[i % CARD_COLORS.length]}
              shadow-lg flex flex-col items-center justify-center gap-2
              active:shadow-md transition-shadow
            `}
          >
            <div
              className={`w-16 h-16 rounded-2xl ${EMOJI_BG[i % EMOJI_BG.length]} 
                          flex items-center justify-center text-3xl`}
            >
              {bank.emoji}
            </div>
            <span className="text-lg font-cartoon text-gray-700">
              {bank.name}
            </span>
            {bank.chars.length > 0 && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  router.push(`/print?bank=${bank.id}`);
                }}
                className="absolute bottom-2 right-2 w-7 h-7 rounded-full bg-white/70
                           flex items-center justify-center text-xs shadow-sm
                           active:scale-90 transition-transform"
                title="打印字卡"
              >
                🖨️
              </button>
            )}
          </motion.button>
        ))}
      </div>
    </div>
  );
}
