import { NextResponse } from 'next/server';
import { findExtraChars, findUsedChars, hasSensitiveContent } from '@/lib/validator';
import { getFallbackSentence, pickFallbackUsedChars } from '@/lib/fallbackSentences';

const DEEPSEEK_API_URL = 'https://api.deepseek.com/chat/completions';
// 模型名：默认 deepseek-v4-flash（DeepSeek V4 系列，旧名 deepseek-chat 计划 2026-07-24 停用）
// 可用环境变量 DEEPSEEK_MODEL 覆盖，如 deepseek-v4-pro
const DEEPSEEK_MODEL = process.env.DEEPSEEK_MODEL || 'deepseek-v4-flash';
const MAX_RETRIES = 3;
const MIN_USED_CHARS = 1;
// 自评阈值：任一维度低于各自阈值则重试（模型自评容易虚高，阈值从严）
const MIN_FLUENCY = 8;    // 自然度
const MIN_SPOKEN = 6;     // 口语化
const MIN_COMPLETE = 8;   // 意思完整度
const MIN_SCORE = 7;      // 三维平均分下限（日志参考）

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
- 意思和通顺永远排在第一位：如果权重高的字实在组不成合理句子，宁可放弃它们改用其他字，绝不为了凑字牺牲意思
- 输出的内容必须表达一个完整、明确的意思（谁/什么 + 做什么/怎么样），并且符合现实生活常识、描述真实存在的事情。禁止“家是圆的”“圆圆的家”这类意思荒谬、不符合常识的句子
- 如果给定字实在组不成意思完整且符合常识的句子，宁可输出最短的合理词语（如“圆圆的”），也不要硬凑荒谬句子
- 内容贴近小朋友的日常生活（家里、幼儿园、动物、食物、天气、游戏等），符合学龄前儿童认知
- 倾向可爱的词句，像小朋友平时说话
- 优先确保通顺，而不是堆字凑字。如果两三个字的词语通顺度超过长句子，优先使用词语
- 输出的内容中最后只有一个主旨，不要堆砌多个主旨
- 只输出一个结果（一个字、一个词、或一个短句）
- 输出格式：结果【自然程度-口语化-完整度】，例如：小猫【自然程度-9 口语化-9 完整度-9】
- 自然程度评分（1-10）：读起来是否自然、常用。必须>=8，如果低于8，减少句子长度
- 口语化评分（1-10）：像不像平时说话，不要太书面化
- 完整度评分（1-10）：意思是否完整明确、是否符合常识。必须>=8
- 内容积极、有童趣
- 禁止：暴力、负面、辱骂、死亡

