# AGENTS.md — 快乐识字 (Learn Hanzi)

AI agent instructions for working with this codebase. Follow these when adding features,
fixing bugs, or refactoring.

---

## Project overview

一个帮助 6-9 岁小朋友学习汉字的 Next.js 趣味网页应用。支持 iPad 全屏 PWA 运行，通过
DeepSeek AI 动态生成词句，配合加权随机算法确保每个汉字都能被均衡使用。

**目标用户**：儿童（句子生成 + 字卡打印）与家长（统计看板 + 字库/模型管理）。

**降级底线**：无 API Key 或生成连续失败时，直示权重最大的单字（不存在「内置句池」这一层），
任何情况都不白屏。

## Repository layout

```
learn-hanzi/               # Git 仓库根（本文件所在目录）
├── AGENTS.md              # ← 本文件
├── README.md              # 用户视角的功能与部署说明
├── docs/
│   ├── known-issues.md    # 已知问题与后续优化清单（改完问题记得回写）
│   └── superpowers/       # 设计规格与实现计划草稿（本地目录，被 docs/.gitignore 忽略）
└── hanzi-learn/           # Next.js 14 应用主体
    ├── src/
    │   ├── app/           # App Router 页面（layout + page + api 路由）
    │   ├── components/    # UI 组件（child / parent / shared）
    │   ├── hooks/         # 自定义 Hook
    │   ├── lib/           # 纯逻辑与工具函数（lib/server 仅服务端）
    │   └── test/          # Vitest 全局 setup
    ├── public/            # PWA manifest / sw.js / 图标
    ├── scripts/           # Docker 构建、打 tag、图标生成脚本
    ├── data/              # 运行时数据：config.json / stats.json / banks.json（gitignore）
    ├── env                # 本地环境变量文件（gitignore，由 next.config.js 加载）
    ├── Dockerfile
    ├── docker-compose.yml
    └── ...
```

**关键规则**：所有代码编写与命令执行均在 `hanzi-learn/` 子目录下进行。

**文档地图（改行为时同步更新）**：

| 改动                               | 需要同步的文档                                        |
| ---------------------------------- | ----------------------------------------------------- |
| 页面/功能/命令/环境变量/部署方式   | `README.md` 对应章节                                  |
| 架构约定、目录结构、质量门槛       | 本文件（AGENTS.md）                                   |
| 新增/修复已知问题、残余风险        | `docs/known-issues.md`                                |
| 校验链规则（`generationRules.ts`） | 同步 `generationRules.test.ts` + 本文件「生成流水线」 |

## Tech stack

| 层       | 技术                                                                                |
| -------- | ----------------------------------------------------------------------------------- |
| 框架     | Next.js 14 (App Router)                                                             |
| 语言     | TypeScript（严格模式）                                                              |
| 样式     | Tailwind CSS 3 — 卡通色盘 `candy.{pink,orange,yellow,green,teal,purple,sky,mint}`   |
| 动画     | Framer Motion 11                                                                    |
| 图表     | Recharts 2                                                                          |
| AI       | DeepSeek Chat API（可选；无 Key 或失败时直示权重最大的单字）                        |
| 模型选择 | `GET /api/model` 自动获取账号可用模型 + 家长手动切换（持久化到 `data/config.json`） |
| 音效     | Web Audio API（程序化生成，零外部资源加载）                                         |
| 语音     | Web Speech API (TTS)                                                                |
| 存储     | localStorage（离线镜像）+ `data/{config,stats,banks}.json`（服务端三个分区文件）    |
| PWA      | manifest.json + Service Worker（public/sw.js）+ standalone 模式                     |
| 测试     | Vitest 4 (jsdom) + Testing Library                                                  |

## Development commands

所有命令在 `hanzi-learn/` 目录下执行（要求 Node.js ≥ 20.19）：

