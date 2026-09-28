# 已知问题与后续优化清单

> 来源：各轮代码审查（2026-08-01 测试与 Lint 基础设施、2026-08-13 代码审查、2026-09-09 优化轮、
> 2026-09-28 文档梳理）。未修复项全部非阻塞，按优先级分组，供后续排期处理。

## 已修复（2026-09-28，字库内容维护轮）

家长此前只能整库启用/禁用，无法维护字库里的具体汉字。新增字库内容维护页（`/parent/banks?bank=<id>`，
设置页每张卡片「📝 内容」进入），支持添加 / 删除 / 禁用汉字。

| 项                     | 修复内容                                                                                                                                                                                                                          |
| ---------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 无逐字维护入口         | 新增 `src/app/parent/banks/page.tsx`：概览（共/生效/已禁用）、批量添加、单字禁用/启用、单字删除、全部启用/禁用、按状态筛选；设置页卡片加「📝 内容」入口与生效/禁用字数 |
| 禁用状态无处存放       | `BankRecord.disabledChars`（`chars` 保留完整定义）；新增 `getActiveChars()` 作为唯一"用字"出口，生成 / 打印 / 综合合并 / 卡片字数全部改走它                                                            |
| 内置字可被误删         | `isBuiltinChar()`（`origin: builtin` 且出现在 `lib/seed/builtinBanks.ts` 默认值里）判定内置字：只能禁用不能删除；家长新增到内置字库的字可以删除；纯函数层再兜一次（`rejected`）                            |
| 新增内容会被升级冲掉   | 给内置字库补充新字时置 `customized: true`，E3 升级补种不再覆盖该条目；仅禁用汉字不改内容，因此不置 `customized`，仍可接收升级（`disabledChars` 在补种时保留）                                        |
| 空字库会导致生成异常   | `MIN_ACTIVE_CHARS = 1`：禁用/删除到 0 个生效字时纯函数整批拒绝，UI 提示「至少要保留 1 个生效的汉字」                                                                                                                  |
| 内容维护后同步判据不足 | `hasUserData()` 增加 `disabledChars` 与内置条目 `customized` 判据，避免"只维护过内容"的设备在首次迁移时被判为无用户数据而丢改动                                                                        |

**行为说明（非缺陷）**：字库内容一旦变化（添加/删除/禁用任一），该字库的权重进度会在下次进入时整体重新初始化
（`useWeightEngine` 按字库内容比对），与原来编辑自定义字库的行为一致。

本轮核对结论（可复现的事实）：

| 项         | 结论                                                                                              |
| ---------- | ------------------------------------------------------------------------------------------------- |
| 新增纯函数 | `isHanziChar` / `extractHanziChars` / `normalizeDisabledChars` / `getActiveChars` / `getDisabledChars` / `getBuiltinCharSet` / `isBuiltinChar` / `addBankChars` / `removeBankChars` / `setBankCharsEnabled` |
| 测试规模   | 38 个测试文件、325 个用例；`npm run check` 全绿（覆盖率 90% stmts / 83.26% branch）              |

本轮新发现（未修，非阻塞）：

| 项                             | 说明                                                                                                                                                  | 建议                                                                                          |
| ------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------- |
| 内置字库补充后失去升级         | 给内置字库加过字（`customized: true`）后，该字库不再接收后续 seed 的新增/改名                                                                      | 若要"新增 + 升级"共存，需把家长新增字单独存 `addedChars`，并让 `reconcileBanks` 按 seed ∪ added − disabled 合并 |
| 逐字操作无多选批量             | 删除/禁用只能单字点按或"全部"，没有多选                                                                                                              | iPad 触摸场景够用；需要时加长按多选                                                            |
| 内容维护页未纳入覆盖率统计     | `vitest.config.ts` 的 coverage include 只含 `src/app/api/**`，页面组件不计入门槛                                                                   | 页面测试已补齐行为用例；若要强制门槛，可把 `src/app/**` 纳入并按需下调阈值                    |

## 已修复（本轮，数据分区 v2 重构）

