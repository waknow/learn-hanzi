# 快乐识字 🎈

一个帮助 6-9 岁小朋友学习汉字的趣味网页应用。支持 iPad 全屏 PWA 运行，通过 AI 动态生成词句，
配合加权随机算法确保每个汉字都能被均衡使用。

- **目标用户**：儿童（生成句子 + 打印字卡）与家长（统计看板 + 字库/模型管理）。
- **设计底线**：AI 不可用 / 生成失败时降级为「直示权重最大的单字」，永远不白屏；离线可打开应用壳。

## 快速开始

```bash
# 进入应用目录（代码与命令都在 hanzi-learn/ 下执行）
cd hanzi-learn

# 要求 Node.js ≥ 20.19（vitest 4 / jsdom 29 的引擎要求）
node -v

# 安装依赖
npm install

# 配置 DeepSeek API Key（可选，无 Key 时直示字库中权重最大的单字）
echo 'DEEPSEEK_API_KEY=sk-your-key-here' > env

# 启动开发服务器
npm run dev
```

打开 http://localhost:3000 即可使用。

## 开发与质量检查

| 命令                                  | 说明                                          |
| ------------------------------------- | --------------------------------------------- |
| `npm run dev`                         | 开发服务器                                    |
| `npm run dev:lan`                     | 开发服务器（0.0.0.0，局域网可访问）           |
| `npm run build`                       | 生产构建                                      |
| `npm run start` / `npm run start:lan` | 启动生产服务（后者监听 0.0.0.0）              |
| `npm run typecheck`                   | `tsc --noEmit` 类型检查（tsconfig 已 strict） |
| `npm run lint` / `lint:fix`           | ESLint 检查 / 自动修复                        |
| `npm run format` / `format:check`     | Prettier 格式化 / 校验                        |
| `npm run test`                        | Vitest + 覆盖率（不达标即失败）               |
| `npm run test:lib`                    | 仅 `src/lib` 的测试与覆盖率                   |
| `npm run test:watch`                  | 测试监听模式                                  |
| `npm run check`                       | 一键检查：typecheck + lint + test             |
| `npm run docker:build`                | Docker 构建（含代理 + tar 导出）              |
| `npm run tag`                         | 版本打 tag（见「版本管理」）                  |

测试文件与源码同目录（`*.test.ts(x)`），共 35 个测试文件，使用 Vitest（jsdom）+ Testing Library；
API 路由等 Node 场景用例通过 `@vitest-environment node` 覆盖。

**覆盖率门槛**（配置见 `vitest.config.ts` / `vitest.lib.config.ts`）：

| 范围                                         | lines / functions / statements | branches |
| -------------------------------------------- | ------------------------------ | -------- |
| 全项目（lib + hooks + components + app/api） | ≥ 60%                          | ≥ 50%    |
| `src/lib`（`npm run test:lib`）              | ≥ 80%                          | ≥ 75%    |

> `npm run check` 不包含 `npm run format:check`，提交前可单独补跑一次。

## 核心功能

### 👶 小朋友界面

| 页面                                | 说明                                                              |
| ----------------------------------- | ----------------------------------------------------------------- |
| 首页 `/`                            | 选择「小朋友」或「家长」入口                                      |
| 字库选择 `/child`                   | 字库卡片（一级/二级/自定义/综合），点击进入；卡片角上另有打印入口 |
| 句子生成 `/child/sentence?bank=xxx` | 点击大按钮 → AI 用字库中的汉字造词句，支持语音朗读                |
| 字卡打印 `/print?bank=xxx`          | 生成可打印字卡，支持多种配置                                      |

**页面极简**：只有一个大按钮 + 引导动效，生成后展示句子 + 「再来一句」按钮。无多余干扰。

### 👩 家长界面

