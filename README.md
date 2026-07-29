# 快乐识字 🎈

一个帮助 6-9 岁小朋友学习汉字的趣味网页应用。支持 iPad 全屏运行，通过 AI 动态生成词句，配合加权随机算法确保每个汉字都能被均衡使用。

## 快速开始

```bash
# 进入项目目录
cd hanzi-learn

# 安装依赖
npm install

# 配置 DeepSeek API Key（可选，无 Key 自动使用内置保底句）
echo 'DEEPSEEK_API_KEY=sk-your-key-here' > env

# 启动开发服务器
npm run dev
```

打开 http://localhost:3000 即可使用。

## 核心功能

### 👶 小朋友界面

| 页面 | 说明 |
|------|------|
| 首页 | 选择「小朋友」或「家长」入口 |
| 字库选择 | 字库卡片（一级/二级/综合 等），点击进入 |
| 句子生成 | 点击大按钮 → AI 用字库中的汉字造词句，支持语音朗读 |
| 字卡打印 | `/print?bank=xxx` 生成可打印字卡，支持多种配置 |

**页面极简**：只有一个大按钮 + 引导动效，生成后展示句子 + 「再来一句」按钮。无多余干扰。

### 👩 家长界面

| 页面 | 说明 |
|------|------|
| 密码验证 | 4 位数字键盘，首次使用引导设置 |
| 统计看板 | 学习次数、各字使用频率柱状图、本周日历、最近句子 |
| 字库管理 | 启用/禁用字库、自定义字库、权重重置、密码修改 |

### 🖨️ 字卡打印

在字库选择页点击「打印」或直接访问 `/print?bank=xxx`，生成可打印的汉字卡片。

| 配置项 | 选项 |
|--------|------|
| 字体 | 楷体、宋体、黑体、圆体、微软雅黑、苹方、仿宋 |
| 字号 | 36pt、48pt、60pt、72pt |
| 裁切线 | 虚线、圆点、实线标记、隐藏 |
| 拼音 | 显示/隐藏 |
| 染色 | 开/关 — 每个汉字分配不同颜色组合（24 色循环） |
| 份数系数 | 0.5x ~ 3.0x — 高频字印更多份 |

### 核心机制

**两级字库**：内置「一级」（60 个基础字）和「二级」（预留扩展）字库，支持合并为「综合」模式。

**加权随机排序**：每个汉字初始权重为 1。被 AI 使用后权重重置为 1，未被使用的每次 +1（上限 20）。权重越高，下次被排到前面的概率越大，确保字库中每个字最终都被用到。

**频率分级**：打印字卡时，按汉字日常使用频率分为 3 级（Tier 1 印 3 份 / Tier 2 印 2 份 / Tier 3 印 1 份），配合系数调节份数。

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
| 拼音 | 内置拼音映射表 |
| 存储 | localStorage |
| PWA | manifest.json + standalone 模式 |

## 项目结构

项目根 `learn-hanzi/` 为 Git 仓库根目录，Next.js 应用位于 `hanzi-learn/` 子目录。

```
hanzi-learn/
├── src/
│   ├── app/
│   │   ├── page.tsx                    # 首页（儿童/家长入口）
│   │   ├── layout.tsx                  # 根布局（PWA meta + Google Fonts）
│   │   ├── child/
│   │   │   ├── page.tsx                # 字库选择页
│   │   │   └── sentence/page.tsx       # ⭐ 句子生成三态页
│   │   ├── parent/
│   │   │   ├── page.tsx                # 密码验证
│   │   │   ├── dashboard/page.tsx      # 统计看板
│   │   │   └── settings/page.tsx       # 字库管理
│   │   ├── print/page.tsx              # 🖨️ 字卡打印页
│   │   └── api/generate/route.ts       # DeepSeek 代理 + 验证
│   ├── components/
│   │   ├── child/
│   │   │   ├── IdleState.tsx           # 待机态（大按钮）
│   │   │   ├── LoadingState.tsx        # 加载态（火箭动效）
│   │   │   ├── ResultState.tsx         # 结果态（句子展示）
│   │   │   ├── WordBankPicker.tsx      # 字库选择网格
│   │   │   ├── PrintCards.tsx          # 字卡打印组件
│   │   │   └── BackButton.tsx          # 返回按钮
│   │   ├── parent/
│   │   └── shared/
│   │       ├── PasswordGate.tsx        # 密码验证组件
│   │       └── ParticleBg.tsx          # 粒子背景
│   ├── hooks/
│   │   ├── useWeightEngine.ts          # 权重引擎 Hook
│   │   ├── useSound.ts                 # 音效 Hook
│   │   ├── useStats.ts                 # 统计 Hook
│   │   ├── usePrintConfig.ts           # 打印配置 Hook
│   │   └── useIdleTimeout.ts           # 无操作超时 Hook
│   └── lib/
│       ├── types.ts                    # 核心类型定义
│       ├── wordBanks.ts                # 字库数据（一级/二级）
│       ├── weightEngine.ts             # 加权不放回抽样算法
│       ├── validator.ts               # 句子验证（敏感词/越界/评分）
│       ├── fallbackSentences.ts        # 内置保底句池（诗词风格）
│       ├── pinyin.ts                   # 拼音映射表
│       ├── colors.ts                   # 染色系统（24 色配色）
│       ├── frequency.ts                # 字频分级（Tier 1~3）
│       ├── soundEngine.ts              # Web Audio API 音效引擎
│       └── storage.ts                  # localStorage 封装
├── public/
│   └── manifest.json                   # PWA manifest
├── scripts/
│   └── build.sh                        # Docker 构建脚本
├── Dockerfile                          # 多阶段 Docker 构建
├── docker-compose.yml                  # Docker Compose 配置
├── next.config.js                      # Next.js 配置（含 env 加载）
├── lan.js                              # 局域网访问入口
├── tailwind.config.js                  # Tailwind 配置（卡通色盘）
└── package.json
```

