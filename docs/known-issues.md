# 已知问题与后续优化清单

> 来源：各轮代码审查（2026-08-01 测试与 Lint 基础设施、2026-08-13 代码审查、2026-09-09 优化轮）。
> 未修复项全部非阻塞，按优先级分组，供后续排期处理。

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

| 位置                                        | 说明                                                                                        |
| ------------------------------------------- | ------------------------------------------------------------------------------------------- |
| `src/lib/pinyin.ts` level2 注释字（40+ 个） | 日后启用时需补拼音——`pinyin.test.ts` 的完整性测试会兜住                                     |
| `src/lib/pinyin.ts` 分区内排序              | 存在既有宽松模式（如 马 mǎ 在 妈 mā 前），非本次引入                                        |
| `StudyStats.weeklyCalls`                    | 字段仍在写入但看板已改用 history 计算（近 7 天），属存量字段；删除需迁移 state.json，收益低 |
| `GenerateRequest.helpers` / `bankHelpers`   | 通用助字功能的遗留字段，当前无任何读写路径；可在下次数据迁移时一并清理                      |
| `src/hooks/useIdleTimeout.ts`               | 已实现且有单测，但当前无调用方（预留给"长时间无操作回首页"）；若不打算用可删除              |

## 四、运维注意

| 项                     | 说明                                                                                                                                                      |
| ---------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Node 版本              | jsdom 29 / vitest 4 要求 Node ≥20.19（本机 24.10 ✅）；Docker `node:20-alpine` 需解析到 ≥20.19，否则 engine 失败                                          |
| Vite configLoader 警告 | `configLoader: 'native'`（ESM 语法在 CJS 配置中加载）为纯警告；未来 Vite 大版本可能要求 `vitest.config.*` 改 `.mts` 或 package.json 加 `"type": "module"` |
| Prettier 升级          | 格式化依赖 prettier 3.x + eslint-config-prettier 10；升级 prettier 4.x 后需重跑 `format:check`                                                            |
| format:check 门禁      | `npm run check` 不含 format:check；提交前可加跑 `npm run format:check`（新代码用 `prettier --write` 保持风格）                                            |
| 现场调试日志           | 生产默认静默。需排查时用 `NEXT_PUBLIC_DEBUG=1 npm run build` 重新构建（客户端值构建期内联）；服务端另有 `DEBUG_PROMPT=1` 打印完整 Prompt                  |

## 五、后续可优化（评估后暂不做）

| 项                      | 现状与收益                                                                                                           |
| ----------------------- | -------------------------------------------------------------------------------------------------------------------- |
| 看板图表懒加载 recharts | `/parent/dashboard` 首屏 221 kB（recharts 约 97 kB）。改 `next/dynamic` 可降到 ~128 kB，但家长页访问频率低，收益有限 |
| 字库数据精简            | `wordBanks.ts` level2 有 40+ 个被注释掉的汉字；启用时需同步补 `pinyin.ts` 与 `frequency.ts`                          |
| `docker-compose` 挂载   | 当前 state.json 依赖 volume 挂载；若改用命名 volume 可避免宿主目录权限问题                                           |
