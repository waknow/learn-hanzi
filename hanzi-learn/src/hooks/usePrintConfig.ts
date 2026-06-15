'use client';

import { useState, useCallback, useEffect } from 'react';

export type PrintFont = '楷体' | '宋体' | '黑体' | '圆体';
export type PrintSize = '36pt' | '48pt' | '60pt' | '72pt';
export type CutLine = '虚线' | '圆点' | '实线标记' | '隐藏';

export interface PrintConfig {
  font: PrintFont;
  size: PrintSize;
  cutLine: CutLine;
  showPinyin: boolean;
  showColor: boolean;   // 染色系统开关
  coefficient: number; // 0.5 ~ 3.0, 步进 0.5
}

const STORAGE_KEY = 'hanzi_print_config';
const DEFAULT_CONFIG: PrintConfig = {
  font: '楷体',
  size: '48pt',
  cutLine: '虚线',
  showPinyin: false,
  showColor: false,
  coefficient: 1.0,
};

function loadConfig(): PrintConfig {
  if (typeof window === 'undefined') return DEFAULT_CONFIG;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_CONFIG;
    return { ...DEFAULT_CONFIG, ...JSON.parse(raw) };
  } catch {
    return DEFAULT_CONFIG;
  }
}

function saveConfig(config: PrintConfig) {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(config));
  } catch { /* noop */ }
}

export const COEFFICIENT_OPTIONS = [
  { value: 0.5, label: '0.5x' },
  { value: 1.0, label: '1.0x' },
  { value: 1.5, label: '1.5x' },
  { value: 2.0, label: '2.0x' },
  { value: 2.5, label: '2.5x' },
  { value: 3.0, label: '3.0x' },
];

export function usePrintConfig() {
  const [config, setConfigState] = useState<PrintConfig>(DEFAULT_CONFIG);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    setConfigState(loadConfig());
    setLoaded(true);
  }, []);

  const setConfig = useCallback((patch: Partial<PrintConfig>) => {
    setConfigState(prev => {
      const next = { ...prev, ...patch };
      saveConfig(next);
      return next;
    });
  }, []);

  return { config, setConfig, loaded };
}
