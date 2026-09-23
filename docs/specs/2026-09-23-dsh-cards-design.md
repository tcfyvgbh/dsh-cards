# dsh-cards 设计文档

日期：2026-09-23
状态：待审阅

## 1. 背景与目标

现有的生成式 UI 插件（`@changfenhuang/dsh-genui`）通过监视 DOM 找到标签为 `dsh-ui` 的代码块再接管渲染。DSH 在 `8d2cd0cf72` 改版代码块卡片后，不支持高亮的语言标签统一显示为"代码块"，插件因此失效（omdsh-dev/dsh-genui#204）。

**核心目标**：做一个只依赖 DSH 公开契约的展示型卡片插件，DSH 升级时无需跟着改动。

**成功标准**：见第 8 节验收清单。关键一条是：撤掉本地 `CodeToolbar.tsx` 补丁后仍能正常渲染。

**非目标（第一版不做）**：交互回传模型、ECharts、Mermaid、图片、链接、自定义颜色、流式逐步渲染。

## 2. 总体方案

模型调用工具 `render_cards`，参数是一份 JSON 界面描述（spec）。

- **宿主端**：注册工具，校验 spec，并注入使用说明（system prompt section）。
- **浏览器端**：在 keyed slot `tool.call.toolview` 上注册 key `render_cards`，把这个工具的调用渲染成卡片。

**依赖的公开契约**（仅三处）：

| 契约 | 文档 |
|---|---|
| `ctx.tools.register`（接受原生 JSON Schema 工具） | `docs/cookbook/adding-a-tool.md`, `docs/cookbook/extension-cookbook.md` |
| keyed slot `tool.call.toolview` | `packages/client/ui-tool/README.md`, `docs/subsystems/slots.md` |
| `ctx.systemPrompt.section` | `docs/subsystems/system-prompt.md` |

**唯一的非公开依赖**：浏览器端包的 lazy-CJS factory 格式。官方文档说明第三方包没有打包预设，因此由本项目复刻，并用测试锁定（见第 6、7 节）。

**已知代价**：
- 卡片以工具卡片的形式出现在回复流中。
- 参数完整之后卡片才出现。
- 每次渲染多一次工具调用，大约慢 1 到 2 秒。

## 3. 组件协议

根结构：`{ "title"?: string, "items": Node[] }`

| 类别 | type | 字段 |
|---|---|---|
| 布局 | `row` | `items: Node[]`（横排，自动换行） |
| 布局 | `grid` | `cols: 1-4`, `items: Node[]` |
| 布局 | `card` | `title?: string`, `items: Node[]` |
| 文字 | `text` | `text: string`, `variant?: "h2" \| "h3" \| "body" \| "muted"`（默认 body） |
| 文字 | `callout` | `tone: "info" \| "success" \| "warning" \| "error"`, `title?: string`, `content: string` |
| 文字 | `list` | `items: string[]`, `ordered?: boolean` |
| 文字 | `keyvalue` | `pairs: { key: string, value: string \| number }[]` |
| 文字 | `badge` | `text: string`, `tone?: "neutral" \| "info" \| "success" \| "warning" \| "error"` |
| 指标 | `stat` | `label: string`, `value: string \| number`, `delta?: string`, `spark?: number[]`, `better?: "up" \| "down"`（默认 up） |
| 表格 | `table` | `columns: string[]`, `rows: (string \| number)[][]`, `types?: ("text" \| "num" \| "bar" \| "badge")[]`, `sortable?: boolean`（默认 true） |
| 图表 | `chart` | `kind: "line" \| "bar" \| "donut"`, `title?: string`, `labels: string[]`, `series: { name: string, data: number[] }[]` |

**字段语义**：
- `stat.delta` 以 `+` 开头表示上升，以 `-` 或 `−` 开头表示下降。颜色由 `better` 决定：与 `better` 同向为绿色，反向为红色。
- `table.types[i] = "bar"`：单元格的值解析成 0 到 100 的百分比，显示为进度条。`"badge"`：值显示为胶囊标签。
- `chart.series[*].data` 的长度必须等于 `labels` 的长度。`donut` 只使用 `series[0]`。

**文字规则**：所有字符串按纯文本渲染，只识别两种行内格式：`` `code` `` 和 `**bold**`。不解析 HTML，不解析其他 Markdown。

