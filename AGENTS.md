# AGENTS.md — 快乐识字 (Learn Hanzi)

AI agent instructions for working with this codebase. Follow these when adding features,
fixing bugs, or refactoring.

---

## Project overview

一个帮助 6-9 岁小朋友学习汉字的 Next.js 趣味网页应用。支持 iPad 全屏 PWA 运行，通过
DeepSeek AI 动态生成词句，配合加权随机算法确保每个汉字都能被均衡使用。

**目标用户**：儿童（句子生成 + 字卡打印）与家长（统计看板 + 字库管理）。

## Repository layout

```
learn-hanzi/               # Git 仓库根（本文件所在目录）
├── AGENTS.md              # ← 本文件
├── README.md
├── docs/superpowers/      # 设计规格与实现计划
│   ├── specs/
│   └── plans/
└── hanzi-learn/           # Next.js 14 应用主体
    ├── src/
    │   ├── app/           # App Router 页面（layout + page）
    │   ├── components/    # UI 组件（child / parent / shared）
    │   ├── hooks/         # 自定义 Hook
    │   └── lib/           # 纯逻辑与工具函数
    ├── public/            # PWA manifest 等静态资源
    ├── scripts/           # Docker 构建脚本
    ├── Dockerfile
    ├── docker-compose.yml
    └── ...
```

**关键规则**：所有代码编写与命令执行均在 `hanzi-learn/` 子目录下进行。

## Tech stack

| 层 | 技术 |
|----|------|
| 框架 | Next.js 14 (App Router) |
| 语言 | TypeScript（严格模式） |
| 样式 | Tailwind CSS 3 — 卡通色盘 `candy.{pink,orange,yellow,green,teal,purple,sky,mint}` |
| 动画 | Framer Motion 11 |
| 图表 | Recharts 2 |
| AI | DeepSeek Chat API（可选；无 Key 时 fallback 内置句池） |
| 音效 | Web Audio API（程序化生成，零外部资源加载） |
| 语音 | Web Speech API (TTS) |
| 存储 | localStorage（统计、权重、配置） |
| PWA | manifest.json + standalone 模式 |

## Development commands

所有命令在 `hanzi-learn/` 目录下执行：

```bash
npm run dev          # 开发服务器
npm run dev:lan      # 开发服务器（0.0.0.0，局域网可访问）
npm run build        # 生产构建
npm run start        # 启动生产服务
npm run start:lan    # 启动生产服务（局域网可访问）
npm run lint         # ESLint 检查（eslint .）
npm run lint:fix     # ESLint 自动修复
npm run format       # Prettier 格式化
npm run format:check # Prettier 检查
npm run typecheck    # tsc --noEmit 类型检查
npm run test         # 测试 + 覆盖率（全项目 ≥60%，不达标失败）
npm run test:lib     # lib 层测试（覆盖率 ≥80%）
npm run test:watch   # 测试监听模式
npm run check        # 一键检查：typecheck + lint + test
npm run docker:build # Docker 构建（含代理 + tar 导出）
```

## Architecture patterns

### AI 句子生成流水线

1. 前端 `useWeightEngine` 加权排序 → 2. `POST /api/generate` →
3. DeepSeek 生成 → 4. `validator.ts` 四项检查（敏感词、越界字、最少字数、
   自评自然度/口语化）→ 5. 通过即返回，失败最多重试 3 次 →
6. 全部失败使用 `fallbackSentences.ts` 内置保底句

### 加权随机算法（`lib/weightEngine.ts`）

- 每个汉字初始权重 1
- 被 AI 选中后权重归 1，未选中每轮 +1（上限 20）
- 权重越高下次被排到前面概率越大 → 保证每个字均衡使用

### 打印字卡（`/print` 路由）

- 独立页面，通过 URL query `?bank=xxx` 切换字库
- 支持：字体/字号/裁切线/拼音显示/染色/份数系数 等配置
- 按字频分为 3 级（Tier 1~3），高频字印更多份

### 状态管理

无外部状态库。全部通过 localStorage 持久化：
- `storage.ts` — 通用 localStorage 封装
- `useWeightEngine` — 权重状态
- `useStats` — 学习统计
- `usePrintConfig` — 打印配置

### 密码保护

家长入口通过 4 位数字密码鉴权（`PasswordGate`），首次使用引导设置。

## Coding conventions

1. **中文注释**：本项目的注释使用中文，新代码保持一致。
2. **组件分层**：`child/`（儿童界面）、`parent/`（家长界面）、`shared/`（共用）。
3. **Tailwind 色盘**：使用预定义的 `candy-*` 颜色，勿随意添加新色值。
4. **动画**：优先使用 Framer Motion 而非 CSS animation；Tailwind keyframe
   anim 仅用于简单循环动效（`breathe`、`float`、`twinkle` 等）。
5. **TypeScript 严格模式**：所有 new code 必须有完整类型注解。
6. **无外部音频/图片**：音效用 Web Audio API 程序化生成，不引入 mp3/wav 等资源。
7. **环境变量**：`DEEPSEEK_API_KEY` 通过 `hanzi-learn/env` 文件注入，
   不写在 `.env` 或代码中。Docker 通过 `-v` 挂载。
8. **API 路由**：仅在 `src/app/api/generate/route.ts` 存在，保持单一 API 端点。

## 测试与质量

- **测试框架**：Vitest（jsdom）+ Testing Library；测试文件与源码同目录（`*.test.ts(x)`），中文注释
- **覆盖率门槛**：`npm run test` 全项目 lines/functions/statements ≥ 60%、branches ≥ 50%；
  `npm run test:lib` 对 `src/lib` 要求 ≥ 80%（门槛配置见 `vitest.config.ts` / `vitest.lib.config.ts`）
- **Lint**：`eslint .`（eslint-config-next + prettier 规则关闭冲突）；格式化用 Prettier（`.prettierrc.json`）
- **类型检查**：`tsc --noEmit`（tsconfig 已 strict）
- **提交前**：跑 `npm run check` 全绿（typecheck + lint + test）

## Important constraints

- **目标设备 iPad**：UI 必须适配 iPad 触摸操作和竖屏/横屏。按钮尺寸足够大。
- **离线友好**：AI 不可用时自动 fallback 到内置句池，不白屏。
- **PWA standalone**：从主屏幕启动后无浏览器 UI，页面内需自行处理导航与返回。
- **儿童友好**：UI 极简（大按钮 + 引导动效），无文字干扰，色彩鲜艳柔和。
- **Docker 构建限 amd64**：`Dockerfile` 和 `scripts/build.sh` 针对 x86_64 服务器。
