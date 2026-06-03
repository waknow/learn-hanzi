'use client';

import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';

/**
 * 首页入口
 * 两个大卡片选择：👶 小朋友 / 👩 家长
 */
export default function HomePage() {
  const router = useRouter();

  return (
    <div className="min-h-screen bg-[#FFF5E6] flex flex-col items-center justify-center p-8 gap-8">
      {/* 标题 */}
      <motion.div
        initial={{ y: -30, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.6, ease: 'easeOut' }}
        className="text-center"
      >
        <h1 className="text-5xl md:text-6xl font-cartoon text-gray-700 mb-2">
          🎈 快乐识字 🎈
        </h1>
        <p className="text-gray-400 text-lg">小朋友学汉字的好朋友</p>
      </motion.div>

      {/* 选择卡片 */}
      <div className="flex flex-col md:flex-row gap-6 w-full max-w-lg">
        {/* 小朋友入口 */}
        <motion.button
          initial={{ x: -50, opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          transition={{ delay: 0.2, type: 'spring', stiffness: 200 }}
          whileHover={{ scale: 1.03 }}
          whileTap={{ scale: 0.95 }}
          onClick={() => router.push('/child')}
          className="flex-1 bg-gradient-to-br from-candy-pink to-candy-orange
                     rounded-4xl shadow-xl p-8 text-white text-center
                     flex flex-col items-center gap-3"
        >
          <span className="text-6xl">👶</span>
          <span className="text-2xl font-cartoon">小朋友</span>
          <span className="text-sm opacity-80">开始学汉字</span>
        </motion.button>

        {/* 家长入口 */}
        <motion.button
          initial={{ x: 50, opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          transition={{ delay: 0.3, type: 'spring', stiffness: 200 }}
          whileHover={{ scale: 1.03 }}
          whileTap={{ scale: 0.95 }}
          onClick={() => router.push('/parent')}
          className="flex-1 bg-gradient-to-br from-candy-purple to-candy-sky
                     rounded-4xl shadow-xl p-8 text-white text-center
                     flex flex-col items-center gap-3"
        >
          <span className="text-6xl">👩</span>
          <span className="text-2xl font-cartoon">家长</span>
          <span className="text-sm opacity-80">查看学习情况</span>
        </motion.button>
      </div>
    </div>
  );
}