```bash
npm run dev          # 开发服务器
npm run dev:lan      # 开发服务器（0.0.0.0，局域网可访问）
npm run build        # 生产构建
npm run start        # 启动生产服务
npm run start:lan    # 启动生产服务（局域网可访问）
npm run lint         # ESLint 检查（eslint .）
npm run lint:fix     # ESLint 自动修复
npm run format       # Prettier 格式化
npm run format:check # Prettier 检查（不在 check 流程内，提交前可补跑）
npm run typecheck    # tsc --noEmit 类型检查
npm run test         # 测试 + 覆盖率（全项目门槛，不达标失败）
npm run test:lib     # 仅 src/lib 的测试与覆盖率
npm run test:watch   # 测试监听模式
npm run check        # 一键检查：typecheck + lint + test
npm run docker:build # Docker 构建（含代理 + tar 导出）
npm run tag          # 版本打 tag（scripts/tag.sh）
```

## Architecture patterns

### AI 句子生成流水线

1. 前端 `useWeightEngine` 加权排序
2. 直示检查（权重 > 20 且距上次直示 ≥ 3 轮 → 跳过 API 直接显示单字）
3. `POST /api/generate` → DeepSeek 生成
4. 服务端校验链（`lib/generationRules.ts`：重复输出、敏感词、越界字、最少字数 2 字、
   最大长度 12 字、历史去重；不依赖模型自评）
5. 通过即返回，失败最多重试 3 次（温度 0.4/0.7/1.0 递增，超时 12s + 指数退避，
   纠错提示回传给模型）
6. 全部失败或无有效 Key 时挑选权重最大的字直接显示单字

> 校验规则集中在纯函数 `checkGeneratedOutput()`，路由只负责调用与回传纠错提示；
> 改规则请同步 `generationRules.test.ts`。
> 历史去重来源 = 服务端内存最近 8 条 + `data/stats.json` 的 `sentenceHistory`（重启后仍生效）。

### AI 模型选择（`lib/modelCatalog.ts` + `lib/server/modelStore.ts`）

- 模型名解析优先级：家长手动选择 → `DEEPSEEK_MODEL` → 内置默认 `deepseek-v4-flash`
- `GET /api/model` 用 API Key 调 `https://api.deepseek.com/models` 自动获取账号可用模型，
  结果缓存 10 分钟并合并在途请求（`DEEPSEEK_MODEL_CACHE_MS` / `DEEPSEEK_MODEL_TIMEOUT_MS` 可调）
- 家长在设置页点击切换 → `PUT /api/model` 写入 `data/config.json` 的 `model`；
  空串 = 自动。generate 路由每次请求重新解析，切换无需重启
- 无 Key / 上游异常 → 展示内置兜底目录并提示，不阻塞设置页；
  手动选择的模型已下线时 generate 回退默认模型
- 可用性预检（`isModelAvailable`）只要有缓存（哪怕过期）就立即判定、后台刷新，仅冷启动才等待上游

### 加权随机算法（`lib/weightEngine.ts` + `hooks/useWeightEngine.ts`）

- 每个汉字初始权重 1
- 被选中后权重归 0，未选中每轮 +1（无上限）
- 权重 > 20 且距上次直示 ≥ 3 轮（`DIRECT_SHOW_GAP`）时直示权重最大的单字，确保所有字都能被学到
- 权重越高下次被排到前面概率越大 → 保证每个字均衡使用

### 打印字卡（`/print` 路由）

- 独立页面，通过 URL query `?bank=xxx` 切换字库（数据来自 `data/banks.json`；`comprehensive` 综合为虚拟字库，由已启用字库求并集；均只取 `getActiveChars()` 生效字）
- 支持：字体/字号/裁切线/拼音显示/染色/份数系数 等配置（`hooks/usePrintConfig.ts`）
- 按字频分为 3 级（Tier 1~3），高频字印更多份；未登记字按 Tier 3
- 打印配置保存在浏览器 localStorage，不参与服务端同步

### 状态管理（`lib/storage.ts` + `lib/stateSync.ts` + `lib/server/stateStore.ts`）

**唯一真相是服务端的三个分区文件**，浏览器 localStorage 只是离线镜像：

