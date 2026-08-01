# 已知问题与后续优化清单

> 来源：「测试与 Lint 基础设施」实施（2026-08-01，分支 testing-lint-infra 合并 commit 153bbaa）
> 这些是实施过程中审查发现、经裁决后**未在本次修复**的遗留项。全部非阻塞，
> 按优先级分组，供后续排期处理。

## 一、安全（残余风险，需升级解决）

| 项 | 说明 | 处理建议 |
|----|------|---------|
| npm audit 5 high | next 14.2.35（SSRF / Server Function 端点泄露）+ 内嵌 postcss 8.4.31（XSS / 任意文件读）+ glob | 均为存量/传递依赖，修复需 next 16 破坏性升级；建议升级 Next 时一次性处理 |
| Docker 镜像体积 | runner 阶段复制全部 node_modules（含 vitest/eslint/jsdom 等 devDeps） | 后续可 `npm prune --omit=dev` 或改用多阶段构建裁剪 |

## 二、测试加固（可选，均有说明原因）

| 位置 | 问题 | 建议 |
|------|------|------|
| `src/lib/storage.test.ts` "无待同步块" 用例 | fetch spy 未 mock 实现，依赖 beforeEach 排空 pendingBlocks 防真实网络 | 改为 `mockResolvedValue` 作防御（若排空逻辑被移除，用例会先发真实请求再失败） |
| `src/lib/storage.test.ts` describe 间 | 经 beforeEach 排空隐式耦合模块级 pendingBlocks | 长期可改 describe1 的 afterEach 排空 |
| `src/hooks/useWeightEngine.test.ts` reset 用例 | reset 后置断言 `小=1` 冗余、注释有误导（真正守护是前置 getWeightData()） | 可把断言移到 update 与 reset 之间改为 `大=2` |
| `src/components/child/ResultState.test.tsx` | 点击选择器 `getAllByText('小')[0]` 依赖 DOM 顺序（句子区先于已用字区） | 可改用 `within(句子容器)` 加固 |
| `src/components/child/PrintCards.test.tsx` | `printSpy.mockRestore()` 仅断言通过时执行 | 可改 afterEach 统一恢复 |
| `src/app/api/generate/route.test.ts` | 多处 `vi.stubGlobal('fetch', ... as never)` 削弱类型；无 Key 用例用 `level1` 而 AI 用例用 `bank-a~f` 约定不统一 | 前者纯观感；后者建议加注释，防未来用例撞模块级 `recentSentences` 历史去重 |
| `src/lib/validator.test.ts` 越界字用例 | 输入 `'小猫真好'` 只含 1 个越界字，去重逻辑未被该用例真正触发 | 可补 `'真好真'` 式输入 |
| `src/lib/frequency.test.ts` | 用例名"保序"但未断言顺序（实现保序） | 如需可补顺序断言 |
| `src/lib/soundEngine.test.ts` | AudioContext mock 未覆盖引擎未来可能新增的 API（如 createDynamicsCompressor / setTargetAtTime） | 引擎新增 API 时同步扩展 mock |

## 三、代码/文档残留（非本分支引入）

| 位置 | 说明 |
|------|------|
| `src/components/child/ResultState.tsx:33-35` | `useState(() => {...})` 当 effect 用：初始化器返回的 cleanup 被 React 忽略，800ms 定时器不清理（基线既有问题，测试未受影响） |
| AGENTS.md「API 路由仅在 src/app/api/generate 存在」 | 与实际不符（state/route.ts 已存在），存量表述 |
| `src/lib/pinyin.ts` level2 注释字（40+ 个） | 日后启用时需补拼音——`pinyin.test.ts` 的完整性测试会兜住 |
| `src/lib/pinyin.ts` 分区内排序 | 存在既有宽松模式（如 马 mǎ 在 妈 mā 前），非本次引入 |

## 四、运维注意

| 项 | 说明 |
|----|------|
| Node 版本 | jsdom 29 / vitest 4 要求 Node ≥20.19（本机 24.10 ✅）；Docker `node:20-alpine` 需解析到 ≥20.19，否则 engine 失败 |
| Vite configLoader 警告 | `configLoader: 'native'`（ESM 语法在 CJS 配置中加载）为纯警告；未来 Vite 大版本可能要求 `vitest.config.*` 改 `.mts` 或 package.json 加 `"type": "module"` |
| Prettier 升级 | 格式化依赖 prettier 3.x + eslint-config-prettier 10；升级 prettier 4.x 后需重跑 `format:check` |
| format:check 门禁 | `npm run check` 不含 format:check；提交前可加跑 `npm run format:check`（新代码用 `prettier --write` 保持风格） |
