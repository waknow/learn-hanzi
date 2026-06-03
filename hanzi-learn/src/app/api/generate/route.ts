import { NextResponse } from 'next/server';
import { findExtraChars, findUsedChars, hasSensitiveContent } from '@/lib/validator';
import { getFallbackSentence, pickFallbackUsedChars } from '@/lib/fallbackSentences';

const DEEPSEEK_API_URL = 'https://api.deepseek.com/chat/completions';
const MAX_RETRIES = 3;
const MIN_USED_CHARS = 2;

function buildPrompt(sortedChars: string): string {
  return `你是一位有10年经验的儿童语文老师，专为6-9岁小朋友编写句子。

## 核心规则（必须严格遵守）
1. 你只能使用下方提供的汉字来造句，不可以添加任何其他汉字
2. 必须优先使用序列中靠前的汉字
3. 句子长度：每句不超过15个字，总共1-2句
4. 内容：积极向上、充满童趣和想象力

## 严禁内容
暴力、负面情绪、辱骂、歧视、恐怖、性暗示、死亡相关内容

## 输出格式
只返回生成的句子，不要任何额外说明

## 可以使用的汉字（仅限这些）
${sortedChars}`;
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { bankId, sortedChars } = body as { bankId: string; sortedChars: string };

    if (!bankId || !sortedChars) {
      return NextResponse.json(
        { error: 'invalid_request', message: '缺少必要参数' },
        { status: 400 }
      );
    }

    const sortedCharsStr = String(sortedChars);
    const allowedSet = new Set<string>(sortedCharsStr.split(''));
    const apiKey = process.env.DEEPSEEK_API_KEY;

    if (!apiKey || apiKey === 'your_deepseek_api_key_here') {
      // 无 API Key 时直接返回保底句
      const text = getFallbackSentence(bankId);
      const usedChars = pickFallbackUsedChars(text, allowedSet);
      return NextResponse.json({
        text,
        usedChars,
        extraChars: [],
        isFallback: true,
      });
    }

    // 最多重试 MAX_RETRIES 次
    for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
      try {
        const response = await fetch(DEEPSEEK_API_URL, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${apiKey}`,
          },
          body: JSON.stringify({
            model: 'deepseek-chat',
            messages: [
              { role: 'system', content: buildPrompt(sortedCharsStr) },
              {
                role: 'user',
                content: `请只使用这些汉字造句：${sortedCharsStr}`,
              },
            ],
            temperature: 0.7,
            max_tokens: 100,
          }),
        });

        if (!response.ok) continue;

        const data = await response.json();
        const text: string = (data.choices?.[0]?.message?.content || '').trim();

        if (!text) continue;

        // 检查1：敏感词
        if (hasSensitiveContent(text)) continue;

        // 检查2：越界字
        const extraChars = findExtraChars(text, allowedSet);
        if (extraChars.length > 0) continue;

        // 检查3：最少使用字数量
        const usedChars = findUsedChars(text, allowedSet);
        if (usedChars.length < MIN_USED_CHARS) continue;

        // 全部通过
        return NextResponse.json({
          text,
          usedChars,
          extraChars: [],
          isFallback: false,
        });
      } catch {
        continue;
      }
    }

    // 全部重试失败，降级到保底句
    const text = getFallbackSentence(bankId);
    const usedChars = pickFallbackUsedChars(text, allowedSet);
    return NextResponse.json({
      text,
      usedChars,
      extraChars: [],
      isFallback: true,
    });
  } catch {
    return NextResponse.json(
      { error: 'server_error', message: '服务器内部错误' },
      { status: 500 }
    );
  }
}