**上限**（超出即判为校验失败，不做截断）：
- 嵌套深度不超过 4
- 节点总数不超过 200
- 表格行数不超过 200，列数不超过 12
- 图表数据系列不超过 6，每个系列不超过 100 个点
- 单个字符串不超过 2000 字符

**校验规则**：
- 未知的 `type`、缺少必填字段、类型错误、枚举值非法、各项上限，都会报错。
- 未知字段会被忽略，不报错。
- 每条错误的格式都是"路径: 说明"，例如 `items[2].rows[3]: 列数应为 7，实际 6`。

## 4. 宿主端

- **包名** `dsh-cards`，**工具名** `render_cards`，**Cordis 插件名** `dsh-cards`。
- **工具参数**：`spec`，类型为 object。如果收到的是字符串，先做 `JSON.parse`；解析失败按校验失败处理。
- **execute 行为**：
  - 校验通过：返回 `{ "ok": true, "nodes": <节点数> }`。
  - 校验失败：抛出 Error，消息中列出前 10 条错误（格式为"路径: 说明"），并附一句"请修正后重新调用 render_cards"。
- **工具 description**：一两句话说明用途，并引导模型参考提示词中的"卡片"一节。
- **提示词段落**（`ctx.systemPrompt.section`，使用数字 order）：约 40 行，包含以下内容：
  - 适用场景：任务汇总、看板、方案对比、结构化数据。
  - 不适用场景：简单问答、纯解释、代码。
  - 组件速查表。
  - 一个完整示例。
- **配置**：`guidance: boolean`，默认 true。为 false 时不注入提示词，工具照常注册。插件卸载时撤销提示词段落和工具注册。
- **不使用 `presentationMeta`**：浏览器端直接从调用参数解析 spec。

## 5. 浏览器端

- **注册**：`apply(ctx)` 中执行 `ctx.slots.inject('tool.call.toolview', () => ctx.slots.register({ name: 'tool.call.toolview', key: 'render_cards' }, CardsView))`，只 inject `slots`。模块顶层没有副作用。
- **CardsView 状态**（依据 `block`，`'kind' in block` 表示已有结果）：

| 状态 | 判定 | 显示 |
|---|---|---|
| 运行中 | 无 `kind` | 解析 `argsRaw` 并通过校验后直接渲染；否则显示占位骨架 |
| 成功 | 有 `kind` 且 `isError` 为假 | 渲染 |
| 校验失败 | `isError` 且非中断 | 折叠为一行"界面描述有误，模型正在修正"，展开后显示错误文本 |
| 中断 | `error.code === 'interrupted'` | 能解析就渲染，否则显示"已中断" |
| 数据缺失 | 已有结果但 `call` 为 null（会话窗口截断） | 显示"卡片数据已不在当前会话窗口中" |

- **渲染**：递归的 `renderNode` 按 `type` 分发，每个组件一个文件。浏览器端会再次运行共享的校验模块，不合法的 spec 不进入渲染。
- **表格排序**：点击表头，在"升序 → 降序 → 原序"之间循环。排序键的取法：去掉千分位逗号后，取第一个数字；取不到数字的按字符串比较。
- **图表**：纯 SVG，宽度 100%，使用 viewBox 自适应。悬停时由 `<title>` 显示数值。6 色分类色板，深浅主题各一套。
- **样式**：在 `apply` 时注入 `<style data-plugin="dsh-cards">`，dispose 时移除。颜色优先引用宿主主题的 CSS 变量（具体变量名在实现阶段从 DSH 源码确认），取不到时回退到 `prefers-color-scheme`。所有类名加 `dshc-` 前缀。
- **容错**：每张卡片外包一层 ErrorBoundary。渲染异常时显示"渲染失败"，并附上折叠的原始 JSON。
- **依赖**：运行时只依赖宿主提供的 React。浏览器端包体积小于 40 KB。

## 6. 工程结构与打包

```
dsh-cards/
  package.json          name, exports "." -> lib/index.js, "./client" -> lib/client.js,
                        dsh.bundle.patch, dsh.client.platform = "web"
  cordis.patch.yml      - insert: [ { id: dsh-cards, name: dsh-cards } ]
  src/index.ts          宿主端 apply
  src/prompt.ts         提示词正文
  src/spec/             校验模块（纯 TS，无 DSH 依赖）
  src/client/           浏览器端：index.tsx, CardsView.tsx, nodes/*.tsx, styles.ts
  build/client.ts       浏览器端打包 + factory 包装
  tests/
```