| 分区   | 文件               | 内容                                                 |
| ------ | ------------------ | ---------------------------------------------------- |
| 配置类 | `data/config.json` | 家长密码、手动选择的模型                             |
| 统计类 | `data/stats.json`  | 调用统计、历史、字频、字库权重进度 `progress`        |
| 词库类 | `data/banks.json`  | 字库定义（`origin: builtin/custom`）+ 启停 `enabled` |

三个数据事件（判定规则只在 `lib/banks.ts` 纯函数里写一份，服务端与客户端共用）：

- **E1 初始化** `ensureInitialized()` — 启动钩子 `src/instrumentation.ts` 调用；文件不存在即写入默认值
  （内置字库由此落盘）。读路径 `GET /api/state` 调同一幂等函数兜底自愈（文件被手工删掉也能补回）
- **E2 迁移** `migrateLegacyIfNeeded()` — v1 单文件 `state.json` → 三份 + `state.json.v1.bak`；
  先写全三份、最后改名，中途崩溃可从 v1 补齐缺失分区
- **E3 升级补种** `reconcileBanks()` — `seedRevision` / `seedFingerprint` 与代码不一致时，只更新
  `origin: "builtin"` 且未被家长改过（`customized`）的条目；`custom` / `customized` 永不覆盖

> `lib/seed/builtinBanks.ts` 是**初始化默认值，不是运行时数据源**：读取一律走
> `useBanks()` / `loadBanks()`（镜像）→ `/api/state`（真相）。ESLint `no-restricted-imports`
> 禁止业务代码引用它（仅 `lib/banks.ts` 与测试可引用）。

- `storage.ts` — 三分区镜像读写、v1 本地缓存一次性迁移、500ms 防抖推送 `PUT /api/state`
  （**推送失败重新入队**，网络恢复 / 下次同步重推；`withSuppressedServerSync` 抑制回写期反向 PUT）
- `stateSync.ts` — **先推后拉**；首次迁移（本地有用户数据 + 服务端没有 → 推本地，判据是内容不是时间戳）；
  其余按**分区时间戳**只覆盖服务端更新的那份；并发调用合并为一次；失败静默
- `components/shared/StateSync.tsx` — 挂载与**窗口重新可见 / 获得焦点**时触发同步，
  完成后广播 `hanzi-state-synced`（iPad PWA 从后台切回不重挂载页面）
- `lib/server/stateStore.ts` — 三分区原子写（临时文件 + rename）、初始化、迁移、损坏隔离与只读降级；
  `stats.progress` 按 bankId 合并，`progressMode: "replace"` 时整体替换（权重重置）
- `hooks/useBanks.ts` — 字库数据源 Hook；`ready` 用于**门控跳转**（就绪前 items 为空，不能据此判定
  "字库不存在"，否则冷启动/离线首屏会闪回选择页）
- `useWeightEngine` / `useStats` / `usePrintConfig` — 各领域状态的 Hook 封装

⚠️ `banks.json` 里的内置条目不可删除，只能 `enabled: false` 停用；停用的字库不会出现在"综合"里。
删除自定义字库时需联动清理 `stats.progress[bankId]`（设置页已处理）。

### 字库内容维护（`lib/banks.ts` 纯函数 + `app/parent/banks` 页面）

- **入口**：设置页每张字库卡片 →「📝 内容」→ `/parent/banks?bank=<id>`
  （`app/parent/settings/page.tsx` 只负责入口跳转，维护逻辑都在维护页 + 纯函数里）
- **生效字**：`chars` 保存字库完整定义，`disabledChars` 记录被家长单独禁用的字；
  **一切"用字"的地方都必须走 `getActiveChars()`**（生成 / 打印 / 综合合并 / 卡片字数），不得直接用 `bank.chars`
- **内置字**：`origin === "builtin"` 且出现在 `lib/seed/builtinBanks.ts` 默认值里的字（`isBuiltinChar()`）
  只能禁用、不能删除；家长新增到内置字库的字属于自定义内容，可以删除
- **升级补种免疫**：给内置字库补充新字会置 `customized: true`（否则 E3 会把新增内容冲掉）；
  仅禁用汉字（`disabledChars`）不改内容，因此不置 `customized`，仍可接收升级
