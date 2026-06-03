'use client';

import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import ParticleBg from '@/components/shared/ParticleBg';

interface LoadingStateProps {
  onTimeout: () => void;
}

const MESSAGES = [
  '小脑袋正在想…',
  '快要变出句子啦…',
  '马上就好…',
];

/** 文案轮换间隔 */
const MSG_INTERVAL = 3000;

/** 超时时间 */
const TIMEOUT_MS = 12000;

/**
 * 状态 B：火箭加载动画
 * - 火箭上下浮动 + 缓慢自旋
 * - 文案每 3s 轮换
 * - 12s 超时回退
 */
export default function LoadingState({ onTimeout }: LoadingStateProps) {
  const [msgIndex, setMsgIndex] = useState(0);

  // 文案轮换
  useEffect(() => {
    const interval = setInterval(() => {
      setMsgIndex((prev) => (prev + 1) % MESSAGES.length);
    }, MSG_INTERVAL);
    return () => clearInterval(interval);
  }, []);

  // 超时
  useEffect(() => {
    const timer = setTimeout(onTimeout, TIMEOUT_MS);
    return () => clearTimeout(timer);
  }, [onTimeout]);

  return (
    <div className="relative flex flex-col items-center justify-center min-h-screen overflow-hidden">
      <ParticleBg count={15} />

      {/* 火箭 */}
      <motion.div
        className="text-7xl mb-8 z-10"
        animate={{
          y: [0, -8, 0],
          rotate: [0, -5, 5, 0],
        }}
        transition={{
          y: { duration: 1.5, repeat: Infinity, ease: 'easeInOut' },
          rotate: { duration: 3, repeat: Infinity, ease: 'easeInOut' },
        }}
      >
        🚀
      </motion.div>

      {/* 文案 */}
      <motion.p
        key={msgIndex}
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -10 }}
        className="text-xl text-gray-500 font-cartoon z-10"
      >
        {MESSAGES[msgIndex]}
      </motion.p>
    </div>
  );
}
