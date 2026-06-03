'use client';

import { useRouter } from 'next/navigation';

/** 统一左上角返回按钮 */
export default function BackButton({ href }: { href: string }) {
  const router = useRouter();

  return (
    <button
      onClick={() => router.push(href)}
      className="absolute top-6 left-6 w-14 h-14 rounded-full bg-white/80 backdrop-blur-sm
                 shadow-md flex items-center justify-center text-2xl
                 active:scale-90 transition-transform z-20"
      aria-label="返回"
    >
      ←
    </button>
  );
}
