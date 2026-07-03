'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useEffect, useState } from 'react';
import { findBankById, getMergedBankChars } from '@/lib/wordBanks';
import PrintCards from '@/components/child/PrintCards';

function PrintPageInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const bankId = searchParams.get('bank') || '';
  const isComprehensive = bankId === 'comprehensive';
  const bank = isComprehensive
    ? { id: 'comprehensive', name: '综合', emoji: '📚', chars: getMergedBankChars() }
    : findBankById(bankId);

  const [chars, setChars] = useState<string[]>([]);

  useEffect(() => {
    if (!bank) {
      router.push('/child');
      return;
    }
    setChars([...bank.chars]);
  }, [bank, router]);

  if (!bank) return null;

  return (
    <div className="min-h-screen bg-white">
      {/* 顶栏 */}
      <div className="no-print flex items-center gap-3 px-4 py-3 bg-white border-b border-gray-100">
        <button
          onClick={() => router.push('/child')}
          className="w-10 h-10 rounded-full bg-white shadow-sm flex items-center justify-center text-lg active:scale-90 transition-transform"
        >
          ←
        </button>
        <div className="flex items-center gap-2">
          <span className="text-xl">{bank.emoji}</span>
          <h1 className="text-lg font-cartoon text-gray-600">{bank.name} · 字卡打印</h1>
        </div>
        <span className="ml-auto text-xs text-gray-300">{chars.length} 个字</span>
      </div>

      {/* 卡片区域 */}
      {chars.length > 0 && (
        <PrintCards chars={chars} />
      )}
    </div>
  );
}

export default function PrintPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center text-gray-300 text-lg">加载中…</div>
    }>
      <PrintPageInner />
    </Suspense>
  );
}