把"单文件混装"改成按类别分区的三个文件，并让数据（而不是代码常量）成为字库的唯一来源。

| 项                           | 修复内容                                                                                                                                                                                                                                            |
| ---------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 单文件混装                   | `data/state.json` 拆为三份：`config.json`（配置类）/ `stats.json`（统计类，含权重进度 `progress`）/ `banks.json`（词库类）；每份带 `schemaVersion`，写放大与重置粒度都按分区隔离                                                                    |
| 内置字库不是数据源           | 内置字库由 `lib/wordBanks.ts`（运行时常量）迁为 `lib/seed/builtinBanks.ts`（**初始化默认值**），启动钩子 `src/instrumentation.ts` 把默认值写入 `banks.json`；四个消费点改用 `useBanks()`。代码常量退出运行路径，ESLint `no-restricted-imports` 兜底 |
| 内置字库无升级路径           | 新增 `seedRevision`（人工）+ `seedFingerprint`（内容指纹，防忘记升级号）双触发；只更新 `origin:"builtin"` 且未被家长改过的条目，`custom` / `customized` 永不覆盖                                                                                    |
| 启停语义绕                   | 淘汰 `enabledBanks` "空数组 = 全部启用" 的约定，改为 `banks.json` 每条 `enabled`；设置页的"先展开全部 id 再移除"技巧一并删除                                                                                                                        |
| **权重重置会被同步拉回**     | 服务端 `stats.progress` 按 bankId 合并，"权重重置"写空对象后被合并逻辑吃掉，下次同步又拉回旧进度。新增 `progressMode: "replace"`（客户端 `replaceWeightData`）显式整体替换                                                                          |
| 离线改动可能被服务端旧值覆盖 | 同步改为**先推后拉**；推送失败（离线 / 5xx）重新入队；`online` 事件与下次同步时重推                                                                                                                                                                 |
| 跨设备改字库不生效           | `StateSync` 增加 `visibilitychange` / `focus` 触发（iPad 从后台切回不重挂载页面）；`/api/state` 返回分区时间戳，客户端只覆盖服务端更新的那份                                                                                                        |
| 死字段                       | 删除 `config.bankHelpers`（迁移时丢弃）、`GenerateRequest.helpers`、`GenerateRequest` 与 `ParentConfig` 类型                                                                                                                                        |
| 删除自定义字库留孤儿进度     | 设置页删除自定义字库时联动清理 `stats.progress[bankId]`                                                                                                                                                                                             |

**接口 / 配置变化**：不新增 API 路由（沿用 `/api/state`，GET 顺带完成初始化与升级补种，PUT 收 `{ config?, stats?, banks?, progress? }`）；
新增环境变量 `STATE_DIR`，旧 `STATE_FILE` 保留兼容（取其所在目录）。升级时旧 `data/state.json` 自动迁移为三份并保留 `state.json.v1.bak`。

本轮核对结论（可复现的事实）：

| 项         | 结论                                                                                                            |
| ---------- | --------------------------------------------------------------------------------------------------------------- |
| 服务端数据 | 三个分区文件，原子写（临时文件 + rename）；`stats.progress` 按 bankId 合并，`progressMode:"replace"` 时整体替换 |
| 内置字库   | `lib/seed/builtinBanks.ts`，一级 60 字 + 二级 10 字；初始化后写入 `banks.json`，代码不再是运行时来源            |
| 客户端镜像 | `hanzi_parent_config` / `hanzi_study_stats`（含 progress）/ `hanzi_banks`；v1 缓存首次读取时自动迁移            |
| 测试规模   | 36 个测试文件、287 个用例；`npm run check` 全绿                                                                 |

本轮新发现（未修，非阻塞）：

