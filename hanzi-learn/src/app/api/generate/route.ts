import { NextResponse } from 'next/server';
import { findExtraChars, findUsedChars, hasSensitiveContent } from '@/lib/validator';
import { getFallbackSentence, pickFallbackUsedChars } from '@/lib/fallbackSentences';

const DEEPSEEK_API_URL = 'https://api.deepseek.com/chat/completions';
const MAX_RETRIES = 3;
const MIN_USED_CHARS = 1;
const MIN_SCORE = 5; // 自评分数低于此值则重试

/** 带时间戳的日志 */
function log(...args: unknown[]) {
  const time = new Date().toISOString().slice(11, 23);
  console.log(`[${time}] [generate]`, ...args);
}

/** 系统提示词（不变部分，可被 DeepSeek prompt caching 缓存） */
const SYSTEM_PROMPT = `你是一位专业幼儿老师，正在教小朋友认字，需要按照字库里的字来组成一个有趣的句子，句子内容积极、童趣、健康，禁止出现暴力、负面、辱骂、死亡等内容。

规则：
- 只用下面提供的字，不能加别的字
- 提供的词库包含权重信息，数字越大，越优先使用
- 尽量使用权重高的字，少用权重低的字
- 尽量贴合幼儿说话的习惯，倾向可爱的词句
- 优先确保通顺，而不是堆字凑字。如果两三个字的词语通顺度超过长句子，优先使用词语
- 输出的内容中最后只有一个主旨，不要堆砌多个主旨
- 只输出一个结果（一个字、一个词、或一个短句）
- 输出格式：结果【自然程度分数数值-口语化分数数值】，例如：小猫【9-8】
- 自然程度评分（1-10）：读起来是否自然，是否常用，自然度需要>=8，如果低于8，减少句子长度
- 口语化评分（1-10）：像不像平时说话，不要太书面化，符合学龄前儿童认知
- 内容积极、有童趣
- 禁止：暴力、负面、辱骂、死亡

先输出结果，再输出评分，不要其他内容。`;

/** 构建用户消息（每次变化的字列表和权重） */
function buildUserMsg(themeWeights?: string): string {
  const parts: string[] = [];

  if (themeWeights) {
    try {
      const arr: { char: string; weight: number }[] = JSON.parse(themeWeights);
      arr.sort((a, b) => b.weight - a.weight);
      const sortedJson = JSON.stringify(arr);
      parts.push(`主题字（按weight从高到低）：${sortedJson}`);
    } catch {
      parts.push(`主题字及权重：${themeWeights}`);
    }
  }

  parts.push('规则：weight数值越大，表示这个字越重要，越要优先使用。');

  return parts.join('\n');
}

