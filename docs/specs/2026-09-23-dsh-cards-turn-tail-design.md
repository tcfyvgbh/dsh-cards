# dsh-cards 回复末尾卡片设计文档

日期：2026-09-23
状态：待审阅
前置：`docs/specs/2026-09-23-dsh-cards-design.md`（v1，已实现）

## 1. 背景与目标

v1 通过 keyed slot `tool.call.toolview` 渲染 `render_cards` 的调用。在当前 DSH web 里，所有工具调用都会被放进"已调用工具"这个过程分组：

- 过程分组默认折叠，用户只能看到"已用环形饼图展示……"这类文字，看不到卡片本身；
- 展开后分组有最大高度，卡片会被截断，要在里面滚动才能看全；
- 把"工作过程展示"设成"完全展开"也解决不了截断。

**目标**：卡片完整地显示在回复里，不需要展开过程区，也不会被截断。

**已确认的前提**（用户已同意）：

1. 每一轮回复的末尾只显示**最后一次成功**的卡片。
2. 过程区里对应的那张卡片缩成一行提示，避免同一张卡片出现两次。
3. 生成过程中，卡片仍在过程区正常显示；这一轮结束后，完整卡片出现在末尾。
4. 打开历史会话时，末尾卡片同样要显示。

**非目标**：交互回传；一轮末尾显示多张卡片；改动 DSH 的分组行为；修改宿主端（工具和提示词保持不变）。

## 2. 依据的宿主契约与事实

结论依据 deepseek-harness 本地 HEAD（0.1.6-alpha.2）和 origin/master（ui-chat 0.1.7-alpha.2），两者一致。

| 事实 | 出处 |
|---|---|
| `ctx.uiConversation.events.register(definition)` 是公开扩展点，官方文档给出了第三方插件示例（`inject = ['uiConversation', 'slots']`） | `docs/subsystems/conversation.md` |
| Definition 类型为 `ConversationNodeDefinition<State>`，字段有 `kind`、`target?`、`match`、`start`、`update`、`publication?`、`buildLocationData?`、`buildViewNode?`。不声明 `target` 时只产出数据。`kind` 必须唯一，重复注册会抛错 | `packages/client/ui-conversation/src/client/contract/conversation.ts`；`conversation/event-registry.ts` |
| `events.register` 自己管理生命周期，插件卸载时会自动注销 | 研究结论（`definition-registry.ts`），实现时再核实一次 |
| 每一轮的数据通过 `TurnLocation.data.get(key)` 读取 | `contract/conversation.ts` |
| 同类实现：`ui-deliverables` 用这套机制展示 `present` 工具的交付物 | `packages/client/ui-deliverables/src/client/turn-deliverables.ts`、`index.ts` |
| `tool/call.data` 为 `{ turn, step, callId, name, arguments }`，其中 `arguments` 是原始 JSON 字符串 | `packages/core/session/src/types.ts` |
| `tool/result.data` 为 `{ turn, step, message, error?, meta? }`，`message` 带 `isError?` 和 `source.callId`，但不带工具名 | 同上；`packages/llm/llm/src/message.ts` |
| 替换副本的 `surfaceOp !== 'append'`，这类事件应跳过 | `packages/core/session/src/surface.ts` |
| turnTail 只在出现 `turn/end` 的那一轮渲染，位置在过程分组之外、消息操作图标之上 | `ui-chat/src/client/conversation-nodes/turn-tail.ts`；`process-groups.ts`（`INDEPENDENT`）；`chat/TurnTailNodeView.tsx` |
| turnTail 组件收到的 owner 字段 `{ turn, seq, openFile }` 平铺在 props 上 | 研究结论，实现时用测试锁定 |
| 打开会话、重新同步、补洞时，DSH 会用已加载窗口内的事件重建数据；注册 Definition 本身也会触发一次重建 | `docs/subsystems/conversation.md`；`conversation/assembly.ts` |
| 没有让某个工具退出过程分组的开关；分组定义每个 target 只能注册一个，而 chat 已经被 ui-chat 占用 | `process-activity.ts`；`process-groups.ts`；`group-registry.ts` |

