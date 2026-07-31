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
    void syncOnce();
  }, []);
  return null;
}
