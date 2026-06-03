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

  return <PasswordGate onSuccess={handleSuccess} />;
}