## 3. 设计

### 3.1 收集数据：`src/client/turn-cards.ts`

注册一个只产出数据的 Definition：`kind: 'dsh-cards'`，不声明 `target`。

```ts
export interface TurnCard { readonly callId: string; readonly seq: number; readonly spec: Spec }
export interface TurnCardsData { readonly cards: readonly TurnCard[] }
interface TurnCardsState extends TurnCardsData {
  readonly turn: number
  /** callId -> spec，只记录参数有效的 render_cards 调用 */
  readonly calls: ReadonlyMap<string, Spec>
}
```

事件和 Context 都用本地的结构化类型来描述，只声明实际用到的字段。

| 回调 | 行为 |
|---|---|
| `match` | `turn/start` 返回 `{ id: String(turn), role: 'start' }`；`tool/call`，以及 `surfaceOp === 'append'` 的 `tool/result`，返回 `{ id: String(turn), role: 'update' }`；其他事件返回 `null` |
| `start` | 返回 `{ turn, calls: new Map(), cards: [] }` |
| `update`（`tool/call`） | `name` 不是 `render_cards` 时原样返回；否则解析 `arguments`，把其中的 `spec` 交给 `parseSpecInput` 校验。校验通过时，复制一份 `calls` 并写入这次调用；解析失败或校验不通过，则原样返回 |
| `update`（`tool/result`） | `message.isError === true` 时原样返回；否则用 `message.source.callId` 去 `calls` 里查，查到就返回一个追加了 `{ callId, seq, spec }` 的新 `cards` |
| `buildLocationData` | 只在 `scope === 'turn'` 且 `cards` 不为空时，返回 `{ kind: 'turn', turn, key: 'dsh-cards', value: { cards } }`；如果 `previous` 的 `cards` 引用没有变，就直接返回 `previous`，保持引用稳定 |

要点：

- `tool/result` 里没有工具名，所以不能在 `match` 阶段过滤，只能在 `update` 里用 callId 表来过滤。`ui-deliverables` 也是这么做的。
- 全程不可变更新：复制 Map、展开数组。
- 从 `CardsView.tsx` 里把 `specFromArgs` 抽出来，放到 `src/spec/`，toolview 和 Definition 两处共用。
- `publication` 以宿主类型为准；如果是可选字段，就不声明。

### 3.2 共享登记：`src/client/shown-cards.ts`

这是插件内部的一个很小的外部 store，记录"哪些调用已经在末尾显示了"。

- `markShown(callId): () => void`：登记这个 callId，返回撤销函数。内部用引用计数，全部撤销后才真正移除。
- `isShown(callId): boolean` 和 `subscribe(listener): () => void`：给 `useSyncExternalStore` 用。
- 每次更新都替换成新的 Map 实例，不修改旧实例。

### 3.3 末尾卡片：`src/client/TurnCardsTail.tsx`

- 读取 `props.turn.data.get('dsh-cards')`。`get` 的返回值当作 `unknown` 处理，先经过 `readTurnCards` 做结构检查，形状不符时当作没有数据。
- 取 `cards` 的**最后一项**。每一轮只有一个末尾区域，所以不用 `owner.seq` 过滤：模型在最后一段文字之后才调用的卡片，也应该显示出来。
- 用 `<section className="dshc-tail">` 包住 `CardErrorBoundary`，里面是 `CardsBody`，复用现有样式。
- 挂载时对这张卡片的 callId 调用 `markShown`，卸载时撤销。在 `useEffect` 里做，依赖项是 callId。
- 没有数据时返回 `null`。

### 3.4 过程区收起：修改 `src/client/CardsView.tsx`

