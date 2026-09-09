import { NextResponse } from "next/server";
import { checkGeneratedOutput } from "@/lib/generationRules";
import { readState } from "@/lib/server/stateStore";
import { getEffectiveModel, isModelAvailable } from "@/lib/server/modelStore";
import { DEFAULT_MODEL } from "@/lib/modelCatalog";
import { DEBUG_ENABLED } from "@/lib/debug";

const DEEPSEEK_API_URL = "https://api.deepseek.com/chat/completions";
// 模型名解析优先级（见 lib/modelCatalog.ts）：
//   1. 家长在设置页手动选定的模型（持久化在 data/state.json 的 config.model）
//   2. 环境变量 DEEPSEEK_MODEL（如 deepseek-v4-pro）
//   3. 内置默认 DEFAULT_MODEL（deepseek-v4-flash）
// 每次请求都重新解析，家长切换后无需重启服务。
// 调试开关：DEBUG_PROMPT=1 时打印完整 Prompt（默认关闭，保持生产日志干净）
const DEBUG_PROMPT = process.env.DEBUG_PROMPT === "1";
const MAX_RETRIES = 3;
// 服务端启发式校验规则（最少字数 / 最大长度 / 越界字 / 敏感词 / 去重）见 lib/generationRules.ts

// DeepSeek 请求超时（毫秒）：上游挂起时中止请求并进入重试，避免无限占用连接。
// 可用环境变量 DEEPSEEK_TIMEOUT_MS 覆盖（测试用）。
const DEEPSEEK_TIMEOUT_MS = 12000;

/** 读取请求超时毫秒数（env 覆盖；非法值回退默认） */
function getDeepSeekTimeoutMs(): number {
  const raw = process.env.DEEPSEEK_TIMEOUT_MS;
  const n = raw ? Number(raw) : NaN;
  return Number.isFinite(n) && n > 0 ? n : DEEPSEEK_TIMEOUT_MS;
}

// 重试指数退避基数（毫秒）：第 n 次重试前等待 base * 2^(n-1)。
// 可用环境变量 DEEPSEEK_RETRY_BASE_MS 覆盖（测试置 0 保持用例快速）。
const RETRY_BASE_MS = 500;

/** 读取重试退避基数（env 覆盖；非法值回退默认） */
function getRetryBaseMs(): number {
  const raw = process.env.DEEPSEEK_RETRY_BASE_MS;
  const n = raw ? Number(raw) : NaN;
  return Number.isFinite(n) && n >= 0 ? n : RETRY_BASE_MS;
}

/* ===== 最近生成历史（避免重复生成相同内容） ===== */

/** 每个字库最多记住的最近句子数 */
const RECENT_LIMIT = 8;
/** 本次运行期间各字库已展示的句子（内存，最及时；跨重启历史见 getRecentShown） */
const recentSentences = new Map<string, string[]>();

/** 记录一次已展示的句子（AI 生成或保底句），供后续请求避免重复 */
function recordShown(bankId: string, text: string) {
  const list = recentSentences.get(bankId) ?? [];
  // 与最近一条完全相同则跳过
  if (list[list.length - 1] === text) return;
  list.push(text);
  if (list.length > RECENT_LIMIT) list.splice(0, list.length - RECENT_LIMIT);
  recentSentences.set(bankId, list);
}

/** 取该字库最近展示的句子（内存历史 + 持久化 sentenceHistory，去重，最多 RECENT_LIMIT 条） */
function getRecentShown(bankId: string): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  const push = (t: string) => {
    const clean = t.trim();
    if (!clean || seen.has(clean)) return;
    seen.add(clean);
    result.push(clean);
  };
  // 1) 内存历史（本次运行，最新在队尾 → 反序取最近）
  for (const t of [...(recentSentences.get(bankId) ?? [])].reverse()) push(t);
  // 2) 持久化历史（state.json，客户端 recordCall 推送，最新在前）
  try {
    const state = readState();
    for (const r of state.stats.sentenceHistory) {
      if (r.bankId === bankId) push(r.text);
    }
  } catch {
    // 读取失败忽略，仅用内存历史
  }
  return result.slice(0, RECENT_LIMIT);
}

