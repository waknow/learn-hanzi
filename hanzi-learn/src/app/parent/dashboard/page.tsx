'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import { loadStats } from '@/lib/storage';
import type { StudyStats } from '@/lib/types';

type ChartData = { char: string; count: number; fill: string }[];

/** 统计看板页 */
export default function DashboardPage() {
  const router = useRouter();
  const [stats, setStats] = useState<StudyStats | null>(null);
  const [chartData, setChartData] = useState<ChartData>([]);

  useEffect(() => {
    const s = loadStats();
    setStats(s);

    // 各字使用频率柱状图
    const data: ChartData = Object.entries(s.charUsage)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 15)
      .map(([char, count]) => ({
        char,
        count,
        fill: count >= 3 ? '#6BCB77' : count >= 1 ? '#FFD93D' : '#FF6B9D',
      }));
    setChartData(data);
  }, []);

  if (!stats) return null;

  // 本周句子
  const recentSentences = stats.sentenceHistory.slice(0, 10);

  // 本周学习天数
  const today = new Date().toISOString().slice(0, 10);
  const weekDays: { date: string; label: string; active: boolean }[] = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const dateStr = d.toISOString().slice(0, 10);
    weekDays.push({
      date: dateStr,
      label: ['日', '一', '二', '三', '四', '五', '六'][d.getDay()],
      active: !!stats.history[dateStr],
    });
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-candy-purple/10 to-candy-sky/10 p-6 pb-24">
      {/* 顶部导航 */}
      <div className="flex items-center justify-between mb-8">
        <button onClick={() => router.push('/')} className="text-gray-400 text-lg">
          ← 返回
        </button>
        <h1 className="text-2xl font-cartoon text-gray-700">📊 学习报告</h1>
        <button
          onClick={() => router.push('/parent/settings')}
          className="text-gray-400 text-lg"
        >
          ⚙️
        </button>
      </div>

      {/* 统计卡片 */}
      <div className="grid grid-cols-2 gap-4 mb-8">
        <StatCard label="总使用" value={`${stats.totalCalls}`} emoji="📝" color="candy-pink" />
        <StatCard
          label="今日"
          value={`${stats.todayDate === today ? stats.todayCalls : 0}`}
          emoji="📅"
          color="candy-orange"
        />
        <StatCard label="本周" value={`${stats.weeklyCalls}`} emoji="📈" color="candy-green" />
        <StatCard
          label="累计句子"
          value={`${stats.sentenceHistory.length}`}
          emoji="💬"
          color="candy-teal"
        />
      </div>

      {/* 学习日历 */}
      <motion.div
        initial={{ y: 20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.1 }}
        className="bg-white rounded-3xl shadow-md p-6 mb-6"
      >
        <h2 className="text-lg font-cartoon text-gray-600 mb-4">📅 本周学习</h2>
        <div className="flex justify-around">
          {weekDays.map((day) => (
            <div key={day.date} className="flex flex-col items-center gap-2">
              <span className="text-sm text-gray-400">{day.label}</span>
              <div
                className={`w-10 h-10 rounded-xl flex items-center justify-center text-lg
                  ${day.active ? 'bg-candy-green text-white' : 'bg-gray-100 text-gray-300'}`}
              >
                {day.active ? '✅' : '○'}
              </div>
            </div>
          ))}
        </div>
      </motion.div>

      {/* 各字使用频率 */}
      {chartData.length > 0 && (
        <motion.div
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.2 }}
          className="bg-white rounded-3xl shadow-md p-6 mb-6"
        >
          <h2 className="text-lg font-cartoon text-gray-600 mb-4">📊 汉字使用频率</h2>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} margin={{ top: 5, right: 5, left: -20, bottom: 5 }}>
                <XAxis
                  dataKey="char"
                  tick={{ fontSize: 14 }}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis hide />
                <Tooltip
                  formatter={(value: number) => [`${value} 次`, '使用次数']}
                  contentStyle={{ borderRadius: 12, border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}
                />
                <Bar dataKey="count" radius={[8, 8, 0, 0]} maxBarSize={30} />
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div className="flex justify-center gap-4 mt-3 text-xs text-gray-400">
            <span className="flex items-center gap-1">
              <span className="w-3 h-3 rounded bg-candy-green" /> ≥3次
            </span>
            <span className="flex items-center gap-1">
              <span className="w-3 h-3 rounded bg-candy-yellow" /> 1-2次
            </span>
            <span className="flex items-center gap-1">
              <span className="w-3 h-3 rounded bg-candy-pink" /> 0次
            </span>
          </div>
        </motion.div>
      )}

      {/* 最近句子 */}
      {recentSentences.length > 0 && (
        <motion.div
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.3 }}
          className="bg-white rounded-3xl shadow-md p-6"
        >
          <h2 className="text-lg font-cartoon text-gray-600 mb-4">📝 最近句子</h2>
          <div className="space-y-3">
            {recentSentences.map((s, i) => (
              <div key={i} className="flex items-center justify-between border-b border-gray-50 pb-2">
                <span className="text-gray-700">{s.text}</span>
                <span className="text-xs text-gray-300">{s.date.slice(5)}</span>
              </div>
            ))}
          </div>
        </motion.div>
      )}
    </div>
  );
}

/** 统计数字卡片子组件 */
function StatCard({
  label,
  value,
  emoji,
  color,
}: {
  label: string;
  value: string;
  emoji: string;
  color: string;
}) {
  const colorMap: Record<string, string> = {
    'candy-pink': 'from-candy-pink/20 to-candy-pink/5',
    'candy-orange': 'from-candy-orange/20 to-candy-orange/5',
    'candy-green': 'from-candy-green/20 to-candy-green/5',
    'candy-teal': 'from-candy-teal/20 to-candy-teal/5',
  };

  return (
    <motion.div
      initial={{ y: 20, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      className={`bg-gradient-to-br ${colorMap[color] || colorMap['candy-pink']} 
                  rounded-3xl shadow-sm p-5`}
    >
      <div className="flex items-center justify-between mb-2">
        <span className="text-2xl">{emoji}</span>
      </div>
      <div className="text-3xl font-bold text-gray-700">{value}</div>
      <div className="text-sm text-gray-400">{label}</div>
    </motion.div>
  );
}