- callId 从 `block.callId` 取；`RunningToolCall` 和 `ToolResultNode` 都有这个字段。
- 用 `useSyncExternalStore(subscribe, () => isShown(callId))` 订阅登记状态。
- 状态为 `render` 且 callId 已经登记时，只渲染一行 `<div className="dshc-root dshc-note">已生成卡片，见本轮回复末尾</div>`。其他情况和 v1 一样。

### 3.5 浏览器端入口：修改 `src/client/index.ts`

- 顶层 `inject` 保持 `['slots']`，v1 的 toolview 注册也不变。
- 末尾卡片相关的部分，放在 `ctx.inject(['uiConversation'], (scoped) => { ... })` 里注册，只有宿主提供 `uiConversation` 时才生效：
  - `scoped.uiConversation.events.register(turnCardsDefinition)`：由它自己管理生命周期，不再用 `effect` 包；
  - `scoped.slots.register({ name: 'conversation.chat.turnTail', id: 'dsh-cards' }, TurnCardsTail)`，注入方式和 v1 的 toolview 相同。
- `ctx.inject` 的回调签名，以本地 DSH 源码中客户端插件的实际用法为准，实现前先查。
- 运行时不 import 任何 `@deepseek-ai/dsh-*` 包，宿主服务只用结构化类型声明。

## 4. 兼容与退化

- 宿主没有 `uiConversation` 时（比如更老的 DSH），末尾卡片不会注册，插件保持 v1 的行为。因为顶层 `inject` 不包含 `uiConversation`，这不会影响整个插件被激活。
- 如果某一轮的 `turn/start` 不在已加载的窗口里，这一轮就没有数据，也不渲染末尾卡片，过程区保留完整卡片，和 v1 一样。
- 末尾卡片渲染出错时，由 ErrorBoundary 兜底。这时过程区已经缩成一行，但兜底提示里仍然能看到原始 JSON。

## 5. 测试（先写测试）

| 对象 | 用例 |
|---|---|
| turn-cards 定义 | `match`：各类事件返回的 id 和 role；替换副本返回 `null`。`update`：非 `render_cards` 的调用被忽略；参数无效的调用被忽略；错误结果不进入列表；先失败再成功，只留下成功的那张；多次成功按 seq 追加；不修改传入的 state。`buildLocationData`：非 turn scope 或列表为空时返回 `null`；数据没变时返回同一个 `previous` |
| shown-cards | 登记、撤销、引用计数、订阅通知 |
| TurnCardsTail | 只渲染最后一张；没有数据或形状不对时渲染为空；挂载时登记，卸载时撤销 |
| CardsView | callId 已登记时显示一行提示；未登记时显示完整卡片；登记状态变化时立即切换 |
| 浏览器端入口 | 有 `uiConversation` 时，注册 toolview、turnTail 和 Definition；没有时只注册 toolview |
| 构建产物 | 在 v1 产物测试的基础上，确认新注册行为；包仍然小于 40 KB |

**本机端到端**：在本机的真实 DSH 里确认两端都能加载，控制台打印出 `[dsh-cards] client active`，并且没有与 `uiConversation` 相关的报错。

**Mac 验收**（真实模型）：
1. 发"用卡片展示一个服务状态看板"：这一轮结束后，卡片完整显示在回复末尾；过程区里对应的调用只剩一行提示。
2. 刷新页面后，结果和第 1 步一样。
3. 生成过程中展开过程区，能看到完整卡片。

## 6. 风险

| 风险 | 应对 |
|---|---|
| Definition 或 location data 的接口仍在快速演进 | 只用结构化类型，读取时做运行时形状检查；形状不对就不渲染末尾卡片，不影响 toolview |
| turnTail 的 owner props 形状发生变化 | 用测试锁定读取路径；读不到 `turn` 时返回 `null` |
| 同一个 callId 在多个视图中挂载 | shown-cards 使用引用计数 |
| `kind` 或 slot `id` 与其他插件冲突 | 统一使用 `PLUGIN_ID`（`dsh-cards`） |