export async function POST(req: Request) {
  const requestId = Math.random().toString(36).slice(2, 8);
  log(`[${requestId}] ====== 开始生成句子 ======`);

  try {
    const body = await req.json();
    const { bankId, sortedChars, themeWeights } = body as {
      bankId: string; sortedChars: string; themeWeights?: string;
    };

    log(`[${requestId}] 请求参数:`, {
      bankId,
      sortedCharsLen: sortedChars?.length,
      hasWeights: !!themeWeights,
    });

    if (!bankId || !sortedChars) {
      log(`[${requestId}] ❌ 缺少必要参数: bankId=${bankId}, sortedChars=${sortedChars}`);
      return NextResponse.json(
        { error: 'invalid_request', message: '缺少必要参数' },
        { status: 400 }
      );
    }

    const sortedCharsStr = String(sortedChars);
    const allowedSet = new Set<string>(sortedCharsStr.split(''));
    const apiKey = process.env.DEEPSEEK_API_KEY;

    // 检查 API Key
    log(`[${requestId}] API Key 状态:`, {
      exists: !!apiKey,
      length: apiKey?.length,
      preview: apiKey ? apiKey.slice(0, 8) + '...' : '(none)',
      envKeys: Object.keys(process.env).filter(k => k.includes('DEEP') || k.includes('API')),
    });

    if (!apiKey || apiKey === 'your_deepseek_api_key_here') {
      log(`[${requestId}] ⚠️ 无有效 API Key，使用保底句`);
      const text = getFallbackSentence();
      const usedChars = pickFallbackUsedChars(text, allowedSet);
      log(`[${requestId}] ✅ 保底句: "${text}", 用字:`, usedChars);
      return NextResponse.json({
        text,
        usedChars,
        extraChars: [],
        isFallback: true,
      });
    }

    // 构造请求体
    const userMsg = buildUserMsg(themeWeights);
    const messages: { role: string; content: string }[] = [
      { role: 'system', content: SYSTEM_PROMPT },
      { role: 'user', content: userMsg },
    ];

    log(`[${requestId}] ====== DeepSeek 完整 Prompt ======`);
    if (themeWeights) log(`[${requestId}] [权重JSON] ${themeWeights}`);
    log(`[${requestId}] [SYSTEM]\n${SYSTEM_PROMPT}`);
    log(`[${requestId}] [USER]\n${userMsg}`);
    log(`[${requestId}] ====== Prompt 结束 ======`);

    // 最多重试 MAX_RETRIES 次，每次失败将原因回传给模型
    for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
      log(`[${requestId}] ====== 尝试 ${attempt + 1}/${MAX_RETRIES} ======`);

      const requestBody = {
        model: 'deepseek-chat',
        messages,
        temperature: 0.5,
        max_tokens: 300,
      };

      try {
        const startTime = Date.now();

        const response = await fetch(DEEPSEEK_API_URL, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${apiKey}`,
          },
          body: JSON.stringify(requestBody),
        });

        const elapsed = Date.now() - startTime;
        log(`[${requestId}] DeepSeek 响应状态: ${response.status} (${elapsed}ms)`);

        if (!response.ok) {
          const errorText = await response.text();
          log(`[${requestId}] ❌ DeepSeek HTTP 错误: ${response.status}, body: ${errorText}`);
          continue;
        }

        const data = await response.json();
        const text: string = (data.choices?.[0]?.message?.content || '').trim();
        log(`[${requestId}] DeepSeek → "${text}"`);

        if (!text) {
          log(`[${requestId}] ❌ 空文本，完整响应:`, JSON.stringify(data).slice(0, 600));
          // 回传：告诉模型不能返回空
          messages.push(
            { role: 'assistant', content: '' },
            { role: 'user', content: '不能输出空内容，请直接从可用字里选字输出' }
          );
          continue;
        }

        // 检查1：敏感词
        const hasSensitive = hasSensitiveContent(text);
        log(`[${requestId}] 检查1 - 敏感词: ${hasSensitive ? '❌ 命中' : '✅ 通过'}`);
        if (hasSensitive) {
          // 回传：告诉模型输出包含敏感内容
          messages.push(
            { role: 'assistant', content: text },
            { role: 'user', content: '输出中包含不适合儿童的内容，请重新输出一个积极健康的' }
          );
          continue;
        }

        // 检查2：越界字
        const extraChars = findExtraChars(text, allowedSet);
        log(`[${requestId}] 检查2 - 越界字: ${extraChars.length > 0 ? `❌ 发现 ${extraChars}: ${JSON.stringify(extraChars)}` : '✅ 通过'}`);
        if (extraChars.length > 0) {
          // 回传：列出哪些字越界了
          messages.push(
            { role: 'assistant', content: text },
            { role: 'user', content: `"${extraChars.join('')}" 这些字不可以使用，只能从给定的字里选` }
          );
          continue;
        }

        // 检查3：最少使用字数量
        const usedChars = findUsedChars(text, allowedSet);
        log(`[${requestId}] 检查3 - 最少字数: ${usedChars.length < MIN_USED_CHARS ? `❌ 只用 ${usedChars.length} 个字` : `✅ 通过 (${usedChars.length}个)`}`);
        if (usedChars.length < MIN_USED_CHARS) {
          // 回传：至少用 MIN_USED_CHARS 个字
          messages.push(
            { role: 'assistant', content: text },
            { role: 'user', content: `至少使用 ${MIN_USED_CHARS} 个字，请重新输出` }
          );
          continue;
        }

        // 命中字权重日志
        try {
          if (themeWeights) {
            const weightArr = JSON.parse(themeWeights) as { char: string; weight: number }[];
            const weightMap = new Map(weightArr.map(w => [w.char, w.weight]));
            const usedWeights = usedChars
              .filter(c => weightMap.has(c))
              .map(c => `${c}(${weightMap.get(c)})`);
            if (usedWeights.length > 0) {
              log(`[${requestId}] 命中字权重:`, usedWeights.join(' '));
            }
          }
        } catch { /* weights parse error, skip */ }

        // 检查4：提取评分并校验
        // 兼容两种格式：旧版【9-8】和新版【自然程度-9 口语化-9】
        let matchResult = text.match(/【(?:自然程度-)?(\d+)\s+口语化-(\d+)】$/);
        if (!matchResult) {
          // 尝试旧格式
          matchResult = text.match(/【(\d+)-(\d+)】$/);
        }
        const scoreMatch = matchResult;
        let fluencyScore = -1;
        let spokenScore = -1;
        if (scoreMatch) {
          fluencyScore = parseInt(scoreMatch[1], 10);
          spokenScore = parseInt(scoreMatch[2], 10);
        }
        const avgScore = fluencyScore >= 1 && spokenScore >= 1
          ? Math.round((fluencyScore + spokenScore) / 2)
          : -1;
        log(`[${requestId}] 检查4 - 自评: 通顺${fluencyScore} 口语${spokenScore} 平均${avgScore} ${avgScore >= MIN_SCORE ? `✅` : `❌ < ${MIN_SCORE}`}`);

        if (avgScore >= MIN_SCORE) {
          // 移除评分后缀，只返回纯文本（兼容两种格式后缀）
          const cleanText = text.replace(/【[^】]+】$/, '').trim();
          log(`[${requestId}] ✅✅✅ 全部检查通过！返回句子: "${cleanText}"`);
          log(`[${requestId}] 使用汉字:`, usedChars);
          return NextResponse.json({
            text: cleanText,
            usedChars,
            extraChars: [],
            isFallback: false,
          });
        } else {
          // 评分过低或格式不对，回传要求改进
          const reason = avgScore < 0
            ? '输出格式不对，请在结果后面加上【自然程度-口语化】评分，例如：小猫【自然程度-9 口语化-9】'
            : `通顺度或口语化评分偏低（${avgScore}分），请输出更自然通顺的内容`;
          messages.push(
            { role: 'assistant', content: text },
            { role: 'user', content: reason }
          );
          continue;
        }
      } catch (err) {
        log(`[${requestId}] ❌ 请求异常:`, err instanceof Error ? err.message : err);
        continue;
      }
    }

    // 全部重试失败，降级到保底句
    log(`[${requestId}] ⚠️ ${MAX_RETRIES} 次重试均失败，降级到保底句`);
    const fallbackText = getFallbackSentence();
    const fallbackUsedChars = pickFallbackUsedChars(fallbackText, allowedSet);
    log(`[${requestId}] ✅ 保底句: "${fallbackText}", 用字:`, fallbackUsedChars);
    return NextResponse.json({
      text: fallbackText,
      usedChars: fallbackUsedChars,
      extraChars: [],
      isFallback: true,
    });
  } catch (err) {
    log(`[${requestId}] 💥 未捕获异常:`, err instanceof Error ? err.message : err);
    if (err instanceof Error && err.stack) {
      log(`[${requestId}] Stack:`, err.stack.split('\n').slice(0, 5).join('\n'));
    }
    return NextResponse.json(
      { error: 'server_error', message: '服务器内部错误' },
      { status: 500 }
    );
  }
}