| 项                       | 说明                                                                                                                                                                  | 建议                                                                                                |
| ------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------- |
| 服务端数据被清空后不回灌 | 首次迁移只在"本地有用户数据 + 服务端没有用户数据"时执行一次（标记 `hanzi_state_synced_v2`）；若之后服务端文件被手工清空，已同步过的设备不会自动回灌（与 v1 行为一致） | 误删时把浏览器镜像手工 PUT 回 `/api/state`，或删掉 localStorage 里的 `hanzi_state_synced_v2` 后刷新 |
| 多设备同时改同一分区     | 仍是按分区粒度的 last-write-wins（分区比 v1 的整文件更小，冲突面已缩小）                                                                                              | 家庭场景可接受；需要更细粒度可给每类字段加独立时间戳                                                |
| stats 写放大             | 每次生成仍整文件重写 `stats.json`（≤200 条历史 + 权重）                                                                                                               | 当前规模（几十 KB）可接受                                                                           |

## 已修复（2026-09-28，文档梳理轮）

对照源码逐项核对了 `README.md` 与 `AGENTS.md`，修正以下漂移（纯文档改动，无代码变更）：

| 项                      | 修复内容                                                                                                                                                                           |
| ----------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 声称存在「内置句池」    | README/AGENTS 均写「无 Key 时 fallback 内置句池」，但代码里没有句池：`/api/generate` 与前端只做单字直示（`pickFallbackChar` 取权重最大的字）。已改为准确描述                       |
| 二级字库描述过时        | 写作「二级（预留扩展）」，实际已启用 10 字（雨伞闪电干根土皮枝森），另有 80 字以注释预留。README 已写明数量                                                                        |
| README 结构树不完整     | 缺 `generationRules.ts`、`stateSync.ts`、`date.ts`、`debug.ts`、`shared/StateSync.tsx`、`public/sw.js`、`scripts/generate-icons.js` 等；已按实际文件补全并补充 `src/test/setup.ts` |
| 环境变量表缺项          | 补 `NEXT_PUBLIC_DEBUG`（构建期内联）与 `DEBUG_PROMPT`，并给全表补「默认」列与默认值                                                                                                |
| AGENTS 引用不存在的目录 | 原文写 docs/superpowers/ 下的 specs / plans 目录，但该目录不存在且被 docs/.gitignore 忽略。已改为准确描述（本地草稿目录，按需创建）                                                |
| lib 覆盖率门槛不准      | AGENTS 写 `test:lib` ≥80%，实际 `vitest.lib.config.ts` 的 branches 门槛是 **75%**。已分别写明 lines/functions/statements 与 branches                                               |
| 状态管理描述不全        | 原「全部通过 localStorage 持久化」漏了 `data/state.json` + `StateSync` 的跨设备同步链路。已补全 `storage.ts` / `stateSync.ts` / `stateStore.ts` 的分工                             |
| 版本徽标示例过时        | 示例仍是 `v1.1.0 · 5629311`，已更新为当前 `v1.2.0` 形态                                                                                                                            |
| 缺 PWA/离线说明         | 补 Service Worker 行为（导航网络优先、静态缓存优先）与「首访需刷新一次」的注意事项                                                                                                 |
| 缺运行前提与质量细节    | 补 Node ≥ 20.19、`npm run check` 不含 `format:check`、35 个测试文件、API 端点表、打印配置不同步等                                                                                  |

本轮核对结论（可复现的事实）：

| 项           | 结论                                                                                                                                                                                                                                        |
| ------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 内置字库字数 | 一级 60 字、二级启用 10 字，合计 70 个互不重复的启用字                                                                                                                                                                                      |
| 拼音覆盖     | `pinyin.ts` 共 189 条，覆盖全部 70 个启用字（无缺漏）                                                                                                                                                                                       |
| 环境变量     | 源码实际读取：`DEEPSEEK_API_KEY`、`DEEPSEEK_MODEL`、`DEEPSEEK_MODEL_CACHE_MS`、`DEEPSEEK_MODEL_TIMEOUT_MS`、`DEEPSEEK_TIMEOUT_MS`、`DEEPSEEK_RETRY_BASE_MS`、`STATE_FILE`、`NEXT_PUBLIC_DEBUG`、`DEBUG_PROMPT`、`APP_VERSION`、`GIT_COMMIT` |
| 直示阈值     | `MAX_WEIGHT = 20` 且距上次直示 ≥ `DIRECT_SHOW_GAP = 3` 轮                                                                                                                                                                                   |
| API 路由     | 只有 `generate` / `model` / `state` 三个，且均无鉴权                                                                                                                                                                                        |
| 服务端状态   | `data/state.json` 原子写（临时文件 + rename），`weightData` 按 bankId 合并；`STATE_FILE` 可覆盖路径                                                                                                                                         |
| 测试规模     | 35 个测试文件、233 个用例（`src/**/*.test.ts(x)`）                                                                                                                                                                                          |
| 质量门禁     | `npm run check` 全绿（typecheck + lint + 233 用例）；全项目覆盖率 88.2% stmts / 79.07% branch（门槛 60/50）；`test:lib` 95.82% / 88.51%（门槛 80/75）；`format:check` 通过                                                                  |