| 页面                         | 说明                                                                                        |
| ---------------------------- | ------------------------------------------------------------------------------------------- |
| 密码验证 `/parent`           | 4 位数字键盘，首次使用引导设置                                                              |
| 统计看板 `/parent/dashboard` | 总使用 / 今日 / 本周（近 7 天）/ 已学汉字、各字使用频率柱状图、本周打卡日历、最近 10 条句子 |
| 字库管理 `/parent/settings`  | AI 模型切换、启用/禁用字库、自定义字库增删改、权重重置、修改家长密码、清除学习记录          |
| 字库内容 `/parent/banks?bank=xxx` | 逐个维护字库里的汉字：添加 / 删除 / 禁用；内置字只能禁用不能删除                     |

### 🖨️ 字卡打印

在字库选择页点击「打印」或直接访问 `/print?bank=xxx`，生成可打印的汉字卡片。

| 配置项   | 选项                                             |
| -------- | ------------------------------------------------ |
| 字体     | 楷体、宋体、黑体、圆体、微软雅黑、苹方、仿宋     |
| 字号     | 36pt（小）、48pt（中）、60pt（大）、72pt（特大） |
| 裁切线   | 虚线、圆点、实线标记、隐藏                       |
| 拼音     | 显示/隐藏                                        |
| 染色     | 开/关 — 每个汉字分配不同颜色组合（24 色循环）    |
| 份数系数 | 0.5x ~ 3.0x（步进 0.5）— 高频字印更多份          |

打印配置属设备偏好，保存在浏览器 localStorage（`hanzi_print_config`），不参与服务端同步。

### 核心机制

**两级内置字库 + 自定义**：内置「一级」（60 个基础字）与「二级」（当前启用 10 个字：
雨伞闪电干根土皮枝森，其余 80 字以注释预留）字库，可合并为「综合」模式；
家长可在设置页新增自定义字库（2~15 个汉字），自定义字库同样支持生成与打印。

**字库内容维护**：设置页每张字库卡片都有「📝 内容」入口，进入 `/parent/banks?bank=xxx` 可逐个维护
字库里的汉字——添加、删除、禁用/启用。给整个字库启停之外，被禁用的单个汉字同样不参与生成、打印与
「综合」合并；内置于应用的内置字（🔒）只能禁用、不能删除，家长自己添加的字可以删除；每个字库至少
保留 1 个生效汉字。

**加权随机排序**：每个汉字初始权重为 1。被 AI 使用后权重重置为 0，未被使用的每次 +1（无上限）。
权重越高，下次被排到前面的概率越大；权重 > 20 且距上次直示 ≥ 3 轮时，跳过 API 直接显示权重最大的单字，
确保字库中每个字最终都被用到。

**频率分级**：打印字卡时，按汉字日常使用频率分为 3 级（Tier 1 印 3 份 / Tier 2 印 2 份 / Tier 3 印 1 份），
配合份数系数调节份数；未登记在 `frequency.ts` 中的字按 Tier 3 处理。

## 技术栈

| 层       | 技术                                                                                         |
| -------- | -------------------------------------------------------------------------------------------- |
| 框架     | Next.js 14 (App Router)                                                                      |
| 语言     | TypeScript（严格模式）                                                                       |
| 样式     | Tailwind CSS 3（卡通色盘 `candy.{pink,orange,yellow,green,teal,purple,sky,mint}`）           |
| 动画     | Framer Motion 11                                                                             |
| 图表     | Recharts 2（家长看板）                                                                       |
| AI       | DeepSeek Chat API（可选；无 Key 或生成失败时直示权重最大的单字）                             |
| 模型选择 | `GET /api/model` 自动获取账号可用模型 + 家长手动切换（持久化到 `data/config.json`）          |
| 音效     | Web Audio API（程序化生成，零外部资源加载）                                                  |
| 语音     | Web Speech API (TTS)                                                                         |
| 拼音     | 内置拼音映射表（覆盖全部启用字库，189 条）                                                   |
| 存储     | localStorage（离线镜像）+ `data/{config,stats,banks}.json`（服务端三个分区文件，跨设备恢复） |
| PWA      | manifest.json + Service Worker（`public/sw.js`）+ standalone 模式                            |
| 测试     | Vitest 4 + Testing Library + jsdom                                                           |

