'use client';

import { useEffect } from 'react';
import { syncOnce } from '@/lib/stateSync';

/**
 * 应用挂载时从服务端同步一次状态。
 * 换浏览器/设备后打开应用，进度自动恢复；老用户本地数据自动迁移。
 * 无 UI，渲染空节点。
 */
export default function StateSync() {
  useEffect(() => {
    let cancelled = false;
    void syncOnce().then(() => {
      // 同步完成后广播事件，让依赖配置的页面（如字库选择）刷新
      if (!cancelled && typeof window !== 'undefined') {
        window.dispatchEvent(new Event('hanzi-state-synced'));
      }
    });
    return () => {
      cancelled = true;
    };
  }, []);
  return null;
}
