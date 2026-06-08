# 快乐识字 🎈

一个帮助 6-9 岁小朋友学习汉字的趣味网页应用。支持 iPad 全屏运行，通过 AI 动态生成词句，配合加权随机算法确保每个汉字都能被均衡使用。

## 快速开始

```bash
# 安装依赖
npm install

# 配置 DeepSeek API Key（可选，无 Key 自动使用内置保底句）
echo 'DEEPSEEK_API_KEY=sk-your-key-here' > .env.local

# 启动开发服务器
npm run dev
```

打开 http://localhost:3000 即可使用。

## 核心功能

### 👶 小朋友界面

| 页面 | 说明 |
|------|------|
| 首页 | 选择「小朋友」或「家长」入口 |
| 字库选择 | 10+ 个主题字库卡片（自然、动物、颜色等），点击进入 |
| 句子生成 | 点击大按钮 → AI 用字库中的汉字造词句，支持语音朗读 |

**页面极简**：只有一个大按钮 + 引导动效，生成后展示句子 + 「再来一句」按钮。无多余干扰。

### 👩 家长界面

| 页面 | 说明 |
|------|------|
| 密码验证 | 4 位数字键盘，首次使用引导设置 |
| 统计看板 | 学习次数、各字使用频率柱状图、本周日历、最近句子 |
| 字库管理 | 启用/禁用字库、自定义字库、权重重置、密码修改 |

### 核心机制

**加权随机排序**：每个汉字初始权重为 1。被 AI 使用后权重重置为 1，未被使用的每次 +1（上限 20）。权重越高，下次被排到前面的概率越大，确保字库中每个字最终都被用到。

## 技术栈

| 层 | 技术 |
|----|------|
| 框架 | Next.js 14 (App Router) |
| 语言 | TypeScript（严格模式） |
| 样式 | Tailwind CSS 3（卡通色盘） |
| 动画 | Framer Motion 11 |
| 图表 | Recharts 2（家长看板） |
| AI | DeepSeek Chat API |
| 音效 | Web Audio API（程序化生成，零加载） |
| 语音 | Web Speech API（TTS） |
| 存储 | localStorage |
| PWA | manifest.json + standalone 模式 |

## 项目结构

```
src/
├── app/
│   ├── page.tsx                 # 首页（儿童/家长入口）
│   ├── child/
│   │   ├── page.tsx             # 字库选择页
│   │   └── sentence/page.tsx    # ⭐ 句子生成三态页
│   ├── parent/
│   │   ├── page.tsx             # 密码验证
│   │   ├── dashboard/page.tsx   # 统计看板
│   │   └── settings/page.tsx    # 字库管理
│   └── api/generate/route.ts    # DeepSeek 代理 + 验证
├── components/
│   ├── child/    # IdleState, LoadingState, ResultState 等
│   ├── parent/
│   └── shared/   # PasswordGate, ParticleBg
├── hooks/        # useSound, useWeightEngine, useStats 等
└── lib/          # 纯函数逻辑（验证器、权重引擎、字库数据等）
```

## AI 句子生成流程

```
① 前端加权排序 → ② 发送给 API → ③ DeepSeek 生成 → ④ 四项检查
                                                      ├─ 敏感词过滤
                                                      ├─ 越界字检查
                                                      ├─ 最少字数检查
                                                      └─ 自评分数检查
                                                      ↓
                                          ⑤ 通过 → 返回 | 失败 → 回传反馈重试
```

## 环境变量

| 变量 | 必填 | 说明 |
|------|------|------|
| `DEEPSEEK_API_KEY` | 否 | DeepSeek API 密钥。不填则使用内置保底句池 |

## iPad 全屏使用

1. 用 Safari 打开页面
2. 点击「分享」按钮 → 「添加到主屏幕」
3. 主屏幕图标以 standalone 模式启动（无浏览器导航栏）

## 本地开发

```bash
npm run dev      # 开发服务器
npm run build    # 生产构建
npm run start    # 启动生产服务
npm run lint     # 代码检查
```
