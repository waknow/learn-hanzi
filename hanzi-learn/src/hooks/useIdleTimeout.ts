'use client';

import { useState, useEffect, useCallback } from 'react';

/**
 * 无操作超时 Hook
 *
 * 在指定时长内无交互后触发回调。
 * @param timeoutMs 超时毫秒数
 * @param onTimeout 超时回调
 * @param enabled 是否启用（默认 true）
 */
export function useIdleTimeout(
  timeoutMs: number,
  onTimeout: () => void,
  enabled = true
) {
  const [showHint, setShowHint] = useState(false);

  const reset = useCallback(() => {
    setShowHint(false);
  }, []);

  useEffect(() => {
    if (!enabled) return;
    const timer = setTimeout(() => {
      setShowHint(true);
      onTimeout();
    }, timeoutMs);
    return () => clearTimeout(timer);
  }, [timeoutMs, onTimeout, enabled]);

  return { showHint, reset };
}