本轮新发现（未修，非阻塞）：

| 项                      | 说明                                                                                                | 建议                                                                                  |
| ----------------------- | --------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------- |
| `frequency.ts` 覆盖不全 | 启用字中 29/70 未登记字频，按 Tier 3 只印 1 份（如 虫、车、圆、二~十 等）                           | 如果打印份数不符合预期，补登记这些字的 Tier；或明确接受默认 Tier 3                    |
| 本机 npm 缓存权限       | ~/.npm/_cacache 含 root 属主文件，首次 npm ci 报 EACCES 失败；改用 npm ci --cache <可写目录> 后正常 | 长期可 sudo chown -R $(id -u):$(id -g) ~/.npm 修复；CI/容器内不受影响，一次性环境问题 |

## 已修复（2026-09-09，优化轮）

| 项                             | 修复内容                                                                                                                                                                                           |
| ------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 结果页「再来一句」延迟失效     | `ResultState` 把 `useState(() => {...})` 当 effect 用：初始化器返回值（cleanup）被当成 state 且恒为真值 → 800ms 防抢点失效、卸载后定时器仍在跑。改为 `useEffect` + 延迟前 `disabled`（布局不跳动） |
| 设置页「全部启用」误关其他字库 | `enabledBanks` 为空数组 = 全部启用，但 `toggleBank` 直接 push 被点的 id → 点一张卡会把其他字库全部关掉。改为先展开全部 id 再移除，并在恢复全选时归一化回空数组                                     |
| 字库卡片嵌套 `<button>`        | `WordBankPicker` 打印按钮嵌在卡片按钮内（非法 HTML，浏览器会重排 DOM 导致点击区域错乱）。改为兄弟节点 + 独立 `aria-label`                                                                          |
| 生产日志刷屏                   | 新增 `lib/debug.ts`（`NEXT_PUBLIC_DEBUG=1` 开启）：洗牌不再逐字拼字符串并逐行 `console.log`（60 字库 = 60+ 行/次），权重明细/请求参数改为调试级；异常走 `logError` 始终输出                        |
| 启动同步无意义回写             | `stateSync` 把服务端数据写回 localStorage 时会再触发一次 PUT（同一份数据）。新增 `withSuppressedServerSync` 抑制该次回写                                                                           |
| 生成校验链不可单测             | 5 条规则从 `/api/generate` 重试循环（约 120 行）抽到 `lib/generationRules.ts` 纯函数，新增 13 个单测；路由只负责调用与回传纠错提示                                                                 |
| 手动模型冷缓存阻塞生成         | `isModelAvailable` 原来每次都 `await` 上游模型列表（冷/过期缓存最长 8s）。改为有缓存（哪怕过期）立即判定、后台刷新，仅冷启动才等待                                                                 |
| 打印染色 O(n²)                 | `PrintCards` 每张卡都做一次 `uniqueChars.indexOf`；改为一次性建表，分页与拼音取值也改为 memo/单次调用                                                                                              |
| AGENTS.md API 路由表述         | 已同步为 generate / model / state 三个路由（本次核对确认无残留）                                                                                                                                   |
| 看板「累计句子」会饱和         | `sentenceHistory` 只保留最近 200 条，用它的长度当"累计句子"长期会卡在 200。改为「已学汉字」（`charUsage` 键数，不截断）                                                                            |