先输出结果，再输出评分，不要其他内容。`;

/** 构建用户消息（每次变化的字列表和权重） */
function buildUserMsg(themeWeights?: string): string {
  const parts: string[] = [];
  let charsOnly = '';

  if (themeWeights) {
    try {
      const arr: { char: string; weight: number }[] = JSON.parse(themeWeights);
      arr.sort((a, b) => b.weight - a.weight);
      const sortedJson = JSON.stringify(arr);
      parts.push(`主题字（按weight从高到低）：${sortedJson}`);
      charsOnly = arr.map((c) => c.char).join('');
    } catch {
      parts.push(`主题字及权重：${themeWeights}`);
    }
  }

  parts.push('规则：weight数值越大，表示这个字越重要，越要优先使用。');
  // 纯文本可用字列表：模型对 JSON 中的字遵守较弱，空格分隔单字显式列出，降低越界概率
  if (charsOnly) {
    parts.push(`可用字（只能从这些字里选，绝不能使用任何其他字）：${charsOnly.split('').join(' ')}`);
  }

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
    // 记录本轮已被拒绝的输出，用于检测模型固执重复
    const attemptedOutputs: string[] = [];
    for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
      log(`[${requestId}] ====== 尝试 ${attempt + 1}/${MAX_RETRIES} ======`);

      // 重试时逐步提高随机性，打破模型重复输出同一内容的僵局
      const temperature = [0.4, 0.7, 1.0][attempt] ?? 1.0;
      const requestBody = {
        model: DEEPSEEK_MODEL,
        messages,
        // V4 系列默认开启思考模式；句子生成无需推理，显式关闭以降低延迟与成本
        thinking: { type: 'disabled' },
        temperature,
        max_tokens: 300,
      };
      log(`[${requestId}] 请求模型: ${DEEPSEEK_MODEL} (thinking: disabled) 温度: ${temperature}`);

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
            { role: 'user', content: '不能输出空内容，请直接从可用字里选字输出。直接输出结果和评分，不要任何解释' }
          );
          continue;
        }

        // 检查0：重复输出检测（模型固执重复时直接要求换新）
        const isDuplicate = attemptedOutputs.some((prev) => prev === text);
        attemptedOutputs.push(text);
        if (isDuplicate) {
          log(`[${requestId}] 检查0 - 重复输出: ❌ 与之前相同`);
          messages.push(
            { role: 'assistant', content: text },
            { role: 'user', content: `“${text}”这个内容已经试过了不能通过，请从可用字里换一组完全不同的字，组合成一个新的简单通顺的词或短句。直接输出结果和评分，不要解释、道歉或任何多余文字` }
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
            { role: 'user', content: '输出中包含不适合儿童的内容，请重新输出一个积极健康的。直接输出结果和评分，不要任何解释' }
          );
          continue;
        }

        // 剥离评分后缀（避免“自然程度/口语化/完整度”等标签字被误判为越界字）
        const scoreSuffixMatch = text.match(/【[^】]+】$/);
        const textBody = scoreSuffixMatch
          ? text.slice(0, scoreSuffixMatch.index ?? text.length)
          : text;

        // 检查2：越界字（基于去掉评分后缀的正文）
        const extraChars = findExtraChars(textBody, allowedSet);
        log(`[${requestId}] 检查2 - 越界字: ${extraChars.length > 0 ? `❌ 发现 ${extraChars}: ${JSON.stringify(extraChars)}` : '✅ 通过'}`);
        if (extraChars.length > 0) {
          // 回传：列出越界字 + 明确可用字，并要求换新、禁止解释
          messages.push(
            { role: 'assistant', content: text },
            { role: 'user', content: `“${extraChars.join('')}”这些字不在可用字里，绝对不允许使用。可用字只有：${sortedCharsStr}。请从这些字里重新选一组完全不同的字，组合成一个简单通顺的词或短句。直接输出结果和评分，不要解释、道歉或任何多余文字` }
          );
          continue;
        }

        // 检查3：最少使用字数量（基于正文）
        const usedChars = findUsedChars(textBody, allowedSet);
        log(`[${requestId}] 检查3 - 最少字数: ${usedChars.length < MIN_USED_CHARS ? `❌ 只用 ${usedChars.length} 个字` : `✅ 通过 (${usedChars.length}个)`}`);
        if (usedChars.length < MIN_USED_CHARS) {
          // 回传：至少用 MIN_USED_CHARS 个字，并换新
          messages.push(
            { role: 'assistant', content: text },
            { role: 'user', content: `至少使用 ${MIN_USED_CHARS} 个可用字，请换一组字重新输出。直接输出结果和评分，不要任何解释` }
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
        // 正式格式：【自然程度-9 口语化-9 完整度-9】
        // 兼容旧格式：【自然程度-9 口语化-9】和【9-8】（缺完整度视为不通过）
        let fluencyScore = -1;
        let spokenScore = -1;
        let completeScore = -1;
        let scoreMatch = text.match(/【自然程度-(\d+)\s+口语化-(\d+)\s+完整度-(\d+)】$/);
        if (scoreMatch) {
          fluencyScore = parseInt(scoreMatch[1], 10);
          spokenScore = parseInt(scoreMatch[2], 10);
          completeScore = parseInt(scoreMatch[3], 10);
        } else {
          // 兼容旧格式
          scoreMatch = text.match(/【(?:自然程度-)?(\d+)\s+口语化-(\d+)】$/);
          if (scoreMatch) {
            fluencyScore = parseInt(scoreMatch[1], 10);
            spokenScore = parseInt(scoreMatch[2], 10);
          } else {
            scoreMatch = text.match(/【(\d+)-(\d+)】$/);
            if (scoreMatch) {
              fluencyScore = parseInt(scoreMatch[1], 10);
              spokenScore = parseInt(scoreMatch[2], 10);
            }
          }
        }
        const avgScore = fluencyScore >= 1 && spokenScore >= 1 && completeScore >= 1
          ? Math.round((fluencyScore + spokenScore + completeScore) / 3)
          : -1;
        const scoresOk = fluencyScore >= MIN_FLUENCY
          && spokenScore >= MIN_SPOKEN
          && completeScore >= MIN_COMPLETE;
        log(`[${requestId}] 检查4 - 自评: 自然${fluencyScore} 口语${spokenScore} 完整${completeScore} 平均${avgScore} ${scoresOk ? '✅' : '❌ 未达阈值'}`);

        if (scoresOk) {
          // 移除评分后缀，只返回纯文本（兼容三种格式后缀）
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
          // 评分过低、格式不对或缺维度，回传要求改进
          let reason: string;
          if (!scoreMatch) {
            reason = '输出格式不对，请在结果后面加上【自然程度-口语化-完整度】评分，例如：小猫【自然程度-9 口语化-9 完整度-9】';
          } else if (completeScore < 0) {
            reason = '缺少意思完整度评分，请按【自然程度-X 口语化-X 完整度-X】格式重新输出';
          } else if (fluencyScore < MIN_FLUENCY || completeScore < MIN_COMPLETE) {
            reason = `当前评分过低（自然${fluencyScore} 口语${spokenScore} 完整${completeScore}），句子必须意思完整、符合常识、自然通顺，请重新输出`;
          } else {
            reason = `口语化评分偏低（${spokenScore}），请像小朋友平时说话一样重新输出`;
          }
          messages.push(
            { role: 'assistant', content: text },
            { role: 'user', content: `${reason}。另外请换一个与之前不同的内容` }
          );
          continue;
        }
      } catch (err) {
        log(`[${requestId}] ❌ 请求异常:`, err instanceof Error ? err.message : err);
        continue;
      }
    }

    // 全部重试失败，降级到保底句（优先与字库相关的句子）
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
