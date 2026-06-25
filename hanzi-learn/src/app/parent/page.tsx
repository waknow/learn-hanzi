'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import PasswordGate from '@/components/shared/PasswordGate';

/** 家长入口 — 密码验证页 */
export default function ParentPage() {
  const router = useRouter();

  const handleSuccess = () => {
    router.push('/parent/dashboard');
  };

  return (
    <div className="relative min-h-screen">
      {/* 返回首页 */}
      <button
        onClick={() => router.push('/')}
        className="absolute top-6 left-6 w-14 h-14 rounded-full bg-white/80 backdrop-blur-sm
                   shadow-md flex items-center justify-center text-2xl z-20
                   active:scale-90 transition-transform"
        aria-label="返回首页"
      >
        ←
      </button>
      <PasswordGate onSuccess={handleSuccess} />
    </div>
  );
}