## 项目结构

项目根 `learn-hanzi/` 为 Git 仓库根目录，Next.js 应用位于 `hanzi-learn/` 子目录。

```
learn-hanzi/                          # Git 仓库根
├── AGENTS.md                         # AI agent 协作说明
├── README.md                         # 本文件
├── docs/
│   ├── known-issues.md               # 已知问题与后续优化清单
│   └── superpowers/                  # agent 设计规格/计划草稿（本地，见 docs/.gitignore）
└── hanzi-learn/                      # Next.js 应用主体
    ├── src/
    │   ├── instrumentation.ts        # 服务启动钩子（数据初始化 E1 / v1 迁移 E2）
    │   ├── app/
    │   │   ├── layout.tsx            # 根布局（PWA meta + Google Fonts + SW 注册 + StateSync + VersionBadge）
    │   │   ├── page.tsx              # 首页（儿童/家长入口）
    │   │   ├── globals.css           # 全局样式（含打印样式）
    │   │   ├── child/
    │   │   │   ├── layout.tsx        # 儿童区布局
    │   │   │   ├── page.tsx          # 字库选择页
    │   │   │   └── sentence/page.tsx # ⭐ 句子生成三态页
    │   │   ├── parent/
    │   │   │   ├── page.tsx          # 密码验证
    │   │   │   ├── dashboard/page.tsx# 统计看板
    │   │   │   ├── settings/page.tsx # 字库管理与 AI 模型
    │   │   │   └── banks/page.tsx    # 字库内容维护（添加/删除/禁用汉字）
    │   │   ├── print/page.tsx        # 🖨️ 字卡打印页
    │   │   └── api/
    │   │       ├── generate/route.ts # DeepSeek 代理 + 校验链 + 重试
    │   │       ├── model/route.ts    # 模型列表获取 + 家长切换
    │   │       └── state/route.ts    # 服务端状态读写
    │   ├── components/
    │   │   ├── child/
    │   │   │   ├── IdleState.tsx     # 待机态（大按钮）
    │   │   │   ├── LoadingState.tsx  # 加载态（火箭动效）
    │   │   │   ├── ResultState.tsx   # 结果态（句子展示 + 防抢点）
    │   │   │   ├── WordBankPicker.tsx# 字库选择网格
    │   │   │   ├── PrintCards.tsx    # 字卡打印组件（配置 + 排版）
    │   │   │   └── BackButton.tsx    # 返回按钮
    │   │   ├── parent/
    │   │   │   └── ModelSelector.tsx # AI 模型选择卡片
    │   │   └── shared/
    │   │       ├── PasswordGate.tsx  # 密码验证组件
    │   │       ├── StateSync.tsx     # 启动时与服务端同步状态（无 UI）
    │   │       ├── VersionBadge.tsx  # 角落版本徽标（全站）
    │   │       └── ParticleBg.tsx    # 粒子背景
    │   ├── hooks/
    │   │   ├── useBanks.ts           # 字库数据源 Hook（服务端 banks.json 的镜像）
    │   │   ├── useWeightEngine.ts    # 权重引擎 Hook
    │   │   ├── useSound.ts           # 音效 / TTS Hook
    │   │   ├── useStats.ts           # 统计 Hook
    │   │   ├── usePrintConfig.ts     # 打印配置 Hook
    │   │   └── useIdleTimeout.ts     # 无操作超时 Hook（预留，暂无调用方）
    │   ├── lib/
    │   │   ├── types.ts              # 核心类型定义
    │   │   ├── schema.ts             # 持久化结构版本与分区文件名
    │   │   ├── banks.ts              # 词库分区纯函数（初始化/迁移/升级补种/内容维护/合并，双端共用）
    │   │   ├── stateShape.ts         # 跨分区共享判定（默认值 / 用户数据 / 时间戳）
    │   │   ├── seed/builtinBanks.ts  # 内置字库「初始化默认值」（仅初始化模块可引用）
    │   │   ├── weightEngine.ts       # 加权不放回抽样算法
    │   │   ├── generationRules.ts    # 生成校验链（纯函数，可单测）
    │   │   ├── validator.ts          # 越界字 / 敏感词校验
    │   │   ├── pinyin.ts             # 拼音映射表
    │   │   ├── colors.ts             # 染色系统（24 色配色）
    │   │   ├── frequency.ts          # 字频分级（Tier 1~3）
    │   │   ├── soundEngine.ts        # Web Audio API 音效引擎
    │   │   ├── modelCatalog.ts       # DeepSeek 模型目录（元数据/解析规则）
    │   │   ├── version.ts            # 版本信息解析（构建期注入 → package.json）
    │   │   ├── date.ts               # 本地时区日期工具（避免 UTC 错位）
    │   │   ├── debug.ts              # 分级日志（debugLog 静默 / logError 始终输出）
    │   │   ├── storage.ts            # localStorage 封装 + 防抖同步服务端
    │   │   ├── stateSync.ts          # 启动同步（首次迁移 / 服务端为准）
    │   │   └── server/
    │   │       ├── modelStore.ts     # 模型自动获取 + 缓存 + 选择持久化
    │   │       └── stateStore.ts     # 三分区文件读写 + 初始化 + 迁移（原子写）
    │   └── test/setup.ts             # Vitest 全局环境（jsdom polyfill）
    ├── public/
    │   ├── manifest.json             # PWA manifest
    │   ├── sw.js                     # Service Worker（导航网络优先 + 静态缓存优先）
    │   └── icon-192.png / icon-512.png / apple-touch-icon.png
    ├── scripts/
    │   ├── build.sh                  # Docker 构建脚本（含版本号解析与一致性校验）
    │   ├── tag.sh                    # 版本打 tag 脚本
    │   └── generate-icons.js         # 零依赖 PWA 图标生成
    ├── Dockerfile                    # 多阶段 Docker 构建
    ├── docker-compose.yml            # Docker Compose 配置
    ├── .dockerignore                 # 构建上下文裁剪
    ├── next.config.js                # 加载 env + 注入 APP_VERSION/GIT_COMMIT
    ├── tailwind.config.js            # Tailwind 配置（卡通色盘）
    ├── data/                         # 运行时数据（config/stats/banks.json，gitignore）
    ├── lan.js                        # 局域网访问入口
    ├── vitest.config.ts / vitest.lib.config.ts
    ├── tsconfig.json / .eslintrc.json / .prettierrc.json
    └── package.json
```