## 已修复（2026-08-13，代码审查轮）

| 项                   | 修复内容                                                                                                  |
| -------------------- | --------------------------------------------------------------------------------------------------------- |
| PWA 图标缺失         | 新增 scripts/generate-icons.js（零依赖 PNG 生成），补齐 icon-192 / icon-512 / apple-touch-icon            |
| 无 Service Worker    | 新增 public/sw.js（导航网络优先 + 静态缓存优先），layout 生产环境自动注册                                 |
| UTC 日期错位         | 新增 src/lib/date.ts 的 localDateString()，useStats 与看板改用本地日期                                    |
| 看板“本周”为累计值   | 改为从 history 计算近 7 天，不再展示从未清零的 weeklyCalls                                                |
| 自定义字库无法打印   | /print 在内置字库找不到时补查 loadConfig().customBanks                                                    |
| 生成请求无取消/防重  | 句子页加 AbortController + 请求序号丢弃过期响应 + 防重入；15s 超时同时取消在途请求                        |
| DeepSeek 无超时/退避 | 路由加请求超时（默认 12s，env DEEPSEEK_TIMEOUT_MS 可覆盖）+ 指数退避（env DEEPSEEK_RETRY_BASE_MS 可覆盖） |

> 说明：PWA 首次访问后需刷新一次完成 SW 安装；离线仅缓存应用壳，AI 生成仍需网络。

## 一、安全（残余风险，需升级解决）

| 项                     | 说明                                                                                           | 处理建议                                                                    |
| ---------------------- | ---------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------- |
| npm audit 5 high       | next 14.2.35（SSRF / Server Function 端点泄露）+ 内嵌 postcss 8.4.31（XSS / 任意文件读）+ glob | 均为存量/传递依赖，修复需 next 16 破坏性升级；建议升级 Next 时一次性处理    |
| Docker 镜像体积        | runner 阶段复制全部 node_modules（含 vitest/eslint/jsdom 等 devDeps）                          | 后续可 `npm prune --omit=dev` 或改用多阶段构建裁剪                          |
| API 无鉴权（局域网内） | `/api/state`（可读写家长密码/模型配置）与 `/api/generate`（可消耗 DeepSeek 额度）均无鉴权      | 家庭内网可接受；若要暴露公网，建议加一个共享 token（env 注入 + 请求头校验） |
| 家长密码默认 `1234`    | `PasswordGate` 的"首次设置密码"分支因默认密码非空而不可达，等于固定默认口令                    | 可将默认密码改为空串以激活首次设置流程，或改为首次进入强制设置              |

## 二、测试加固（可选，均有说明原因）

| 位置                                           | 问题                                                                                                            | 建议                                                                          |
| ---------------------------------------------- | --------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------- |
| `src/lib/storage.test.ts` "无待同步块" 用例    | fetch spy 未 mock 实现，依赖 beforeEach 排空 pendingBlocks 防真实网络                                           | 改为 `mockResolvedValue` 作防御（若排空逻辑被移除，用例会先发真实请求再失败） |
| `src/lib/storage.test.ts` describe 间          | 经 beforeEach 排空隐式耦合模块级 pendingBlocks                                                                  | 长期可改 describe1 的 afterEach 排空                                          |
| `src/hooks/useWeightEngine.test.ts` reset 用例 | reset 后置断言 `小=1` 冗余、注释有误导（真正守护是前置 getWeightData()）                                        | 可把断言移到 update 与 reset 之间改为 `大=2`                                  |
| `src/components/child/ResultState.test.tsx`    | 点击选择器 `getAllByText('小')[0]` 依赖 DOM 顺序（句子区先于已用字区）                                          | 可改用 `within(句子容器)` 加固                                                |
| `src/components/child/PrintCards.test.tsx`     | `printSpy.mockRestore()` 仅断言通过时执行                                                                       | 可改 afterEach 统一恢复                                                       |
| `src/app/api/generate/route.test.ts`           | 多处 `vi.stubGlobal('fetch', ... as never)` 削弱类型；无 Key 用例用 `level1` 而 AI 用例用 `bank-a~f` 约定不统一 | 前者纯观感；后者建议加注释，防未来用例撞模块级 `recentSentences` 历史去重     |
| `src/lib/validator.test.ts` 越界字用例         | 输入 `'小猫真好'` 只含 1 个越界字，去重逻辑未被该用例真正触发                                                   | 可补 `'真好真'` 式输入                                                        |
| `src/lib/frequency.test.ts`                    | 用例名"保序"但未断言顺序（实现保序）                                                                            | 如需可补顺序断言                                                              |
| `src/lib/soundEngine.test.ts`                  | AudioContext mock 未覆盖引擎未来可能新增的 API（如 createDynamicsCompressor / setTargetAtTime）                 | 引擎新增 API 时同步扩展 mock                                                  |
| `src/lib/debug.test.ts`                        | 开启分支依赖 `vi.stubEnv` + `resetModules` 重新加载模块                                                         | 若未来 debug 开关改成运行时读取，此用例需同步调整                             |