/** 降级兜底：从权重列表挑权重最大的字；无权重信息时取 sortedChars 第一个字 */
function pickFallbackChar(themeWeights?: string, sortedChars?: string): string {
  if (themeWeights) {
    try {
      const arr: { char: string; weight: number }[] = JSON.parse(themeWeights);
      if (arr.length > 0) {
        let best = arr[0];
        for (const item of arr) {
          if (item.weight > best.weight) best = item;
        }
        if (best.char) return best.char;
      }
    } catch {
      // themeWeights 解析失败，走 sortedChars 兜底
    }
  }
  return (sortedChars ?? "")[0] ?? "";
}

/** 带时间戳的日志 */
function log(...args: unknown[]) {
  const time = new Date().toISOString().slice(11, 23);
  console.log(`[${time}] [generate]`, ...args);
}

/** 系统提示词（不变部分，可被 DeepSeek prompt caching 缓存） */
const SYSTEM_PROMPT = `你是一位专业幼儿老师，正在教小朋友认字。请用字库里的字组成一个有趣、童趣、健康的短句或词语，贴近小朋友的日常生活（家里、幼儿园、动物、食物、天气、游戏等），像小朋友平时说话一样可爱。

规则：
- 只用下面提供的可用字，不能加任何其他字
- 权重数字越大，这个字越重要，越要优先使用；如果权重高的字实在组不成通顺句子，宁可放弃它们改用其他字
- 意思和通顺永远排在第一位，绝不为了凑字牺牲意思
- 必须表达一个完整、明确的意思（谁/什么 + 做什么/怎么样），符合现实生活常识，禁止“家是圆的”这类意思荒谬的内容
- 如果实在组不成意思完整的句子，宁可输出最短的合理词语（如“圆圆的”），也不要硬凑荒谬句子
- 优先保证通顺：两三个字的词语比长句子通顺时，优先用词语
- 只输出一个结果（一个词或一个短句），2 到 12 个字；内容积极、有童趣，禁止暴力、负面、辱骂、死亡
- 直接输出结果即可，不要解释、不要任何额外内容

输出示例（仅示意格式，示例中的字可能不在可用字里，务必只用可用字）：
- 太阳出来了`;

/** 构建用户消息（每次变化的字列表和权重） */
function buildUserMsg(themeWeights?: string, recentShown?: string[]): string {
  const parts: string[] = [];

  if (themeWeights) {
    try {
      const arr: { char: string; weight: number }[] = JSON.parse(themeWeights);
      // 内联权重：字集合 + 优先级一次给全
      // （原实现 JSON 与纯文本两处重复同一字符集合，token 减半且信息不丢）
      arr.sort((a, b) => b.weight - a.weight);
      parts.push(
        `可用字（只能从这些字里选，绝不能使用任何其他字；括号内是权重，数字越大越优先）：${arr
          .map((c) => `${c.char}(${c.weight})`)
          .join(" ")}`,
      );
    } catch {
      parts.push(`可用字及权重：${themeWeights}`);
    }
  }

  // 最近生成历史：避免重复输出相同内容
  if (recentShown && recentShown.length > 0) {
    parts.push(
      `最近已经生成过这些句子，禁止重复生成其中任何一个，请输出完全不同的内容（仍只能用可用字）：${recentShown.join("、")}`,
    );
  }

  return parts.join("\n");
}

