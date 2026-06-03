'use client';

import { useRef, useCallback, useEffect } from 'react';
import { SoundEngine } from '@/lib/soundEngine';

export type SoundAction = 'ding' | 'rocket' | 'success' | 'error' | 'tick';

/**
 * 音效 Hook
 *
 * 在首次用户交互时初始化 AudioContext（iOS 限制）。
 * 返回 { init, play, speak }。
 */
export function useSound() {
  const engineRef = useRef<SoundEngine | null>(null);
  const initedRef = useRef(false);

  /** 初始化音效引擎（必须在用户手势中调用） */
  const init = useCallback(() => {
    if (initedRef.current) return;
    const engine = new SoundEngine();
    engine.ensureContext();
    engineRef.current = engine;
    initedRef.current = true;
  }, []);

  /** 播放音效 */
  const play = useCallback(
    (action: SoundAction) => {
      init(); // 确保已初始化
      const engine = engineRef.current;
      if (!engine) return;
      switch (action) {
        case 'ding':
          engine.ding();
          break;
        case 'rocket':
          engine.rocket();
          break;
        case 'success':
          engine.success();
          break;
        case 'error':
          engine.error();
          break;
        case 'tick':
          engine.tick();
          break;
      }
    },
    [init]
  );

  /** 语音朗读 */
  const speak = useCallback(
    (text: string) => {
      init();
      engineRef.current?.speak(text);
    },
    [init]
  );

  /** 清理 */
  useEffect(() => {
    return () => {
      engineRef.current?.dispose();
      engineRef.current = null;
      initedRef.current = false;
    };
  }, []);

  return { init, play, speak };
}
