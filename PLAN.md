# 儿童汉字学习网页 · 完整实现计划

> 项目名：`hanzi-learn`  
> 技术栈：Next.js 14 (App Router) + TypeScript + Tailwind CSS + Framer Motion  
> 目标平台：iPad (mini/Air/Pro) + 现代浏览器  
> 部署：Vercel (Hobby)

---

## 目录

1. [项目概述](#1-项目概述)
2. [文件树](#2-完整文件树)
3. [分步实现计划](#3-分步实现计划)
4. [路由设计](#4-路由设计)
5. [数据流](#5-数据流)
6. [API 设计](#6-api-设计)
7. [UI 状态机](#7-ui-状态机)
8. [风险与缓解](#8-风险与缓解)

---

## 1. 项目概述

### 1.1 核心功能

| 功能 | 说明 |
|------|------|
| 字库选择 | 10+ 内置主题字库 + 家长自定义，每个 8~15 汉字 |
| 加权排序 | 使用加权不放回抽样，未用字权重递增（上限 20），确保全部用上 |
| AI 造句 | 调用 DeepSeek，严格限定只能使用字库内的汉字 |
| 严格越界检查 | 前后端双重校验，发现越界字自动重试（最多 3 次） |
| 保底降级 | 3 次失败后返回预置句子 |
| 敏感词过滤 | 200+ 敏感词库，确保输出安全 |
| 家长后台 | 密码保护，统计看板 + 字库管理 + 配置 |
| 音效 + 动画 | Web Audio API 程序化音效 + Framer Motion 丰富动画 |

### 1.2 用户流程

```
首页 (/)
 ├── 👶 小朋友
 │     └── 字库选择 (/child)
 │           └── 句子生成 (/child/sentence?bank=xxx)
 │                 ├── [状态A] 仅「造句子」按钮（大按钮呼吸动效引导点击）
 │                 ├── [状态B] 火箭加载动画（文案轮换，12s超时回退）
 │                 └── [状态C] 句子展示 + 「再来一句」按钮
 │
 └── 👩 家长（密码验证）
       ├── 统计看板 (/parent/dashboard)
       └── 设置管理 (/parent/settings)
```

---

## 2. 完整文件树

```
hanzi-learn/
├── package.json
├── tsconfig.json
├── next.config.js
├── tailwind.config.js
├── postcss.config.js
├── .env.local                        # DEEPSEEK_API_KEY=
├── .gitignore
├── README.md
│
├── public/
│   ├── manifest.json                 # PWA manifest (display: standalone)
│   ├── icon-192.png
│   ├── icon-512.png
│   └── apple-touch-icon.png
│
└── src/
    ├── app/
    │   ├── layout.tsx                # 全局布局：metadata、PWA meta、字体加载
    │   ├── globals.css               # Tailwind 指令 + @keyframes 动画
    │   ├── page.tsx                  # / — 首页入口（👶/👩 选择）
    │   │
    │   ├── child/
    │   │   ├── layout.tsx            # 儿童区 SoundProvider
    │   │   ├── page.tsx              # /child — 字库选择
    │   │   └── sentence/
    │   │       └── page.tsx          # /child/sentence — 句子三态生成页
    │   │
    │   ├── parent/
    │   │   ├── page.tsx              # /parent — 密码验证
    │   │   ├── dashboard/
    │   │   │   └── page.tsx          # /parent/dashboard — 统计看板
    │   │   └── settings/
    │   │       └── page.tsx          # /parent/settings — 字库管理 + 配置
    │   │
    │   └── api/
    │       └── generate/
    │           └── route.ts          # POST /api/generate
    │
    ├── components/
    │   ├── child/
    │   │   ├── WordBankPicker.tsx     # 字库选择卡片网格
    │   │   ├── IdleState.tsx          # 状态A：大按钮 + 引导动效
    │   │   ├── LoadingState.tsx       # 状态B：火箭 + 文案
    │   │   ├── ResultState.tsx        # 状态C：句子 + 重生成
    │   │   └── BackButton.tsx         # 统一左上角返回
    │   │
    │   ├── parent/
    │   │   ├── StatCard.tsx           # 统计数字卡片
    │   │   ├── CharUsageChart.tsx     # 汉字使用柱状图 (recharts)
    │   │   ├── StudyCalendar.tsx      # 学习日历热力图
    │   │   ├── RecentSentences.tsx    # 最近句子列表
    │   │   ├── BankToggleCard.tsx     # 字库开启/关闭卡片
    │   │   └── CustomBankEditor.tsx   # 自定义字库编辑器
    │   │
    │   └── shared/
    │       ├── PasswordGate.tsx       # 4位数字密码验证
    │       └── ParticleBg.tsx         # 星星粒子背景
    │
    ├── lib/
    │   ├── types.ts                  # 所有核心类型定义
    │   ├── wordBanks.ts              # 10 个内置字库
    │   ├── weightEngine.ts           # 加权排序 + 权重更新
    │   ├── validator.ts              # 越界字 + 敏感词检查
    │   ├── soundEngine.ts            # Web Audio API 音效
    │   ├── fallbackSentences.ts      # 保底句池
    │   └── storage.ts               # localStorage 封装
    │
    ├── hooks/
    │   ├── useWeightEngine.ts        # 权重 Hook
    │   ├── useSound.ts               # 音效 Hook
    │   ├── useStats.ts               # 统计 Hook
    │   └── useIdleTimeout.ts         # 无操作超时 Hook
    │
    └── styles/
        └── animations.css            # 额外 @keyframes
```

---

## 3. 分步实现计划

---

### Step 1：项目脚手架 + Tailwind 配置

**目标：** `npm run dev` 跑起来，能看到卡通字体页面

#### 文件清单

| 文件 | 内容 |
|------|------|
| `package.json` | Next.js 14 + React 18 + framer-motion + recharts |
| `tsconfig.json` | strict 模式，路径别名 `@/*` |
| `next.config.js` | 空配置 |
| `tailwind.config.js` | 扩展色盘 + 圆角 + 动画工具类 |
| `postcss.config.js` | tailwind + autoprefixer |
| `src/app/layout.tsx` | 全局 HTML meta，Google Fonts (ZCOOL KuaiLe) |
| `src/app/globals.css` | Tailwind 指令 + @keyframes 动画 |

#### tailwind.config.js 扩展色盘

```js
colors: {
  candy: {
    pink:   '#FF6B9D',
    orange: '#FF8A5C',
    yellow: '#FFD93D',
    green:  '#6BCB77',
    teal:   '#4D96FF',
    purple: '#9B59B6',
    sky:    '#74b9ff',
    mint:   '#00cec9',
  }
}
borderRadius: { '4xl': '2rem', '5xl': '2.5rem' }
fontFamily: { cartoon: ['"ZCOOL KuaiLe"', 'sans-serif'] }
```

#### globals.css @keyframes

| 动画名 | 用途 |
|--------|------|
| `breathe` | 按钮呼吸放大缩小 1↔1.06 |
| `float` | 元素上下浮动 |
| `shake` | 错误摇晃 |
| `twinkle` | 星星闪烁 |
| `slide-up` | 句子入场 |
| `rocket-bounce` | 加载火箭弹跳 |

---

### Step 2：核心类型 + 字库数据

**目标：** TypeScript 类型完备，10 个字库数据可导入

#### 核心类型（`src/lib/types.ts`）

```typescript
// 单字在权重引擎中的状态
interface CharEntry {
  char: string;
  weight: number;           // ≥ 1，上限 20
  totalUsed: number;
  lastUsedRound: number;
}

// 字库定义（只读，存储用）
interface WordBank {
  id: string;               // 唯一标识，如 'ziran'
  name: string;             // 中文名，如 '自然'
  emoji: string;            // 图标 emoji
  chars: string[];          // 汉字数组
}

// 权重持久化结构
interface WeightData {
  [bankId: string]: {
    round: number;
    chars: CharEntry[];
  };
}

// API 请求/响应
interface GenerateRequest {
  bankId: string;
  sortedChars: string;
}
interface GenerateResponse {
  text: string;
  usedChars: string[];
  extraChars: string[];
  isFallback: boolean;
}

// 学习统计
interface StudyStats {
  totalCalls: number;
  todayCalls: number;
  todayDate: string;
  weeklyCalls: number;
  history: Record<string, number>;
  sentenceHistory: { text: string; date: string; bankId: string }[];
  charUsage: Record<string, number>;
}

// 家长配置
interface ParentConfig {
  password: string;
  enabledBanks: string[];
  customBanks: WordBank[];
}
```

#### 10 个内置字库（`src/lib/wordBanks.ts`）

| id | name | emoji | chars |
|----|------|-------|-------|
| `ziran` | 自然 | 🌸 | 日月星云山水花草风雨石林 (12) |
| `dongwu` | 动物 | 🐶 | 猫狗鸟鱼虫马牛羊兔鸡鸭鹅 (12) |
| `yanse` | 颜色 | 🎨 | 红黄蓝绿黑白紫粉灰金银 (11) |
| `jiating` | 家庭 | 🏠 | 爸妈爷奶哥姐弟妹叔姨 (10) |
| `shiwei` | 食物 | 🍎 | 米面果菜肉蛋奶糖茶汤 (10) |
| `shenti` | 身体 | 🖐️ | 头手眼耳口鼻足牙脸发 (10) |
| `dongzuo` | 动作 | 🏃 | 走跑跳看听说读写吃画唱 (11) |
| `shuzi` | 数字 | 🔢 | 一二三十百千万亿半多 (10) |
| `xuexiao` | 校园 | 📚 | 书包课本笔纸桌椅尺画 (10) |
| `jijie` | 季节 | 🌤️ | 春夏秋冬暖凉热雪霜冰 (10) |

---

### Step 3：权重引擎 + localStorage 持久化

**目标：** 加权排序算法 + 权重更新 + 存储

#### 3a. 加权不放回抽样排序（`weightEngine.ts`）

```
输入: CharEntry[]（含 weight 字段）
输出: string（排序后的汉字串）

算法:
  candidates = [...chars]
  result = []
  while candidates 非空:
    totalWeight = sum(c.weight)
    rand = random(0, totalWeight)
    for i, c in candidates:
      rand -= c.weight
      if rand <= 0:
        result.push(c.char)
        candidates.splice(i, 1)
        break
  return result.join('')
```

特点：权重越高被排到前面的概率越大，但每次排序结果不同。

#### 3b. 权重更新规则

```
每次 DeepSeek 生成后:
  usedSet = 文本中出现的字库汉字
  for each char in 字库:
    if char in usedSet:
      weight = 1           // 使用 → 重置
      totalUsed += 1
    else:
      weight = min(weight + 1, 20)  // 未使用 → +1，上限 20
  round += 1
```

**效果：** 一个字连续 19 轮不用 → weight=20，下一轮几乎必定被排到第一个。

#### 3c. storage.ts 封装

```typescript
// 所有读写包裹 try/catch，SSR 安全 + 无痕模式降级
loadWeightData(bankId): WeightData | null
saveWeightData(bankId, data): void
loadStats(): StudyStats
saveStats(stats): void
loadConfig(): ParentConfig
saveConfig(config): void
```

#### 3d. useWeightEngine Hook

```
输入: bankId
暴露:
  - sortedChars: string   // 加权排序后的汉字串
  - update(usedSet)       // 更新权重
  - reset()               // 重置权重
  - getWeights()          // 各字当前权重（供家长看板用）
```

---

### Step 4：验证器（越界字 + 敏感词）

**目标：** 前后端共用一套验证逻辑

#### 4a. 越界字检查

```typescript
function extractChineseChars(text: string): string[] {
  return [...text].filter(c => /[\u4e00-\u9fff]/.test(c));
}

function findExtraChars(text: string, allowedSet: Set<string>): string[] {
  const chars = extractChineseChars(text);
  return [...new Set(chars.filter(c => !allowedSet.has(c)))];
}

function findUsedChars(text: string, allowedSet: Set<string>): string[] {
  const chars = extractChineseChars(text);
  return [...new Set(chars.filter(c => allowedSet.has(c)))];
}
```

注意：标点符号、英文字母、数字不参与检查，自动忽略。

#### 4b. 敏感词过滤

- 三级词库（共约 200+ 词）：
  - **暴力/负面**：杀、死、打、骂、毒、恶、坏、恨、痛、苦、哭、伤、血……
  - **不雅/歧视**：笨、蠢、傻、丑、脏、臭、废、懒、猪、狗……
  - **恐怖/性暗示**：鬼、魔、妖、怪、地狱……
- 函数：`hasSensitiveContent(text): boolean`
- 纯函数，无状态，可前后端共用

---

### Step 5：音效引擎（Web Audio API + TTS）

**目标：** 所有交互有音效反馈，句子可朗读

#### SoundEngine 类方法

| 方法 | 音色 | 时长 | 触发场景 |
|------|------|------|----------|
| `ding()` | 正弦波 A5→A6 滑音 | 0.3s | 选择字库、点击字卡 |
| `rocket()` | 锯齿波 200→600Hz 上升 | 0.5s | 点击「造句子」 |
| `success()` | 三音琶音 C5→E5→G5 | 0.4s | 句子生成成功 |
| `error()` | 低音 200Hz 短促 | 0.3s | 出错/超时 |
| `tick()` | 短促噪声包络 | 0.05s | 打字机逐字效果 |
| `speak(text)` | Web Speech API TTS | 按文本 | 点击句子朗读 |

#### AudioContext 初始化策略

```typescript
class SoundEngine {
  private ctx: AudioContext | null = null;

  // 必须在用户手势中调用（iOS 限制）
  ensureContext() {
    if (!this.ctx) {
      this.ctx = new AudioContext();
    }
    if (this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
  }
}
```

#### useSound Hook

```typescript
function useSound() {
  const engine = useRef<SoundEngine>();
  const initialized = useRef(false);

  // 首次用户交互时初始化（由父组件传入手势事件）
  const init = useCallback(() => {
    if (!initialized.current) {
      engine.current = new SoundEngine();
      initialized.current = true;
    }
  }, []);

  const play = useCallback((action: string) => {
    if (engine.current) engine.current[action]();
  }, []);

  return { init, play, speak: (t: string) => engine.current?.speak(t) };
}
```

---

### Step 6：API 路由 + 保底句池

**目标：** `/api/generate` 返回合法句子

#### 6a. 完整请求流程

```
POST /api/generate
├─ 解析 { bankId, sortedChars }
├─ 构建 allowedSet
├─ 构建 system prompt（含严格字库约束 + 安全约束）
├─ 循环最多 3 次:
│   ├─ 调用 DeepSeek API
│   ├─ 检查 敏感词 → 重试
│   ├─ 检查 越界字 → 重试
│   ├─ 检查 最少 2 字 → 重试
│   └─ 通过 → 返回
├─ 3 次失败 → 返回保底句
└─ 返回 GenerateResponse
```

#### 6b. System Prompt

```
你是一位有10年经验的儿童语文老师，专为6-9岁小朋友编写句子。

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
{sortedChars}
```

#### 6c. 保底句池（`fallbackSentences.ts`）

每个字库至少 5 条预置句子：

| 字库 | 保底句 |
|------|--------|
| 自然 | 日月星辰真美丽、山水花草有风雨、蓝天白云好风光…… |
| 动物 | 小猫小狗真可爱、小鸟飞在蓝天上、小兔子吃胡萝卜…… |
| 颜色 | 红红的太阳真好看、蓝蓝的天空白云飘…… |
| 家庭 | 爸爸妈妈我爱你们、爷爷奶奶辛苦了…… |
| 食物 | 大米饭真香呀、苹果甜甜的真好吃…… |
| … | （每个字库 5 条） |

---

### Step 7：首页入口（`/`）

**目标：** 两个大卡片选择入口

#### 页面布局

```
┌──────────────────────────────────┐
│                                  │
│         🎈 快乐识字 🎈           │
│                                  │
│     ┌────────┐ ┌────────┐       │
│     │  👶    │ │  👩    │       │
│     │  小朋友 │ │  家长  │       │
│     │        │ │        │       │
│     └────────┘ └────────┘       │
│                                  │
│  每个卡片 160×200pt, 圆角 3xl    │
│  hover/tap 弹跳效果              │
└──────────────────────────────────┘
```

- 全屏居中，浅米色背景 `#FFF5E6`
- 标题用卡通字体，48px+，带文字阴影
- 两个卡片并排（竖屏上下叠），各占 50% 宽度
- 点击卡片：`ding()` 音效 + 导航

---

### Step 8：儿童·字库选择页（`/child`）

**目标：** 展示可选字库，点击跳转到句子页

#### 页面布局

```
┌──────────────────────────────────┐
│   ✨ 选一个字库吧 ✨              │
│                                  │
│  ┌────┐ ┌────┐ ┌────┐           │
│  │ 🌸 │ │ 🐶 │ │ 🎨 │           │
│  │自然│ │动物│ │颜色│           │
│  └────┘ └────┘ └────┘           │
│  ┌────┐ ┌────┐ ┌────┐           │
│  │ 🏠 │ │ 🍎 │ │ 🖐️ │           │
│  │家庭│ │食物│ │身体│           │
│  └────┘ └────┘ └────┘           │
│                                  │
│  2列(竖屏) / 3列(横屏) 网格       │
│  卡片 140×140pt, 不同颜色         │
│  入场 stagger 0.05s 飞入弹跳     │
└──────────────────────────────────┘
```

#### 过滤逻辑

- 读取 `ParentConfig.enabledBanks`
- 只展示被启用的内置字库 + 所有自定义字库
- 若无可用字库 → 显示提示"请让家长先开启字库哦"

#### 导航

点击卡片 → `router.push(\`/child/sentence?bank=${bankId}\`)` + `ding()` 音效

---

### Step 9：儿童·句子生成页（`/child/sentence?bank=xxx`）⭐

**目标：** 三态切换，极简体验

#### 9a. 三态容器

```typescript
type PageState = 'idle' | 'loading' | 'result';

// 状态流转:
// idle ──(点击)──→ loading ──(成功)──→ result
//                              ──(失败)──→ idle（+提示）
// result ──(再来一句)──→ idle
// result ──(←返回)──→ /child
```

使用 `AnimatePresence mode="wait"` 确保每个状态切换有过渡动画。

#### 9b. 状态 A：IdleState（仅一个大按钮）

```
┌──────────────────────────────────┐
│                                  │
│                                  │
│                                  │
│          ┌────────────┐          │
│          │            │          │
│          │ ✨ 造句子   │          │
│          │            │          │
│          │ 176×176pt  │          │
│          │ 渐变粉色→橙 │          │
│          └────────────┘          │
│                                  │
│      ↕ 呼吸动画 scale 1↔1.06     │
│      ↔ 光晕脉动 2s 周期          │
│                                  │
│      8s 无操作 → 引导箭头 ↓      │
│                                  │
│  左上角 ← 返回字库选择            │
└──────────────────────────────────┘
```

**动效实现（Framer Motion）：**
```tsx
<motion.button
  animate={{
    scale: [1, 1.06, 1],
    boxShadow: [
      '0 0 30px rgba(255,107,157,0.3)',
      '0 0 60px rgba(255,107,157,0.5)',
      '0 0 30px rgba(255,107,157,0.3)',
    ],
  }}
  transition={{
    scale: { duration: 2, repeat: Infinity, ease: 'easeInOut' },
    boxShadow: { duration: 2, repeat: Infinity, ease: 'easeInOut' },
  }}
  whileTap={{ scale: 0.95 }}
/>
```

#### 9c. 状态 B：LoadingState（火箭动画）

```
┌──────────────────────────────────┐
│                                  │
│                                  │
│              🚀                  │
│          火箭 emoji 72px         │
│        上下浮动 5px + 自旋        │
│                                  │
│        "小脑袋正在想…"            │
│        → 每 3s 轮换文案          │
│                                  │
│       背景：星星粒子闪烁          │
│                                  │
│   超时 12s → 回退 idle + 提示    │
│   "哎呀，AI 走神了，再试一次！"   │
│                                  │
└──────────────────────────────────┘
```

- 火箭动画：`float` (translateY ±5px) + `rotate` (360°/8s)
- 文案轮换使用 `useEffect` + `setInterval`
- 12s 超时使用 `setTimeout`，清理在 `useEffect` 返回中

#### 9d. 状态 C：ResultState（句子展示）

```
┌──────────────────────────────────┐
│                                  │
│           ✨ 句子 ✨              │
│                                  │
│     ┌──────────────────┐         │
│     │                  │         │
│     │  月亮在云朵里     │         │
│     │  捉迷藏           │         │
│     │                  │         │
│     │  大字 36~64px    │         │
│     │  每行 ≤ 8字      │         │
│     └──────────────────┘         │
│      逐字弹出 stagger 0.08s      │
│      整体下滑入 + 淡入           │
│      点击句子 → TTS 朗读          │
│                                  │
│     ✅ 用了：月 云 藏             │
│     （淡色小标签，延迟0.3s出现）   │
│                                  │
│        ┌──────────────┐          │
│        │ 🔁 再来一句   │          │
│        └──────────────┘          │
│      从底部滑入（延迟0.5s）       │
│                                  │
│            🔄 换字库              │
│        右下角小字 → 返回 /child   │
│                                  │
└──────────────────────────────────┘
```

**句子入场动画时序：**

```
0ms      整体从 y:40, opacity:0 开始滑入
200ms    到达 y:0, opacity:1 (0.4s ease-out)
200ms+   逐字弹出开始 (staggerChildren: 0.08s/字)
         每个字：scale: 0→1, spring stiffness: 200
句子结束后 +300ms    ✅ 用了标签淡入
句子结束后 +500ms    🔁 按钮从底部滑入
```

---

### Step 10：家长·密码页（`/parent`）

**目标：** 简单密码保护，防止儿童误入

#### UI 设计

```
┌──────────────────────────────────┐
│                                  │
│        🔒 家长验证               │
│                                  │
│        ┌────────────────┐        │
│        │   ● ● ● ●     │        │
│        └────────────────┘        │
│        （4位数字输入框）          │
│                                  │
│   ┌───┐ ┌───┐ ┌───┐            │
│   │ 1 │ │ 2 │ │ 3 │            │
│   └───┘ └───┘ └───┘            │
│   ┌───┐ ┌───┐ ┌───┐            │
│   │ 4 │ │ 5 │ │ 6 │            │
│   └───┘ └───┘ └───┘            │
│   ┌───┐ ┌───┐ ┌───┐            │
│   │ 7 │ │ 8 │ │ 9 │            │
│   └───┘ └───┘ └───┘            │
│   ┌───┐ ┌───┐ ┌───┐            │
│   │ ← │ │ 0 │ │ ✓ │            │
│   └───┘ └───┘ └───┘            │
│    删除  数字  确认              │
│                                  │
│  错误 → 输入框摇晃 + error()     │
│  首次使用 → 提示设置密码          │
└──────────────────────────────────┘
```

- 默认密码 `1234`
- 密码存储在 `localStorage`（非敏感安全，仅防误入）
- 首次访问先提示设置密码
- 正确 → 重定向到 `/parent/dashboard`

---

### Step 11：家长·统计看板（`/parent/dashboard`）

**目标：** 可视化学习数据

#### 页面布局

```
┌──────────────────────────────────┐
│  📊 学习报告        [⚙️ 字库管理] │
│                                  │
│  ┌──────┐ ┌──────┐              │
│  │总使用 │ │ 今日  │              │
│  │ 356  │ │  12   │              │
│  │ 次    │ │ 次    │              │
│  └──────┘ └──────┘              │
│  ┌──────┐ ┌──────┐              │
│  │本周  │ │累计句子│              │
│  │ 45   │ │  89   │              │
│  │ 次    │ │ 句    │              │
│  └──────┘ └──────┘              │
│                                  │
│  ┌──────────────────────────┐    │
│  │ 各字使用频率               │    │
│  │ ██ 日  ██████ 月  ██ 星  │    │
│  │ ██ 云  ██████ 山  ██ 水  │    │
│  │ 彩色柱状图 (recharts)     │    │
│  │ 绿≥3次 黄1-2次 红0次    │    │
│  └──────────────────────────┘    │
│                                  │
│  ┌──────────────────────────┐    │
│  │ 学习日历                   │    │
│  │ 一 二 三 四 五 六 日       │    │
│  │ ✅✅✅☑️✅✅❌              │    │
│  └──────────────────────────┘    │
│                                  │
│  ┌──────────────────────────┐    │
│  │ 最近句子                   │    │
│  │ 12/05 月亮在云朵里捉迷藏  │    │
│  │ 12/04 小星星在风里眨眼    │    │
│  └──────────────────────────┘    │
└──────────────────────────────────┘
```

#### 技术实现

- 使用 recharts `BarChart` 做汉字频率柱状图
- 学习日历：自定义热力图或 recharts 组件
- 最近句子：从 `StudyStats.sentenceHistory` 取最近 10 条
- 入场动画：每个组件从下方 fly in，stagger 0.1s

---

### Step 12：家长·设置页（`/parent/settings`）

**目标：** 字库管理 + 配置

#### 页面功能

| 功能 | 实现 | 交互 |
|------|------|------|
| 启用/禁用字库 | 点击卡片切换，更新 `enabledBanks` | 卡片切换 ✅ / ❌ |
| 新增自定义字库 | 弹出编辑器：名称 + emoji + 汉字列表 | 表单保存 |
| 编辑自定义字库 | 弹出已填充的编辑器 | 保存更新 |
| 删除自定义字库 | 确认弹窗 | 从 customBanks 移除 |
| 权重重置 | 确认弹窗 → 清除所有 weightData | 弹出+重置 |
| 修改密码 | 弹出新旧密码输入 | 验证旧密码后更新 |
| 清除学习记录 | 确认弹窗（摇晃警告） | 清除所有 stats |

---

### Step 13：PWA 配置

**目标：** iPad 上添加到主屏幕后全屏运行

#### manifest.json

```json
{
  "name": "快乐识字",
  "short_name": "识字",
  "start_url": "/",
  "display": "standalone",
  "background_color": "#FFF5E6",
  "theme_color": "#FF6B9D",
  "icons": [
    { "src": "/icon-192.png", "sizes": "192x192", "type": "image/png" },
    { "src": "/icon-512.png", "sizes": "512x512", "type": "image/png" }
  ]
}
```

#### layout.tsx 头部

```html
<meta name="apple-mobile-web-app-capable" content="yes" />
<meta name="apple-mobile-web-app-status-bar-style" content="default" />
<meta name="apple-mobile-web-app-title" content="识字" />
<link rel="apple-touch-icon" href="/apple-touch-icon.png" />
<link rel="manifest" href="/manifest.json" />
```

---
## 4. 路由设计

| 路径 | 页面 | 说明 |
|------|------|------|
| `/` | 首页入口 | 选择儿童/家长 |
| `/child` | 字库选择 | 2~3列卡片网格 |
| `/child/sentence?bank=xxx` | 句子生成 | 三态切换核心页 |
| `/parent` | 家长密码验证 | 4位数字键盘 |
| `/parent/dashboard` | 统计看板 | 图表+数据 |
| `/parent/settings` | 设置管理 | 字库+配置 |

---

## 5. 数据流

```
用户打开 App
  ├─ 首页入口 → 选择 儿童/家长
  │
  ├─ [儿童] 字库选择页
  │     ├─ 从 localStorage 读取 ParentConfig.enabledBanks
  │     ├─ 从 wordBanks.ts 读取匹配的字库列表
  │     ├─ 展示可用的字库卡片
  │     └─ 点击 → 导航到句子页 (bankId 通过 URL 参数传递)
  │
  ├─ [儿童] 句子页
  │     ├─ 进入 → 从 localStorage 读取 WeightData[bankId]
  │     │     ├─ 有数据 → 恢复权重
  │     │     └─ 无数据 → 初始化（全部 weight=1）
  │     ├─ 加权排序 → sortedChars
  │     ├─ 点击按钮 → POST /api/generate { bankId, sortedChars }
  │     │     ├─ DeepSeek 返回 → 验证 → 更新权重 → 更新 stats
  │     │     └─ 失败 3次 → 保底句 → 更新权重 → 更新 stats
  │     ├─ 展示句子
  │     └─ 「再来一句」→ 重新加权排序（权重已更新）
  │
  └─ [家长] 统计/设置
        ├─ 从 localStorage 读取 StudyStats 展示看板
        └─ 修改配置 → 写回 localStorage
```

---

## 6. API 设计

### POST `/api/generate`

#### Request
```json
{
  "bankId": "ziran",
  "sortedChars": "月云山花风日星草木水石雨林"
}
```

#### Response（成功）
```json
{
  "text": "月光照亮了山间的花草，星星在云朵里眨眼睛。",
  "usedChars": ["月", "光", "山", "花", "草", "星", "云"],
  "extraChars": [],
  "isFallback": false
}
```

#### Response（失败降级）
```json
{
  "text": "日月星辰真美丽",
  "usedChars": ["日", "月", "星", "辰"],
  "extraChars": [],
  "isFallback": true
}
```

#### 错误码

| HTTP 状态 | error 字段 | 说明 |
|-----------|-----------|------|
| 400 | `invalid_request` | 缺少必要参数 |
| 422 | `sensitive_content` | 敏感词（前端走重试，用户无感知） |
| 422 | `character_out_of_bounds` | 越界字（前端重试，用户无感知） |
| 500 | `api_error` | DeepSeek 不可用，返回保底句 |
| 200 | `isFallback: true` | 3次重试后降级保底 |

---

## 7. UI 状态机

### 句子页三态图

```
                    ┌─────────┐
         ┌──────────│  idle   │←──────────────┐
         │          │ (A)     │                │
         │          └────┬────┘                │
         │               │ 点击「造句子」        │
         │               ▼                     │
         │          ┌─────────┐                │
         │          │ loading │                │
         │          │ (B)     │                │
         │          └────┬────┘                │
         │               │                     │
         │          ┌────┴────┐                │
         │          │         │                │
         │      成功│         │失败/超时        │
         │          │         │                │
         │          ▼         ▼                │
         │    ┌─────────┐  ┌─────────┐        │
         │    │ result  │  │  idle   │────────┘
         │    │ (C)     │  │ (+提示) │
         │    └────┬────┘  └─────────┘
         │         │
         └─────────┘ 点击「再来一句」
```

### 每个状态的元素清单

| 状态 | 可见元素 | 交互 |
|------|---------|------|
| **idle** | ① 大按钮（圆形 + emoji + 文字） | 点击 → loading |
| | ② 左上角返回箭头 | 点击 → /child |
| | ③ 引导箭头（8s 后） | 仅动画，自动消失 |
| **loading** | ① 火箭动画 + 文案轮换 | 无（防重复点击） |
| | ② 粒子背景 | 纯动画 |
| | ③ 超时提示（12s 后自动） | 无（自动回退 idle） |
| **result** | ① 句子展示（大字 + 背景块） | 点击句子 → TTS |
| | ② ✅ 已用字标签 | 无 |
| | ③ 🔁 再来一句按钮 | 点击 → idle |
| | ④ 🔄 换字库（右下小字） | 点击 → /child |

---

## 8. 风险与缓解

| # | 风险 | 影响 | 概率 | 缓解 |
|---|------|------|------|------|
| 1 | DeepSeek 偶尔输出越界字 | 句子被拒，用户体验中断 | 中 | 3次自动重试 + 保底句降级，用户无感知 |
| 2 | iOS Safari 禁止 AudioContext 自动播放 | 首次交互无音效 | 高 | `SoundEngine` 在首次点击时延迟初始化，之后正常 |
| 3 | 无痕模式下 localStorage 不可写 | 权重/配置无法保存 | 低 | 所有操作包裹 try/catch，降级内存模式 |
| 4 | DeepSeek API 超时/不可用 | 长期 loading | 低 | 12s 前端超时 + 保底句立即返回 |
| 5 | 儿童误入家长页 | 配置被误改 | 中 | 4位密码保护，家长入口小字放角落 |
| 6 | 自定义字库含不恰当汉字 | 绕过了内置正向字库筛选 | 低 | 家长创建时不做限制（信任家长），但生成仍受敏感词过滤 |
| 7 | iPad 横竖屏切换布局崩 | 显示异常 | 低 | Tailwind 响应式断点全覆盖测试 |

---

## 附录：关键依赖

```json
{
  "dependencies": {
    "next": "^14.2.0",
    "react": "^18.3.0",
    "react-dom": "^18.3.0",
    "framer-motion": "^11.0.0",
    "recharts": "^2.12.0"
  },
  "devDependencies": {
    "typescript": "^5.4.0",
    "@types/node": "^20.12.0",
    "@types/react": "^18.3.0",
    "@types/react-dom": "^18.3.0",
    "tailwindcss": "^3.4.0",
    "postcss": "^8.4.0",
    "autoprefixer": "^10.4.0"
  }
}
```

无其他外部依赖。音效用 Web Audio API（浏览器内置），TTS 用 Web Speech API（浏览器内置），渲染和布局用 Tailwind 无需组件库。