export async function POST(req: Request) {
  const requestId = Math.random().toString(36).slice(2, 8);
  log(`[${requestId}] ====== 开始生成句子 ======`);

  try {
    const body = await req.json();
    const { bankId, sortedChars, themeWeights } = body as {
      bankId: string;
      sortedChars: string;
      themeWeights?: string;
    };

    log(`[${requestId}] 请求参数:`, {
      bankId,
      sortedCharsLen: sortedChars?.length,
      hasWeights: !!themeWeights,
    });

    if (!bankId || !sortedChars) {
      log(`[${requestId}] ❌ 缺少必要参数: bankId=${bankId}, sortedChars=${sortedChars}`);
      return NextResponse.json(
        { error: "invalid_request", message: "缺少必要参数" },
        { status: 400 },
      );
    }

    const sortedCharsStr = String(sortedChars);
    const allowedSet = new Set<string>(sortedCharsStr.split(""));
    const apiKey = process.env.DEEPSEEK_API_KEY;

    // 解析本次请求使用的模型（家长手动选择 → env → 默认）
    const { model: resolvedModel, source: modelSource } = getEffectiveModel();
    let model = resolvedModel;
    // 手动选定的模型若已从账号下线，回退到默认模型并记录，避免整条链路失败
    if (modelSource === "manual" && !(await isModelAvailable(model))) {
      log(`[${requestId}] ⚠️ 手动选择的模型 ${model} 不在可用列表中，回退 ${DEFAULT_MODEL}`);
      model = DEFAULT_MODEL;
    }
    log(`[${requestId}] 使用模型: ${model} (来源: ${modelSource})`);

    // 检查 API Key（详细环境变量名仅在调试开关打开时打印，避免日志泄露配置）
    if (DEBUG_ENABLED) {
      log(`[${requestId}] API Key 状态:`, {
        exists: !!apiKey,
        length: apiKey?.length,
        preview: apiKey ? apiKey.slice(0, 8) + "..." : "(none)",
        envKeys: Object.keys(process.env).filter((k) => k.includes("DEEP") || k.includes("API")),
      });
    } else {
      log(`[${requestId}] API Key: ${apiKey ? "已配置" : "未配置"}`);
    }

    if (!apiKey || apiKey === "your_deepseek_api_key_here") {
      log(`[${requestId}] ⚠️ 无有效 API Key，直示权重最大单字`);
      const fallbackText = pickFallbackChar(themeWeights, sortedCharsStr);
      const fallbackUsedChars = fallbackText ? [fallbackText] : [];
      recordShown(bankId, fallbackText);
      log(`[${requestId}] ✅ 单字直示: "${fallbackText}"`);
      return NextResponse.json({
        text: fallbackText,
        usedChars: fallbackUsedChars,
        extraChars: [],
        isFallback: true,
      });
    }

    // 构造请求体（注入该字库最近生成历史，避免重复）
    const recentShown = getRecentShown(bankId);
    if (recentShown.length > 0) {
      log(`[${requestId}] 最近生成历史(${recentShown.length}条):`, recentShown.join("、"));
    }
    const userMsg = buildUserMsg(themeWeights, recentShown);
    const messages: { role: string; content: string }[] = [
      { role: "system", content: SYSTEM_PROMPT },
      { role: "user", content: userMsg },
    ];

    // 完整 Prompt 仅调试时打印（默认关闭，生产日志干净）
    if (DEBUG_PROMPT) {
      log(`[${requestId}] ====== DeepSeek 完整 Prompt ======`);
      if (themeWeights) log(`[${requestId}] [权重JSON] ${themeWeights}`);
      log(`[${requestId}] [SYSTEM]\n${SYSTEM_PROMPT}`);
      log(`[${requestId}] [USER]\n${userMsg}`);
      log(`[${requestId}] ====== Prompt 结束 ======`);
    }

    // 最多重试 MAX_RETRIES 次，每次失败将原因回传给模型
    // 记录本轮已被拒绝的输出，用于检测模型固执重复
    const attemptedOutputs: string[] = [];
    for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
      // 失败重试前指数退避（限流/超时场景避免连打加剧问题）
      if (attempt > 0) {
        const wait = getRetryBaseMs() * 2 ** (attempt - 1);
        if (wait > 0) {
          log(`[${requestId}] 退避 ${wait}ms 后重试`);
          await new Promise((resolve) => setTimeout(resolve, wait));
        }
      }
      log(`[${requestId}] ====== 尝试 ${attempt + 1}/${MAX_RETRIES} ======`);

      // 重试时逐步提高随机性，打破模型重复输出同一内容的僵局
      const temperature = [0.4, 0.7, 1.0][attempt] ?? 1.0;
      const requestBody = {
        model,
        messages,
        // V4 系列默认开启思考模式；句子生成无需推理，显式关闭以降低延迟与成本
        thinking: { type: "disabled" },
        temperature,
        // 输出只是一个词/短句（≤12 字），200 token 足够
        max_tokens: 200,
      };
      log(`[${requestId}] 请求模型: ${model} (thinking: disabled) 温度: ${temperature}`);

      // 超时控制：DeepSeek 挂起时中止请求并进入重试，不会无限占用连接
      const controller = new AbortController();
      const timeoutMs = getDeepSeekTimeoutMs();
      const abortTimer = setTimeout(() => controller.abort(), timeoutMs);

      try {
        const startTime = Date.now();

        const response = await fetch(DEEPSEEK_API_URL, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${apiKey}`,
          },
          body: JSON.stringify(requestBody),
          signal: controller.signal,
        });

        const elapsed = Date.now() - startTime;
        log(`[${requestId}] DeepSeek 响应状态: ${response.status} (${elapsed}ms)`);

        if (!response.ok) {
          const errorText = await response.text();
          log(`[${requestId}] ❌ DeepSeek HTTP 错误: ${response.status}, body: ${errorText}`);
          continue;
        }

        const data = await response.json();
        const text: string = (data.choices?.[0]?.message?.content || "").trim();
        log(`[${requestId}] DeepSeek → "${text}"`);

        if (!text) {
          log(`[${requestId}] ❌ 空文本，完整响应:`, JSON.stringify(data).slice(0, 600));
          // 回传：告诉模型不能返回空
          messages.push(
            { role: "assistant", content: "" },
            {
              role: "user",
              content: "不能输出空内容，请直接从可用字里选字输出。直接输出结果，不要任何解释",
            },
          );
          continue;
        }

        // 校验链（规则见 lib/generationRules.ts）：
        // 重复输出 → 敏感词 → 越界字 → 最少字数 → 最大长度 → 最近历史重复
        // 本轮输出先记入 attemptedOutputs（与旧实现一致：无论后续是否通过都算"试过"）
        const check = checkGeneratedOutput(text, {
          allowedSet,
          allowedChars: sortedCharsStr,
          recentShown,
          attemptedOutputs,
        });
        attemptedOutputs.push(text);

        if (!check.ok) {
          log(`[${requestId}] ${check.detail}`);
          messages.push(
            { role: "assistant", content: text },
            { role: "user", content: check.feedback },
          );
          continue;
        }

        const { text: cleanText, usedChars } = check;
        log(`[${requestId}] 检查链 ✅ 通过 (用字 ${usedChars.length} 个)`);

        // 命中字权重日志（调试用）
        try {
          if (themeWeights) {
            const weightArr = JSON.parse(themeWeights) as { char: string; weight: number }[];
            const weightMap = new Map(weightArr.map((w) => [w.char, w.weight]));
            const usedWeights = usedChars
              .filter((c) => weightMap.has(c))
              .map((c) => `${c}(${weightMap.get(c)})`);
            if (usedWeights.length > 0) {
              log(`[${requestId}] 命中字权重:`, usedWeights.join(" "));
            }
          }
        } catch {
          /* weights parse error, skip */
        }

        recordShown(bankId, cleanText);
        log(`[${requestId}] ✅✅✅ 全部检查通过！返回句子: "${cleanText}"`);
        log(`[${requestId}] 使用汉字:`, usedChars);
        return NextResponse.json({
          text: cleanText,
          usedChars,
          extraChars: [],
          isFallback: false,
          model,
        });
      } catch (err) {
        const aborted = err instanceof Error && err.name === "AbortError";
        if (aborted) {
          log(`[${requestId}] ❌ 请求超时（>${timeoutMs}ms），视为失败进入重试`);
        } else {
          log(`[${requestId}] ❌ 请求异常:`, err instanceof Error ? err.message : err);
        }
        continue;
      } finally {
        clearTimeout(abortTimer);
      }
    }

    // 全部重试失败，直示权重最大单字
    log(`[${requestId}] ⚠️ ${MAX_RETRIES} 次重试均失败，直示权重最大单字`);
    const fallbackText = pickFallbackChar(themeWeights, sortedCharsStr);
    const fallbackUsedChars = fallbackText ? [fallbackText] : [];
    recordShown(bankId, fallbackText);
    log(`[${requestId}] ✅ 单字直示: "${fallbackText}", 用字:`, fallbackUsedChars);
    return NextResponse.json({
      text: fallbackText,
      usedChars: fallbackUsedChars,
      extraChars: [],
      isFallback: true,
    });
  } catch (err) {
    log(`[${requestId}] 💥 未捕获异常:`, err instanceof Error ? err.message : err);
    if (err instanceof Error && err.stack) {
      log(`[${requestId}] Stack:`, err.stack.split("\n").slice(0, 5).join("\n"));
    }
    return NextResponse.json({ error: "server_error", message: "服务器内部错误" }, { status: 500 });
  }
}