## 三、代码/文档残留

| 位置                                       | 说明                                                                                        |
| ------------------------------------------ | ------------------------------------------------------------------------------------------- |
| `src/lib/pinyin.ts` level2 注释字（80 个） | 日后启用时需补拼音——`pinyin.test.ts` 的完整性测试会兜住                                     |
| `src/lib/pinyin.ts` 分区内排序             | 存在既有宽松模式（如 马 mǎ 在 妈 mā 前），非本次引入                                        |
| `StudyStats.weeklyCalls`                   | 字段仍在写入但看板已改用 history 计算（近 7 天），属存量字段；删除需迁移 state.json，收益低 |
| `GenerateRequest.helpers` / `bankHelpers`  | 通用助字功能的遗留字段，当前无任何读写路径；可在下次数据迁移时一并清理                      |
| `src/hooks/useIdleTimeout.ts`              | 已实现且有单测，但当前无调用方（预留给"长时间无操作回首页"）；若不打算用可删除              |

## 四、运维注意

| 项                     | 说明                                                                                                                                                      |
| ---------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Node 版本              | jsdom 29 / vitest 4 要求 Node ≥20.19（本机 24.14 ✅）；Docker `node:20-alpine` 需解析到 ≥20.19，否则 engine 失败                                          |
| Vite configLoader 警告 | `configLoader: 'native'`（ESM 语法在 CJS 配置中加载）为纯警告；未来 Vite 大版本可能要求 `vitest.config.*` 改 `.mts` 或 package.json 加 `"type": "module"` |
| Prettier 升级          | 格式化依赖 prettier 3.x + eslint-config-prettier 10；升级 prettier 4.x 后需重跑 `format:check`                                                            |
| format:check 门禁      | `npm run check` 不含 format:check；提交前可加跑 `npm run format:check`（新代码用 `prettier --write` 保持风格）                                            |
| 现场调试日志           | 生产默认静默。需排查时用 `NEXT_PUBLIC_DEBUG=1 npm run build` 重新构建（客户端值构建期内联）；服务端另有 `DEBUG_PROMPT=1` 打印完整 Prompt                  |

## 五、后续可优化（评估后暂不做）

| 项                      | 现状与收益                                                                                                           |
| ----------------------- | -------------------------------------------------------------------------------------------------------------------- |
| 看板图表懒加载 recharts | `/parent/dashboard` 首屏 221 kB（recharts 约 97 kB）。改 `next/dynamic` 可降到 ~128 kB，但家长页访问频率低，收益有限 |
| 字库数据精简            | `wordBanks.ts` level2 有 80 个被注释掉的汉字；启用时需同步补 `pinyin.ts` 与 `frequency.ts`                           |
| `docker-compose` 挂载   | 当前 state.json 依赖 volume 挂载；若改用命名 volume 可避免宿主目录权限问题                                           |