## 架构说明

### AI 句子生成流水线

```
① 前端加权排序 → ② 直示检查（权重 > 20 且距上次 ≥ 3 轮 → 直接显示单字，跳过 API）
   ↓ 未触发直示
③ POST /api/generate → ④ DeepSeek 生成 → ⑤ 服务端校验链（lib/generationRules.ts）
                                            ├─ 检查0 本轮重复输出
                                            ├─ 检查1 敏感词过滤
                                            ├─ 检查2 越界字检查
                                            ├─ 检查3 最少用字（≥2 字）
                                            ├─ 检查4 最大长度（≤12 字）
                                            └─ 检查5 与最近历史重复
   ↓
⑥ 通过 → 返回；失败 → 回传纠错提示重试（最多 3 次，温度 0.4/0.7/1.0 递增，超时 12s + 指数退避）
⑦ 全部失败 / 无有效 Key → 直示权重最大的单字（isFallback=true）
```

服务端用**启发式校验链**把关输出，不依赖模型自评（自评容易"凑分通过"且低分重试成本高）。
校验规则集中在纯函数 `checkGeneratedOutput()`，路由只负责调用与回传纠错提示；
改规则请同步 `generationRules.test.ts`。

历史去重来源为「服务端内存最近 8 条 + `data/stats.json` 的 `sentenceHistory`」，
因此重启服务后仍能避免立刻重复生成同一句。

