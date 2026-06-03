import type { ReactNode } from 'react';

/** 儿童区布局 */
export default function ChildLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-gradient-to-b from-candy-sky/15 to-candy-mint/10">
      {children}
    </div>
  );
}
