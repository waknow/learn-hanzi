'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import { useSound } from '@/hooks/useSound';

interface ResultStateProps {
  text: string;
  usedChars: string[];
  isFallback: boolean;
  onRegenerate: () => void;
}

/**
 * 状态 C：句子展示
 * - 句子逐字弹出动画
 * - 已用字标签
 * - 点击句子 → TTS 朗读
 * - 重生成按钮（延迟出现）
 */
export default function ResultState({
  text,
  usedChars,
  isFallback,
  onRegenerate,
}: ResultStateProps) {
  const { speak, play } = useSound();
  const [showButton, setShowButton] = useState(false);

  // 延迟显示按钮
  useState(() => {
    const timer = setTimeout(() => setShowButton(true), 800);
    return () => clearTimeout(timer);
  });

  // 拆成字符用于逐字动画
  const chars = text.split('');

  // 分行（每行最多 8 个汉字 + 标点）
  const lines: string[] = [];
  let currentLine = '';
  for (const char of chars) {
    if (currentLine.length >= 8 && /[\u4e00-\u9fff]/.test(char)) {
      lines.push(currentLine);
      currentLine = char;
    } else {
      currentLine += char;
    }
  }
  if (currentLine) lines.push(currentLine);

  const handleSpeak = () => {
    play('ding');
    speak(text);
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-8">
      {/* 句子展示 */}
      <motion.div
        initial={{ y: 40, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.4, ease: 'easeOut' }}
        className="bg-white/80 backdrop-blur-sm rounded-4xl shadow-lg px-10 py-8 
                   max-w-lg w-full cursor-pointer"
        onClick={handleSpeak}
      >
        <div className="text-center" style={{ fontFamily: "'KaiTi', 'STKaiti', serif" }}>
          {lines.map((line, lineIdx) => (
            <div key={lineIdx} className="flex justify-center flex-wrap gap-1 my-1">
              {line.split('').map((char, charIdx) => (
                <motion.span
                  key={`${lineIdx}-${charIdx}`}
                  initial={{ scale: 0, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={{
                    delay: 0.3 + (lineIdx * 8 + charIdx) * 0.08,
                    type: 'spring',
                    stiffness: 200,
                    damping: 12,
                  }}
                  className={`
                    inline-block text-5xl md:text-7xl 
                    ${/[\u4e00-\u9fff]/.test(char) ? 'text-gray-800' : 'text-gray-400'}
                    leading-relaxed
                  `}
                >
                  {char}
                </motion.span>
              ))}
            </div>
          ))}
        </div>

        {/* 提示朗读 */}
        <p className="text-center text-gray-300 text-sm mt-4">
          👆 点击句子听朗读
        </p>
      </motion.div>

      {/* 已用字标签 */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.6 }}
        className="mt-4 flex items-center gap-2 text-gray-400"
      >
        <span>✅ 用了：</span>
        <div className="flex gap-1">
          {usedChars.map((char) => (
            <span
              key={char}
              className="px-2 py-0.5 rounded-full bg-candy-green/20 text-candy-green text-sm"
            >
              {char}
            </span>
          ))}
        </div>
      </motion.div>

      {/* 保底句提示 */}
      {isFallback && (
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.8 }}
          className="mt-2 text-xs text-gray-300"
        >
          💡 AI 偷懒了，这是备用句子
        </motion.p>
      )}

      {/* 再来一句按钮 */}
      <motion.div
        initial={{ y: 60, opacity: 0 }}
        animate={showButton ? { y: 0, opacity: 1 } : {}}
        transition={{ type: 'spring', stiffness: 200, damping: 15 }}
        className="mt-8"
      >
        <button
          onClick={onRegenerate}
          className="px-10 py-4 bg-gradient-to-r from-candy-teal to-candy-sky
                     text-white text-xl font-cartoon rounded-full shadow-lg
                     active:scale-95 transition-transform"
        >
          🔁 再来一句
        </button>
      </motion.div>
    </div>
  );
}