### AI 模型自动获取与切换

模型名不写死，按以下优先级解析（每次生成请求都重新解析，切换后无需重启服务）：

```
家长手动选择（家长设置页） → 环境变量 DEEPSEEK_MODEL → 内置默认 deepseek-v4-flash
```

- **自动获取**：家长设置页打开时调用 `GET /api/model`，服务端用 `DEEPSEEK_API_KEY`
  请求 `https://api.deepseek.com/models`，返回账号真实可用模型（含上下文长度与用途说明）。
  结果缓存 10 分钟并在途请求合并，避免反复打上游。
- **手动切换**：点击某个模型 → `PUT /api/model` 持久化到 `data/config.json` 的
  `config.model`，同时写入浏览器 localStorage（家长配置随状态同步）。
  选择「自动」即清空该值，回到 env/默认。
- **降级不阻塞**：无 API Key 或上游异常时展示内置兜底目录并提示原因，页面仍可操作；
  家长手动选择的模型若已下线，生成时自动回退默认模型并记录日志。
- **不拖慢生成**：可用性预检只要有缓存（哪怕已过期）就立即判定、后台刷新，仅冷启动才等待上游。

### 加权随机算法（`lib/weightEngine.ts` + `hooks/useWeightEngine.ts`）

- 每个汉字初始权重 1
- 被选中后权重归 0，未选中每轮 +1（无上限）
- 权重 > 20 且距上次单字直示 ≥ 3 轮时，直示权重最大的单字
- 权重越高，下次被排到前面的概率越大 → 保证每个字均衡使用

### 数据与状态

无外部状态库。**唯一真相是服务端的三个 JSON 分区文件**，浏览器 localStorage 只是离线镜像：

| 分区       | 文件               | 内容                                                                          | 关键文件                                    |
| ---------- | ------------------ | ----------------------------------------------------------------------------- | ------------------------------------------- |
| 配置类     | `data/config.json` | 家长密码、手动选择的模型                                                      | `lib/server/stateStore.ts`                  |
| 统计类     | `data/stats.json`  | 调用统计、历史、字频、字库权重进度 `progress`                                 | 同上                                        |
| 词库类     | `data/banks.json`  | 字库定义（内置默认值 + 自定义）、整库启停、逐字禁用 `disabledChars`           | `lib/banks.ts` + `lib/seed/builtinBanks.ts` |
| 浏览器镜像 | localStorage       | 三个分区的副本（`hanzi_parent_config` / `hanzi_study_stats` / `hanzi_banks`） | `lib/storage.ts`                            |
| 浏览器本地 | localStorage       | 打印配置（`hanzi_print_config`，设备偏好，不同步）                            | `hooks/usePrintConfig.ts`                   |

**初始化（E1）**：服务启动时 `src/instrumentation.ts` 调用 `ensureInitialized()`，文件不存在就写入默认值
——内置字库（一级/二级）由此落盘到 `banks.json`。此后所有读取（服务端与界面）都以文件为准；
代码里的 `lib/seed/builtinBanks.ts` 只是「初始化默认值」，业务代码禁止引用（ESLint 兜底）。
读接口另有幂等兜底：文件被手工删除时 `GET /api/state` 会自动补回。

**迁移（E2）**：旧的单文件 `data/state.json` 在首次读取时自动拆成三份，原文件改名 `state.json.v1.bak`
（`customBanks` → 词库条目、`enabledBanks` → 每条 `enabled`、`weightData` → `stats.progress`）。

**升级补种（E3）**：内置字库内容变更（`seedRevision` 或内容指纹 `seedFingerprint` 变化）时，
只更新 `origin: "builtin"` 且未被家长改过的条目；自定义字库永不被覆盖。
家长给内置字库补充过汉字（`customized: true`）的条目不参与补种——新增内容不会被冲掉；仅禁用过
汉字（`disabledChars`）的条目仍可升级，禁用状态会保留。

