/**
 * 保底句池单测
 */
import { describe, it, expect } from 'vitest';
import { getFallbackSentence, pickFallbackUsedChars } from './fallbackSentences';

describe('getFallbackSentence', () => {
  it('返回非空句子', () => {
    const s = getFallbackSentence();
    expect(s.length).toBeGreaterThan(0);
  });

  it('样本足够多样（句池为古诗，>10 句）', () => {
    const seen = new Set(Array.from({ length: 200 }, () => getFallbackSentence()));
    expect(seen.size).toBeGreaterThan(10);
  });
});

describe('pickFallbackUsedChars', () => {
  it('只返回允许集中的字且去重', () => {
    const used = pickFallbackUsedChars('小猫爱吃鱼', new Set(['小', '鱼']));
    expect(used.sort()).toEqual(['小', '鱼']);
  });

  it('无命中返回空数组', () => {
    expect(pickFallbackUsedChars('牧童骑黄牛', new Set(['龘']))).toEqual([]);
  });

  it('忽略非汉字字符', () => {
    expect(pickFallbackUsedChars('A小1', new Set(['小']))).toEqual(['小']);
  });
});