## AI 句子生成流程

```
① 前端加权排序 → ② 发送给 API → ③ DeepSeek 生成 → ④ 四项检查
                                                      ├─ 敏感词过滤
                                                      ├─ 越界字检查
                                                      ├─ 最少字数检查
                                                      └─ 自评分数检查（自然度 + 口语化）
                                                      ↓
                                          ⑤ 通过 → 返回 | 失败 → 回传反馈重试（最多 3 次）
                                          ⑥ 全部失败 → 使用内置保底句
```

AI 提示词采用 **自评分机制**：每次输出附带「自然程度分数」和「口语化分数」（1-10），低于阈值自动重试，确保输出质量。

## 环境变量

| 变量 | 必填 | 说明 |
|------|------|------|
| `DEEPSEEK_API_KEY` | 否 | DeepSeek API 密钥。不填则使用内置保底句池 |

环境变量文件位于 `hanzi-learn/env`，Docker 容器通过挂载此文件注入。

## iPad 全屏使用

1. 用 Safari 打开页面
2. 点击「分享」按钮 → 「添加到主屏幕」
3. 主屏幕图标以 standalone 模式启动（无浏览器导航栏）

## 局域网访问

在同一 WiFi 下的 iPad/手机可通过局域网地址访问：

```bash
cd hanzi-learn
npm run dev:lan      # 开发模式（0.0.0.0）
npm run start:lan    # 生产模式（0.0.0.0）
# 或直接使用 lan.js
node lan.js
```

启动后终端会显示本机和局域网地址。

## 本地开发

```bash
cd hanzi-learn

npm run dev          # 开发服务器
npm run dev:lan      # 开发服务器（局域网可访问）
npm run build        # 生产构建
npm run start        # 启动生产服务
npm run start:lan    # 启动生产服务（局域网可访问）
npm run lint         # 代码检查
```

## Docker 构建与部署

项目提供了一套 Docker 构建方案，适用于 x86_64 (amd64) 服务器部署。

### 构建镜像

```bash
cd hanzi-learn

# 方式一：使用构建脚本（自动带代理 + 导出 tar 包）
bash scripts/build.sh

# 方式二：通过 npm script
npm run docker:build

# 方式三：手动构建
docker build \
  --build-arg HTTP_PROXY=http://host.docker.internal:7890 \
  --build-arg HTTPS_PROXY=http://host.docker.internal:7890 \
  --platform linux/amd64 \
  -t hanzi-learn .
```

构建完成后会在 `hanzi-learn/` 目录生成 `hanzi-learn-image.tar`。

### 配置密钥

容器通过挂载 `env` 文件注入环境变量，密钥不打包进镜像：

```bash
# 确保 hanzi-learn/env 包含 DEEPSEEK_API_KEY=sk-xxx
echo 'DEEPSEEK_API_KEY=sk-your-key-here' > hanzi-learn/env
```

### 本地运行（docker-compose）

```bash
cd hanzi-learn
docker compose up -d
# 访问 http://localhost:3000
```

### 部署到服务器

```bash
# 1. 将 tar 包和 env 文件传到服务器
#    tar 包位置: hanzi-learn/hanzi-learn-image.tar
scp hanzi-learn/hanzi-learn-image.tar hanzi-learn/env user@server:/path/

# 2. 服务器上加载镜像并运行
docker load -i hanzi-learn-image.tar
docker run -d \
  --name hanzi-learn \
  -v $(pwd)/env:/app/env:ro \
  -p 3000:3000 \
  --restart unless-stopped \
  hanzi-learn
```