同步链路：

- 应用挂载 / 窗口重新可见时 `StateSync` 调用 `syncOnce()`：**先推后拉**；首次使用且本地有数据、
  服务端没有用户数据 → 推送本地（老用户平滑迁移）；其余按**分区时间戳**只覆盖服务端更新的那份。
- 本地保存后 500ms 防抖推送 `PUT /api/state`（`stats.progress` 按 bankId 合并；"权重重置"会显式整体替换）。
  推送失败会重新入队，网络恢复或下次同步时重推，离线改动不会被服务端旧值盖掉。
- 服务端回写本地期间通过 `withSuppressedServerSync` 抑制反向 PUT，避免无意义往返。

### PWA 与离线

- `manifest.json` + standalone 模式，从主屏幕启动后无浏览器 UI。
- 生产构建自动注册 `public/sw.js`：导航请求**网络优先**、静态资源**缓存优先**。
- 离线时仅能打开已缓存的应用壳与静态资源；**AI 句子生成仍需网络**，断网会走单字直示兜底。
- 首次访问后需刷新一次完成 Service Worker 安装。

## API 端点

| 端点            | 方法 | 说明                                                                                                                     |
| --------------- | ---- | ------------------------------------------------------------------------------------------------------------------------ |
| `/api/generate` | POST | 句子生成代理。body: `{ bankId, sortedChars, themeWeights? }`；返回 `{ text, usedChars, extraChars, isFallback, model? }` |
| `/api/model`    | GET  | 账号可用模型 + 当前生效模型（`?refresh=1` 跳过缓存）                                                                     |
| `/api/model`    | PUT  | 保存家长选择。body: `{ model: string }`，空串 = 自动                                                                     |
| `/api/state`    | GET  | 读取服务端状态 `{ schemaVersion, config, stats, banks, updatedAt, updatedAtByPart }`（顺带完成初始化 / 升级补种）        |
| `/api/state`    | PUT  | 局部更新 `{ config?, stats?, banks?, progress? }`（旧块名 `weightData` 兼容映射到 `stats.progress`）                     |

> 三个路由均无鉴权，按家庭内网部署设计；如需暴露公网请自行加共享 token（见
> [docs/known-issues.md](docs/known-issues.md) 安全章节）。

## 环境变量

| 变量                        | 必填 | 默认                | 说明                                                                     |
| --------------------------- | ---- | ------------------- | ------------------------------------------------------------------------ |
| `DEEPSEEK_API_KEY`          | 否   | —                   | DeepSeek API 密钥。不填则直示权重最大的单字，且无法自动获取模型列表      |
| `DEEPSEEK_MODEL`            | 否   | `deepseek-v4-flash` | 默认模型名（家长未手动选择时生效）                                       |
| `DEEPSEEK_MODEL_CACHE_MS`   | 否   | `600000`（10 分钟） | 模型列表缓存时长                                                         |
| `DEEPSEEK_MODEL_TIMEOUT_MS` | 否   | `8000`              | 获取模型列表的超时                                                       |
| `DEEPSEEK_TIMEOUT_MS`       | 否   | `12000`             | 单次句子生成请求超时                                                     |
| `DEEPSEEK_RETRY_BASE_MS`    | 否   | `500`               | 重试指数退避基数（第 n 次等待 base × 2^(n-1)）                           |
| `STATE_DIR`                 | 否   | `<cwd>/data`        | 三个分区文件所在目录（Docker 下为 `/app/data`）                          |
| `STATE_FILE`                | 否   | —                   | 兼容旧配置：设置后取其所在目录作为状态目录（并用于查找 v1 `state.json`） |
| `NEXT_PUBLIC_DEBUG`         | 否   | —                   | 置 `1` 开启前端详细日志（`debugLog`）。**构建期内联，改动需重新 build**  |
| `DEBUG_PROMPT`              | 否   | —                   | 置 `1` 打印完整 Prompt（服务端运行时读取）                               |
| `APP_VERSION`               | 否   | package.json 版本   | 构建期注入的版本号，页面左下角版本徽标显示                               |
| `GIT_COMMIT`                | 否   | —                   | 构建期注入的 git 短哈希，随版本徽标显示（如 `v1.2.0 · 38ac7b2`）         |