**依赖策略**：
- `peerDependencies` 只有 `@deepseek-ai/cordis ^4`。
- DSH 各个包仅以 `import type` 使用，放在 devDependencies。
- 不在运行时 import `@deepseek-ai/dsh-tools`。
- 目的：避免带预发布后缀的版本号（如 `0.1.6-alpha.2`）不满足 peer 范围的问题。

**构建**：
- 宿主端：tsdown 输出 `lib/index.js`。
- 浏览器端：打包为 CJS，`react`、`react/jsx-runtime`、`@deepseek-ai/cordis` 设为外部依赖，外面包一层 `window.__ModuleLoader__.load({ id, factory(require) })`，输出 `lib/client.js`。包装格式以 DSH 的 `packages/client/tsdown.client.ts` 和 `apps/web/tests/fixtures/plugins/fixture-live-client/` 为准。
- `lib/` 不入库。

**Mac 安装**：

```sh
git clone <repo> ~/dsh-cards && cd ~/dsh-cards && pnpm install && pnpm build
cd <deepseek-harness> && pnpm dsh plugin --profile web add link:$HOME/dsh-cards
pnpm dsh web   # 重启后硬刷新浏览器，并新开对话
```

建议在验收通过后卸载 `@changfenhuang/dsh-genui`，避免两份 UI 提示词同时注入。

## 7. 测试

**自动化测试**（vitest）：

| 层 | 覆盖 |
|---|---|
| 校验模块 | 每个组件的合法与非法用例；错误路径的准确性；各项上限；spec 以字符串形式传入 |
| 宿主端 | 假 ctx：工具注册；ok 返回；失败时抛出带路径的错误；`guidance` 开关；dispose 撤销 |
| 浏览器组件 | jsdom 渲染每个组件；CardsView 四种状态；表格数值排序（`"8,420"`、`"412 ms"`、`"4.80%"`）；ErrorBoundary 兜底 |
| 构建产物 | 用假的 `__ModuleLoader__` 加载 `lib/client.js`，执行 `apply` 后确认注册了 key `render_cards` |

**本机端到端测试**（不调用模型）：
- **真实宿主加载**：使用本机 DSH 源码和一个临时 `DSH_HOME`，以 `link:` 方式安装插件，启动 `dsh web`。验证三点：`--dump-config` 中有 `dsh-cards` 这一行；宿主启动时没有与插件相关的报错；无头 Chrome 打开页面后，控制台打印 `[dsh-cards] client active`。
- **真实产物渲染**：使用独立的测试页面 `tests/e2e/harness.html`，在真实 Chrome 中通过模拟的 `__ModuleLoader__` 加载构建产物 `lib/client.js`，配合 React 18 UMD 渲染一份构造的 `render_cards` 调用数据，截图后人工检查。
- 不在真实会话中注入数据。官方的回放桩 `dsh-llm-replay` 接入成本过高，这一环节由 Mac 上的真实模型验收覆盖。

## 8. 验收清单（在 Mac 上用真实模型）

1. 撤掉 `CodeToolbar.tsx` 本地补丁并重新构建 DSH。
2. 新对话中发送"用卡片展示一个服务状态看板"：卡片渲染成功；回复结束后不回退；刷新页面后仍在。
3. 发送"用一个 pie 图表"：模型收到带路径的错误，自行修正后渲染成功。
4. 切换深色和浅色主题：卡片颜色随之变化。
5. 打开包含旧插件卡片或损坏数据的历史会话：页面不崩溃。

## 9. 风险

| 风险 | 应对 |
|---|---|
| 宿主改变浏览器端 factory 格式 | 由构建产物测试锁定；失败时对照 DSH 最新的 `tsdown.client.ts` 更新 |
| 宿主改变 `tool.call.toolview` 的 props 结构 | 只使用 `block` 的最小字段（`argsRaw`、`kind`、`isError`、`error.code`），并做防御式解析 |
| 模型不主动使用卡片 | 提示词写明适用场景；用户也可以明确要求"用卡片展示" |
