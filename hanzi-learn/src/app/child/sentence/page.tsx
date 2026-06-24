'use client';

import { Suspense, useState, useCallback, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { AnimatePresence } from 'framer-motion';
import IdleState from '@/components/child/IdleState';
import LoadingState from '@/components/child/LoadingState';
import ResultState from '@/components/child/ResultState';
import BackButton from '@/components/child/BackButton';
import { findBankById, getFullBankChars, getEffectiveUseHelpers, HELPERS } from '@/lib/wordBanks';
import { loadConfig } from '@/lib/storage';
import { useWeightEngine } from '@/hooks/useWeightEngine';
import { useSound } from '@/hooks/useSound';
import { useStats } from '@/hooks/useStats';

type PageState = 'idle' | 'loading' | 'result';

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
  const bankId = searchParams.get('bank') || '';
  const bank = findBankById(bankId);

  const { play } = useSound();
  const { recordCall } = useStats();

  const [state, setState] = useState<PageState>('idle');
  const [sentence, setSentence] = useState('');
  const [usedChars, setUsedChars] = useState<string[]>([]);
  const [isFallback, setIsFallback] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  // 权重引擎
  const fullChars = bank ? getFullBankChars(bank) : [];
  const themeChars = bank?.chars || [];
  const weightEngine = useWeightEngine(bankId, themeChars);

  // 无效字库
  useEffect(() => {
    if (!bank) {
      router.push('/child');
    }
  }, [bank, router]);

  // 客户端日志
  function clientLog(...args: unknown[]) {
    const time = new Date().toISOString().slice(11, 23);
    console.log(`[${time}] [client]`, ...args);
  }

  // 生成句子
  const handleGenerate = useCallback(async () => {
    // 先设 loading，再检查 bank，确保无论什么路径 loading 状态都生效
    setState('loading');
    play('rocket');
    if (!bank) {
      clientLog('❌ bank 为空，无法生成');
      setTimeout(() => setState('idle'), 500);
      return;
    }

    clientLog('===== 开始生成 =====');
    clientLog('字库:', bankId, bank.name);
    clientLog('字库汉字:', bank.chars);
    clientLog('完整字集（含助字）:', fullChars);

    // 获取权重数据
    const weightData = weightEngine.getWeightData();
    clientLog('当前权重:', weightData.chars.map(c => `${c.char}:${c.weight}`).join(', '));
    clientLog('当前轮次:', weightData.round);
    clientLog(`权重数据量: ${weightData.chars.length} 个字 vs 字库: ${themeChars.length} 个字`);

    // 检查权重数据与字库是否一致
    const weightChars = new Set(weightData.chars.map(c => c.char));
    const missing = themeChars.filter(c => !weightChars.has(c));
    const extra = weightData.chars.filter(c => !themeChars.includes(c.char)).map(c => c.char);
    if (missing.length > 0) clientLog('⚠️ 权重中缺少的字:', missing);
    if (extra.length > 0) clientLog('⚠️ 权重中多余的字:', extra);

    const sortedThemeChars = weightEngine.getSortedChars();
    const themeWeights = JSON.stringify(
      weightData.chars.map(c => ({ char: c.char, weight: c.weight }))
    );
    const config = loadConfig();
    const useHelpers = getEffectiveUseHelpers(bank, config.bankHelpers);
    const helpersStr = useHelpers ? HELPERS.join('') : '';
    const allChars = sortedThemeChars + helpersStr;
    clientLog('加权排序(主题字):', sortedThemeChars);
    clientLog('权重JSON:', themeWeights);
    clientLog('使用助字:', useHelpers);
    clientLog('发送给 API 的完整字串:', allChars);
    clientLog('主题字数:', sortedThemeChars.length, '总字数:', allChars.length);

    const startTime = Date.now();

    try {
      const res = await fetch('/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          bankId,
          sortedChars: allChars,
          themeWeights,
          helpers: helpersStr,
        }),
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

      clientLog('API 响应:', data);

      if (res.ok && data.text) {
        clientLog(`✅ 生成成功: "${data.text}"`);
        clientLog(`用字:`, data.usedChars);
        clientLog(`是否保底句: ${data.isFallback}`);

        play('success');
        setSentence(data.text);
        setUsedChars(data.usedChars || []);
        setIsFallback(data.isFallback || false);

        // 更新权重
        const usedSet = new Set<string>(data.usedChars || []);
        weightEngine.update(usedSet);

        // 更新后权重
        const afterWeight = weightEngine.getWeightData();
        clientLog('更新后权重:', afterWeight.chars.map(c => `${c.char}:${c.weight}`).join(', '));

        // 记录统计
        recordCall(data.text, bankId, data.usedChars || []);

        setState('result');
      } else {
        clientLog(`❌ 请求失败: ${data.error || '未知错误'}`);
        throw new Error(data.error || '生成失败');
      }
    } catch (err) {
      clientLog(`💥 异常:`, err instanceof Error ? err.message : err);
      play('error');
      setErrorMsg('哎呀，出错了！');
      setState('idle');
    }
  }, [bank, bankId, weightEngine, play, recordCall]);

  // 安全兜底：loading 超过 15 秒强制回到 idle
  useEffect(() => {
    if (state !== 'loading') return;
    const timer = setTimeout(() => {
      clientLog('⏰ 加载超时（15s），强制回到 idle');
      play('error');
      setErrorMsg('小脑袋想太久了，再试一次吧！');
      setState('idle');
    }, 15000);
    return () => clearTimeout(timer);
  }, [state, play]);

  // 加载超时（传递给 LoadingState 的 12s 超时 UI 反馈）
  const handleTimeout = useCallback(() => {
    clientLog('⏰ LoadingState 12s 超时');
    play('error');
    setErrorMsg('小脑袋想太久了，再试一次吧！');
    setState('idle');
  }, [play]);

  // 再来一句：清空旧数据，直接重新生成
  const handleRegenerate = useCallback(() => {
    setSentence('');
    setUsedChars([]);
    setIsFallback(false);
    setErrorMsg('');
    setState('loading');
    handleGenerate();
  }, [handleGenerate]);

  if (!bank) return null;

  return (
    <div className="relative min-h-screen">
      <BackButton href="/child" />

      {/* 错误提示 */}
      {errorMsg && state === 'idle' && (
        <div className="absolute top-24 left-0 right-0 text-center z-10">
          <p className="inline-block bg-red-50 text-red-400 px-6 py-2 rounded-full text-sm">
            {errorMsg}
          </p>
        </div>
      )}

      <AnimatePresence mode="wait">
        {state === 'idle' && <IdleState key="idle" onGenerate={handleGenerate} />}
        {state === 'loading' && <LoadingState key="loading" onTimeout={handleTimeout} />}
        {state === 'result' && (
          <ResultState
            key="result"
            text={sentence}
            usedChars={usedChars}
            isFallback={isFallback}
            onRegenerate={handleRegenerate}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