环境变量文件位于 `hanzi-learn/env`（已加入 .gitignore），`next.config.js` 启动时用 dotenv 加载；
Docker 容器通过挂载此文件注入。

## 版本信息展示

页面左下角固定显示版本徽标（如 `v1.2.0 · 38ac7b2`）：

- 版本号来源优先级：构建期 `APP_VERSION` → `package.json` → `dev`
- Docker 构建由 `scripts/build.sh` 传入版本与 commit（同时写入 `public/version.json`）
- 徽标极小字号、低透明度、`pointer-events-none`（不拦截触摸），打印时自动隐藏

## 使用指南

### iPad 全屏使用

1. 用 Safari 打开页面
2. 点击「分享」按钮 → 「添加到主屏幕」
3. 主屏幕图标以 standalone 模式启动（无浏览器导航栏）

### 局域网访问

在同一 WiFi 下的 iPad/手机可通过局域网地址访问：

```bash
cd hanzi-learn
npm run dev:lan      # 开发模式（0.0.0.0）
npm run start:lan    # 生产模式（0.0.0.0）
# 或使用 lan.js（会打印本机与局域网地址）
node lan.js
```

## Docker 构建与部署

项目提供了一套 Docker 构建方案，适用于 x86_64 (amd64) 服务器。

### 版本机制

镜像构建时自动携带版本信息，来源优先级如下：

1. `build.sh` 第二个参数显式指定（如 `bash scripts/build.sh hanzi-learn 1.2.0`）
2. 最近的 git tag（如 `v1.0.0` → 版本 `1.0.0`）
3. `package.json` 的 `version` 字段

**一致性校验**：当版本自动取自 git tag 时，构建前会校验当前 `HEAD` 与 tag 指向的 commit
是否一致。若打 tag 之后又有新提交，构建会被拒绝并提示：

- 先为当前代码打新 tag：`bash scripts/tag.sh`（推荐）
- 或显式指定版本构建：`bash scripts/build.sh hanzi-learn <版本号>`
- 或强制构建（版本自动附加 commit 距离，如 `1.0.0-1-g779accd`，保证版本↔commit 唯一对应）：
  `ALLOW_DIRTY=1 bash scripts/build.sh`

版本信息会体现在三个地方：

| 位置       | 形式                                                                    |
| ---------- | ----------------------------------------------------------------------- |
| 镜像 tag   | `hanzi-learn:1.2.0` + `hanzi-learn:latest`                              |
| 导出文件名 | `hanzi-learn-image-1.2.0.tar`                                           |
| 镜像内部   | OCI LABEL + `APP_VERSION`/`GIT_COMMIT` 环境变量 + `public/version.json` |

通过 `docker inspect` 可查看镜像内嵌的版本元数据：

```bash
docker inspect hanzi-learn:1.2.0 --format '{{index .Config.Labels "org.opencontainers.image.version"}}'
```

### 版本管理（git tag）

```bash
cd hanzi-learn

bash scripts/tag.sh            # 基于 package.json 版本自动 +1 patch 并打 tag
bash scripts/tag.sh 1.1.0      # 指定版本打 tag
bash scripts/tag.sh 1.1.0 -m "新功能发布"  # 带注释
npm run tag                    # 等价于 bash scripts/tag.sh
```

打 tag 时会自动同步 `package.json` 的版本号（如不一致）；工作区有未提交改动时会二次确认。

### 构建镜像

