'use client';

import { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import { useSound } from '@/hooks/useSound';

interface IdleStateProps {
  onGenerate: () => void;
}

/**
 * 状态 A：仅一个大按钮
 * - 呼吸动效引导点击
 * - 8秒无操作显示引导箭头
 */
export default function IdleState({ onGenerate }: IdleStateProps) {
  const { init } = useSound();
  const [showArrow, setShowArrow] = useState(false);

  // 8秒无操作提示
  useEffect(() => {
    const timer = setTimeout(() => setShowArrow(true), 8000);
    return () => clearTimeout(timer);
  }, []);

  const handleClick = useCallback(() => {
    init();
    onGenerate();
  }, [init, onGenerate]);

  return (
    <div className="relative flex flex-col items-center justify-center min-h-screen">
      {/* 引导箭头 */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={showArrow ? { opacity: 1, y: 0 } : {}}
        className="text-candy-pink text-4xl mb-4"
      >
        {showArrow && '👇 点这里'}
      </motion.div>

      {/* 大按钮 */}
      <motion.button
        onClick={handleClick}
        className="
          w-44 h-44 md:w-48 md:h-48 rounded-full
          bg-gradient-to-br from-candy-pink to-candy-orange
          shadow-2xl flex flex-col items-center justify-center gap-2
          text-white
        "
        animate={{
          scale: [1, 1.06, 1],
          boxShadow: [
            '0 0 30px rgba(255,107,157,0.3), 0 10px 40px rgba(255,107,157,0.2)',
            '0 0 60px rgba(255,107,157,0.5), 0 10px 40px rgba(255,107,157,0.3)',
            '0 0 30px rgba(255,107,157,0.3), 0 10px 40px rgba(255,107,157,0.2)',
          ],
        }}
        transition={{
          scale: { duration: 2, repeat: Infinity, ease: 'easeInOut' },
          boxShadow: { duration: 2, repeat: Infinity, ease: 'easeInOut' },
        }}
        whileTap={{ scale: 0.95 }}
      >
        <span className="text-4xl">✨</span>
        <span className="text-2xl font-cartoon">造句子</span>
      </motion.button>
    </div>
  );
}