- **下限**：每个字库至少保留 `MIN_ACTIVE_CHARS`（1）个生效字，禁用/删除到 0 个会被纯函数拒绝
- 新增/修改此规则时同步 `lib/banks.test.ts` 与 `app/parent/banks/page.test.tsx`

### 密码保护

家长入口通过 4 位数字密码鉴权（`PasswordGate`）。

> ⚠️ 默认密码是 `"1234"`（`lib/stateShape.ts` 的 `DEFAULT_PASSWORD`），
> 因此「首次使用引导设置」分支实际不可达——等价于固定默认口令。
> 修改此行为时同步 `PasswordGate.test.tsx` 与 `docs/known-issues.md`。

### 版本徽标（`lib/version.ts` + `components/shared/VersionBadge.tsx`）

- 根布局左下角固定展示版本（如 `v1.2.0 · 38ac7b2`），全站生效、打印隐藏
- 版本来源：构建期 `APP_VERSION` → package.json → `dev`；`GIT_COMMIT` 为 git 短哈希
- 注入方式：`next.config.js` 的 `env` 字段（Docker 由 `scripts/build.sh` 传入）；
  改动注入逻辑后必须重新 build 才会生效

### PWA 与离线

- `layout.tsx` 仅在生产构建注册 `public/sw.js`（导航网络优先 + 静态缓存优先）
- 离线只覆盖应用壳/静态资源；AI 生成仍需网络，断网走单字直示兜底

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
8. **API 路由**：保持精简，当前为 `api/generate`（句子生成）、`api/model`（模型列表与切换）、
   `api/state`（服务端状态同步）；新增路由前先考虑能否并入既有端点。
9. **日志**：详细日志走 `lib/debug.ts` 的 `debugLog()`（默认静默，构建时 `NEXT_PUBLIC_DEBUG=1`
   开启）；异常走 `logError()`（始终输出）。业务代码不直接 `console.log`——
   加权洗牌等高频路径在生产环境会刷屏。服务端要打印完整 Prompt 时用 `DEBUG_PROMPT=1`。
10. **日期**：统计相关日期一律用 `lib/date.ts` 的 `localDateString()`，
    不要用 `toISOString().slice(0,10)`（UTC 会在凌晨错记到前一天）。

## 测试与质量

- **测试框架**：Vitest 4（jsdom）+ Testing Library；测试文件与源码同目录（`*.test.ts(x)`），中文注释；
  API 路由等 Node 场景用 `@vitest-environment node`（见 `src/test/setup.ts` 的守卫注释）
- **覆盖率门槛**：
  - `npm run test`（全项目，覆盖 `src/lib`+`src/hooks`+`src/components`+`src/app/api`）：
    lines/functions/statements ≥ 60%、branches ≥ 50%
  - `npm run test:lib`（仅 `src/lib`）：lines/functions/statements ≥ 80%、branches ≥ 75%
  - 门槛配置见 `vitest.config.ts` / `vitest.lib.config.ts`
- **Lint**：`eslint .`（eslint-config-next + prettier 规则关闭冲突）；格式化用 Prettier（`.prettierrc.json`）
- **类型检查**：`tsc --noEmit`（tsconfig 已 strict）
- **提交前**：跑 `npm run check` 全绿（typecheck + lint + test），必要时补 `npm run format:check`

## Important constraints

- **目标设备 iPad**：UI 必须适配 iPad 触摸操作和竖屏/横屏。按钮尺寸足够大。
- **离线友好**：AI 不可用时降级为单字直示，不白屏。
- **PWA standalone**：从主屏幕启动后无浏览器 UI，页面内需自行处理导航与返回。
- **儿童友好**：UI 极简（大按钮 + 引导动效），无文字干扰，色彩鲜艳柔和。
- **Docker 构建限 amd64**：`Dockerfile` 和 `scripts/build.sh` 针对 x86_64 服务器。
- **无鉴权设计**：`/api/*` 均无鉴权，按家庭内网部署；若要暴露公网需先加共享 token
  （见 `docs/known-issues.md` 安全章节）。