```bash
cd hanzi-learn

# 方式一：使用构建脚本（导出 tar 包，版本取自最近 git tag）
bash scripts/build.sh

# 指定镜像名 / 版本
bash scripts/build.sh hanzi-learn 1.2.0

# 需要走代理时（可选；不设置则直连 registry.npmjs.org）
export HTTP_PROXY=http://127.0.0.1:7890
bash scripts/build.sh

# 方式二：通过 npm script
npm run docker:build

# 方式三：手动构建（版本信息缺省为 0.0.0-dev）
docker build \
  --build-arg APP_VERSION=1.0.0 \
  --build-arg GIT_COMMIT=$(git rev-parse --short HEAD) \
  --platform linux/amd64 \
  -t hanzi-learn:1.0.0 .

# 手动构建 + 代理（代理在本机时；host.docker.internal 需要 --add-host 才能在原生 Linux 解析）
docker build \
  --add-host host.docker.internal:host-gateway \
  --build-arg HTTP_PROXY=http://host.docker.internal:7890 \
  --build-arg HTTPS_PROXY=http://host.docker.internal:7890 \
  --build-arg APP_VERSION=1.0.0 \
  --build-arg GIT_COMMIT=$(git rev-parse --short HEAD) \
  --platform linux/amd64 \
  -t hanzi-learn:1.0.0 .
```

> 代理为**可选项**：脚本默认直连 registry。曾经写死的 `host.docker.internal:7890` 在原生 Linux 的
> `docker build` 里解析不到，会导致 `npm ci` 失败（且 npm 10 可能打印 error 却返回 0，直到
> `next build` 才报 `next: not found`），现已改为按需启用。

构建完成后会在 `hanzi-learn/` 目录生成带版本号的 tar 包，如 `hanzi-learn-image-1.3.1.tar`。
`.dockerignore` 已排除 `node_modules`、`.next`、`data`、`env`、`coverage` 与导出的 tar，避免构建上下文爆涨。

> 已知项：runner 阶段直接复制 builder 的全部 `node_modules`（含 vitest/eslint 等 devDeps），
> 镜像偏大，后续可 `npm prune --omit=dev` 裁剪。

### 数据持久化

学习数据按类别存在服务端三个文件：`data/config.json`（配置）、`data/stats.json`（统计与权重进度）、
`data/banks.json`（字库定义与启停）。本地开发在 `hanzi-learn/data/`，Docker 内为 `/app/data/`，
换浏览器/设备不丢失。Docker 部署时通过 volume 挂载持久化：

```yaml
volumes:
  - ./env:/app/env:ro
  - ./data:/app/data
```

> 升级到该版本时：旧的 `data/state.json` 自动迁移为三份文件并保留 `state.json.v1.bak` 备份；
> 老用户浏览器里的 localStorage 数据会在打开应用后自动迁移到服务端。
> 打印配置（字体/字号等）属设备偏好，仍保存在浏览器本地。
>
> 回滚到旧版本前，请用 `state.json.v1.bak` 覆盖回 `state.json`、删除三份新文件，并清空浏览器 localStorage
> （v2 文件对旧代码不兼容）。

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
#    tar 包位置: hanzi-learn/hanzi-learn-image-<版本>.tar
scp hanzi-learn/hanzi-learn-image-1.2.0.tar hanzi-learn/env user@server:/path/

# 2. 服务器上加载镜像并运行
docker load -i hanzi-learn-image-1.2.0.tar
docker run -d \
  --name hanzi-learn \
  -v $(pwd)/env:/app/env:ro \
  -v $(pwd)/data:/app/data \
  -p 3000:3000 \
  --restart unless-stopped \
  hanzi-learn:1.2.0
```

## 相关文档

| 文档                                         | 内容                                            |
| -------------------------------------------- | ----------------------------------------------- |
| [AGENTS.md](AGENTS.md)                       | AI agent 协作规范：架构约定、编码规范、质量门槛 |
| [docs/known-issues.md](docs/known-issues.md) | 已知问题、残余风险与后续优化清单                |
