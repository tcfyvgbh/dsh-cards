# dsh-cards Turn-Tail Cards Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 每一轮回复结束后，把这一轮最后一次成功调用的 `render_cards` 卡片完整显示在回复末尾，也就是过程分组之外；同时把过程区里对应的那张卡片缩成一行提示。

**Architecture:**
- **收集数据**：注册一个只产出数据的 Conversation Definition（`kind: 'dsh-cards'`），从会话事件中收集每一轮成功的卡片，发布到 `TurnLocation.data`。
- **末尾渲染**：list slot `conversation.chat.turnTail` 上的组件读取这份数据，渲染最后一张卡片，并在插件内部的共享 store 中登记它的 callId。
- **过程区收起**：toolview 订阅这个 store，发现自己的 callId 已登记时，就缩成一行提示。
- **可选注册**：以上三部分都通过 `ctx.inject(['slots', 'uiConversation'], ...)` 注册。宿主没有 `uiConversation` 时，插件保持 v1 的行为。

**Tech Stack:** 与 v1 相同，即 TypeScript 6、React 18（宿主提供）、tsdown 0.22、vitest 4、jsdom 29、@testing-library/react 16。

**Spec:** `docs/specs/2026-09-23-dsh-cards-turn-tail-design.md`（前置：`docs/specs/2026-09-23-dsh-cards-design.md`）

## Global Constraints

- Definition `kind` 和 location data key 都是 `dsh-cards`；turnTail slot 注册的 `id` 是 `dsh-cards`（取值为 `PLUGIN_ID`）。
- 顶层 `inject` 保持 `['slots']`；只在 `ctx.inject(['slots', 'uiConversation'], ...)` 的回调里注册 Definition 和 turnTail。
- 运行时不 import `@deepseek-ai/dsh-*`，宿主的类型和事件只用结构化类型描述。
- 过程区的提示文案固定为 `已生成卡片，见本轮回复末尾`。
- 每一轮末尾只显示最后一张成功的卡片，不用 `owner.seq` 过滤。
- 判断工具结果是否失败时，`message.isError === true` 或 `message.content[0].isError === true` 任一成立即视为失败；只处理 `surfaceOp === 'append'` 的 `tool/result`。
- 保持不可变风格：只替换 Map、Set、数组的实例，不修改原实例。代码和文档里不用 emoji；单个文件不超过 400 行。
- 浏览器端产物小于 40 KB。`tests/artifact.test.ts` 对包装格式的断言保持不变。
- 提交信息使用 Conventional Commits。

## Review Focus

1. **错误标记只在 `message.content[0].isError` 上**（本地 HEAD 0.1.6 的结构）：这样的结果不能进入末尾卡片。测试在 Task 2。
2. **同一个 callId 被两个末尾组件同时登记**（重复挂载、热重载）：只要还有一个没撤销，过程区就保持收起；两个都撤销后才恢复。测试在 Task 3。
3. **末尾组件卸载**（切换会话、插件卸载）：过程区恢复成完整卡片。测试在 Task 4。
4. **宿主没有 `uiConversation`**：只注册 v1 的 toolview，不抛错。测试在 Task 6。
5. **`turn.data.get` 抛异常，或返回的数据形状不对**：末尾不渲染，页面不崩溃。测试在 Task 4。

---

## File Structure

```
src/spec/args.ts                   specFromArgs：解析原始参数 JSON 并校验 spec（新建，从 CardsView 抽出）
src/client/turn-cards.ts           Conversation Definition（新建）
src/client/shown-cards.ts          已在末尾显示的 callId 登记 store（新建）
src/client/TurnCardsTail.tsx       turnTail 组件（新建）
src/client/CardsView.tsx           改用 specFromArgs；登记后收起（修改）
src/client/index.ts                可选注册 Definition 和 turnTail（修改）
src/client/styles.ts               新增 .dshc-tail（修改）
tests/spec-args.test.ts            新建
tests/turn-cards.test.ts           新建
tests/shown-cards.test.ts          新建
tests/client-tail.test.tsx         新建
tests/client-view.test.tsx         新增收起用例，改写入口用例（修改）
tests/artifact.test.ts             假 ctx 增加 inject（修改）
README.md                          说明末尾卡片（修改）
```

---

### Task 1: 抽出 `specFromArgs`

**Files:**
- Create: `src/spec/args.ts`
- Modify: `src/client/CardsView.tsx`（删掉本地的 `specFromArgs`，改为 import）
- Test: `tests/spec-args.test.ts`

**Interfaces:**
- Consumes: `parseSpecInput`、`ValidationResult`（`src/spec/validate.ts`）；`isRecord`（`src/spec/check.ts`）
- Produces: `specFromArgs(argsRaw: unknown): ValidationResult | undefined`。原始 JSON 无法解析或输入不是字符串时返回 `undefined`。

- [ ] **Step 1: 写失败的测试**

`tests/spec-args.test.ts`：

```ts
import { describe, expect, it } from 'vitest'
import { specFromArgs } from '../src/spec/args.ts'

describe('specFromArgs', () => {
  it('parses and validates the spec inside raw tool arguments', () => {
    const result = specFromArgs(JSON.stringify({ spec: { items: [{ type: 'text', text: 'a' }] } }))
    expect(result).toEqual({ ok: true, spec: { items: [{ type: 'text', text: 'a' }] }, nodes: 1 })
  })

  it('returns undefined for non-strings and unreadable JSON', () => {
    expect(specFromArgs(undefined)).toBeUndefined()
    expect(specFromArgs({ spec: {} })).toBeUndefined()
    expect(specFromArgs('{"spec":')).toBeUndefined()
  })

  it('reports a missing or invalid spec as a failed validation', () => {
    const result = specFromArgs('{}')
    expect(result?.ok).toBe(false)
  })
})
```

- [ ] **Step 2: 运行测试，确认失败**

Run: `pnpm vitest run tests/spec-args.test.ts`
Expected: FAIL，报错 `Cannot find module '../src/spec/args.ts'`。

- [ ] **Step 3: 实现，并让 CardsView 改用它**

`src/spec/args.ts`：

```ts
import { isRecord } from './check.ts'
import { parseSpecInput, type ValidationResult } from './validate.ts'

/**
 * Parse a raw tool-arguments JSON string and validate its `spec`.
 * @returns undefined when the input is not a string or the JSON is unreadable.
 */
export function specFromArgs(argsRaw: unknown): ValidationResult | undefined {
  if (typeof argsRaw !== 'string') return undefined
  try {
    const args: unknown = JSON.parse(argsRaw)
    return parseSpecInput(isRecord(args) ? args.spec : undefined)
  } catch {
    return undefined
  }
}
```

修改 `src/client/CardsView.tsx`：
1. 删掉整个本地的 `function specFromArgs(...) { ... }`。
2. 把

```ts
import { formatErrors, parseSpecInput, type ValidationResult } from '../spec/validate.ts'
```

改为

```ts
import { specFromArgs } from '../spec/args.ts'
import { formatErrors } from '../spec/validate.ts'
```

- [ ] **Step 4: 跑全量测试和类型检查**

Run: `pnpm vitest run && pnpm typecheck`
Expected: 全部 PASS。`tests/client-view.test.tsx` 中原有的 `deriveViewState` 用例继续通过，这证明重构没有改变行为。

- [ ] **Step 5: 提交**

```bash
git add -A && git commit -m "refactor: extract specFromArgs into the spec module"
```

---

### Task 2: Conversation Definition

**Files:**
- Create: `src/client/turn-cards.ts`
- Test: `tests/turn-cards.test.ts`

**Interfaces:**
- Consumes: `specFromArgs`（Task 1）、`isRecord`、`TOOL_NAME`、`Spec`
- Produces: `TURN_CARDS_KEY = 'dsh-cards'`、`TurnCard { callId: string; seq: number; spec: Spec }`、`TurnCardsData { cards: readonly TurnCard[] }`、`TurnCardsState`、`turnCardsDefinition`（包含 `kind`、`match`、`start`、`update`、`buildLocationData`）

- [ ] **Step 1: 写失败的测试**

`tests/turn-cards.test.ts`：

```ts
import { describe, expect, it } from 'vitest'
import { TURN_CARDS_KEY, turnCardsDefinition, type TurnCardsState } from '../src/client/turn-cards.ts'

const SPEC = { items: [{ type: 'text', text: 'a' }] }
const turnStart = { type: 'turn/start', seq: 1, data: { turn: 3 } }
const call = (callId: string, name = 'render_cards', spec: unknown = SPEC) => ({
  type: 'tool/call', seq: 2, data: { turn: 3, step: 1, callId, name, arguments: JSON.stringify({ spec }) },
})
const result = (callId: string, seq: number, extra: Record<string, unknown> = {}, surfaceOp = 'append') => ({
  type: 'tool/result', seq, surfaceOp,
  data: { turn: 3, step: 1, message: { role: 'tool', source: { kind: 'tool', callId }, content: [{ type: 'text', text: 'ok' }], ...extra } },
})

function run(events: readonly { readonly type: string }[]): TurnCardsState {
  const initial = turnCardsDefinition.start({}, { event: turnStart })
  return events.reduce(
    (state, event) => turnCardsDefinition.update({ state }, { event }),
    initial,
  )
}

describe('turnCardsDefinition.match', () => {
  it('keys turn/start, tool/call and appended tool/result by turn', () => {
    expect(turnCardsDefinition.kind).toBe('dsh-cards')
    expect(turnCardsDefinition.match(turnStart)).toEqual({ id: '3', role: 'start' })
    expect(turnCardsDefinition.match(call('c1'))).toEqual({ id: '3', role: 'update' })
    expect(turnCardsDefinition.match(result('c1', 5))).toEqual({ id: '3', role: 'update' })
  })

  it('ignores replacement copies and unrelated events', () => {
    expect(turnCardsDefinition.match(result('c1', 5, {}, 'replace'))).toBeNull()
    expect(turnCardsDefinition.match({ type: 'turn/end', seq: 9, data: { turn: 3 } })).toBeNull()
    expect(turnCardsDefinition.match({ type: 'tool/call', seq: 2, data: {} })).toBeNull()
  })
})

describe('turnCardsDefinition.update', () => {
  it('records a successful render_cards call as a card', () => {
    expect(run([call('c1'), result('c1', 5)]).cards).toEqual([{ callId: 'c1', seq: 5, spec: SPEC }])
  })

  it('ignores other tools and invalid specs', () => {
    expect(run([call('c1', 'read_file'), result('c1', 5)]).cards).toEqual([])
    expect(run([call('c1', 'render_cards', { items: [] }), result('c1', 5)]).cards).toEqual([])
  })

  it('skips failed results flagged on the message or on content[0] (Review Focus 1)', () => {
    expect(run([call('c1'), result('c1', 5, { isError: true })]).cards).toEqual([])
    expect(run([call('c1'), result('c1', 5, { content: [{ type: 'text', text: 'bad', isError: true }] })]).cards).toEqual([])
  })

  it('keeps only the corrected retry after a failure and appends later successes in order', () => {
    const state = run([
      call('c1'), result('c1', 5, { isError: true }),
      call('c2'), result('c2', 7),
      call('c3'), result('c3', 9),
    ])
    expect(state.cards.map(card => card.callId)).toEqual(['c2', 'c3'])
  })

  it('does not mutate the previous state', () => {
    const before = run([call('c1')])
    const callsBefore = before.calls
    const after = turnCardsDefinition.update({ state: before }, { event: result('c1', 5) })
    expect(before.cards).toEqual([])
    expect(before.calls).toBe(callsBefore)
    expect(after).not.toBe(before)
  })
})

describe('turnCardsDefinition.buildLocationData', () => {
  it('publishes turn data only when there are cards', () => {
    const empty = run([])
    expect(turnCardsDefinition.buildLocationData({ state: empty }, 'turn', null)).toBeNull()
    const state = run([call('c1'), result('c1', 5)])
    expect(turnCardsDefinition.buildLocationData({ state }, 'step', null)).toBeNull()
    expect(turnCardsDefinition.buildLocationData({ state }, 'turn', null))
      .toEqual({ kind: 'turn', turn: 3, key: TURN_CARDS_KEY, value: { cards: state.cards } })
  })

  it('returns the previous value while the cards are unchanged', () => {
    const state = run([call('c1'), result('c1', 5)])
    const first = turnCardsDefinition.buildLocationData({ state }, 'turn', null)
    expect(turnCardsDefinition.buildLocationData({ state }, 'turn', first)).toBe(first)
  })
})
```

- [ ] **Step 2: 运行测试，确认失败**

Run: `pnpm vitest run tests/turn-cards.test.ts`
Expected: FAIL，报错 `Cannot find module '../src/client/turn-cards.ts'`。

- [ ] **Step 3: 实现**

`src/client/turn-cards.ts`：

```ts
import { TOOL_NAME } from '../constants.ts'
import { specFromArgs } from '../spec/args.ts'
import { isRecord } from '../spec/check.ts'
import type { Spec } from '../spec/types.ts'

export const TURN_CARDS_KIND = 'dsh-cards'
export const TURN_CARDS_KEY = 'dsh-cards'

/** One successful render_cards result in a turn. */
export interface TurnCard { readonly callId: string; readonly seq: number; readonly spec: Spec }

/** Value published at TurnLocation.data.get('dsh-cards'). */
export interface TurnCardsData { readonly cards: readonly TurnCard[] }

export interface TurnCardsState extends TurnCardsData {
  readonly turn: number
  /** callId -> validated spec, for render_cards calls with valid arguments only. */
  readonly calls: ReadonlyMap<string, Spec>
}

/**
 * Structural subset of DSH session events and Definition contexts, per
 * packages/client/ui-conversation/src/client/contract/conversation.ts.
 */
interface EventLike { readonly type: string; readonly seq?: number; readonly surfaceOp?: unknown; readonly data?: unknown }
interface MatchLike { readonly event: EventLike }
interface ContextLike { readonly state?: TurnCardsState }
interface TurnLocationDataLike { readonly kind: 'turn'; readonly turn: number; readonly key: string; readonly value: TurnCardsData }

function turnOf(event: EventLike): number | undefined {
  return isRecord(event.data) && typeof event.data.turn === 'number' ? event.data.turn : undefined
}

/** HEAD 0.1.6 flags failures on content[0]; newer hosts may flag the message itself. */
function isErrorResult(message: Readonly<Record<string, unknown>>): boolean {
  if (message.isError === true) return true
  const first: unknown = Array.isArray(message.content) ? message.content[0] : undefined
  return isRecord(first) && first.isError === true
}

/** State-only Definition (no view target) collecting successful render_cards results per turn. */
export const turnCardsDefinition = {
  kind: TURN_CARDS_KIND,

  match(event: EventLike): { readonly id: string; readonly role: 'start' | 'update' } | null {
    const turn = turnOf(event)
    if (turn === undefined) return null
    if (event.type === 'turn/start') return { id: String(turn), role: 'start' }
    if (event.type === 'tool/call') return { id: String(turn), role: 'update' }
    if (event.type === 'tool/result' && event.surfaceOp === 'append') return { id: String(turn), role: 'update' }
    return null
  },

  start(_context: unknown, match: MatchLike): TurnCardsState {
    return { turn: turnOf(match.event) ?? 0, calls: new Map(), cards: [] }
  },

  update(context: ContextLike & { readonly state: TurnCardsState }, match: MatchLike): TurnCardsState {
    const { state } = context
    const { event } = match
    if (!isRecord(event.data)) return state
    if (event.type === 'tool/call') {
      if (event.data.name !== TOOL_NAME || event.data.callId === undefined) return state
      const parsed = specFromArgs(event.data.arguments)
      if (parsed?.ok !== true) return state
      return { ...state, calls: new Map([...state.calls, [String(event.data.callId), parsed.spec]]) }
    }
    if (event.type !== 'tool/result' || typeof event.seq !== 'number') return state
    const message = event.data.message
    if (!isRecord(message) || isErrorResult(message)) return state
    const source = message.source
    if (!isRecord(source) || source.callId === undefined) return state
    const callId = String(source.callId)
    const spec = state.calls.get(callId)
    return spec === undefined ? state : { ...state, cards: [...state.cards, { callId, seq: event.seq, spec }] }
  },

  buildLocationData(context: ContextLike, scope: string, previous: unknown): TurnLocationDataLike | null {
    const state = context.state
    if (scope !== 'turn' || state === undefined || state.cards.length === 0) return null
    if (isRecord(previous) && previous.kind === 'turn' && previous.turn === state.turn
      && previous.key === TURN_CARDS_KEY && isRecord(previous.value) && previous.value.cards === state.cards) {
      return previous as unknown as TurnLocationDataLike
    }
    return { kind: 'turn', turn: state.turn, key: TURN_CARDS_KEY, value: { cards: state.cards } }
  },
}
```

- [ ] **Step 4: 运行测试，确认通过；再做类型检查**

Run: `pnpm vitest run && pnpm typecheck`
Expected: 全部 PASS。

- [ ] **Step 5: 提交**

```bash
git add -A && git commit -m "feat: collect successful render_cards results per turn"
```

---

### Task 3: 已显示登记 store

**Files:**
- Create: `src/client/shown-cards.ts`
- Test: `tests/shown-cards.test.ts`

**Interfaces:**
- Produces: `markShown(callId: string): () => void`、`isShown(callId: string): boolean`、`subscribe(listener: () => void): () => void`

- [ ] **Step 1: 写失败的测试**

`tests/shown-cards.test.ts`：

```ts
import { describe, expect, it, vi } from 'vitest'
import { isShown, markShown, subscribe } from '../src/client/shown-cards.ts'

describe('shown-cards', () => {
  it('marks and releases a call id and notifies subscribers', () => {
    const listener = vi.fn()
    const unsubscribe = subscribe(listener)
    const release = markShown('s-1')
    expect(isShown('s-1')).toBe(true)
    release()
    expect(isShown('s-1')).toBe(false)
    expect(listener).toHaveBeenCalledTimes(2)
    unsubscribe()
    markShown('s-1')()
    expect(listener).toHaveBeenCalledTimes(2)
  })

  it('reference-counts duplicate marks (Review Focus 2)', () => {
    const first = markShown('s-2')
    const second = markShown('s-2')
    first()
    expect(isShown('s-2')).toBe(true)
    second()
    expect(isShown('s-2')).toBe(false)
  })

  it('ignores a second call of the same release function', () => {
    const keep = markShown('s-3')
    const release = markShown('s-3')
    release()
    release()
    expect(isShown('s-3')).toBe(true)
    keep()
    expect(isShown('s-3')).toBe(false)
  })
})
```

- [ ] **Step 2: 运行测试，确认失败**

Run: `pnpm vitest run tests/shown-cards.test.ts`
Expected: FAIL，报错 `Cannot find module '../src/client/shown-cards.ts'`。

- [ ] **Step 3: 实现**

`src/client/shown-cards.ts`：

```ts
/**
 * Plugin-local record of which render_cards calls are currently shown in a
 * turn tail, so the process-group toolview can collapse to a one-line note.
 * Collections are replaced, never mutated.
 */
type Listener = () => void

let counts: ReadonlyMap<string, number> = new Map()
let listeners: ReadonlySet<Listener> = new Set()

function emit(): void {
  listeners.forEach(listener => listener())
}

/** Mark a call as shown; the returned release is idempotent. Marks are reference-counted. */
export function markShown(callId: string): () => void {
  counts = new Map([...counts, [callId, (counts.get(callId) ?? 0) + 1]])
  emit()
  let released = false
  return () => {
    if (released) return
    released = true
    const remaining = (counts.get(callId) ?? 1) - 1
    counts = remaining > 0
      ? new Map([...counts, [callId, remaining]])
      : new Map([...counts].filter(([id]) => id !== callId))
    emit()
  }
}

export function isShown(callId: string): boolean {
  return (counts.get(callId) ?? 0) > 0
}

export function subscribe(listener: Listener): () => void {
  listeners = new Set([...listeners, listener])
  return () => {
    listeners = new Set([...listeners].filter(entry => entry !== listener))
  }
}
```

- [ ] **Step 4: 运行测试，确认通过；再做类型检查**

Run: `pnpm vitest run && pnpm typecheck`
Expected: 全部 PASS。

- [ ] **Step 5: 提交**

```bash
git add -A && git commit -m "feat: track render_cards calls shown in a turn tail"
```

---

### Task 4: 末尾卡片组件

**Files:**
- Create: `src/client/TurnCardsTail.tsx`
- Modify: `src/client/styles.ts`（在 `.dshc-pre` 那一行之后加入 `.dshc-tail { margin: 8px 0; }`）
- Test: `tests/client-tail.test.tsx`

**Interfaces:**
- Consumes: `TURN_CARDS_KEY`、`TurnCard`（Task 2）、`markShown`（Task 3）、`CardsBody`、`CardErrorBoundary`、`isRecord`
- Produces: `lastTurnCard(value: unknown): TurnCard | undefined`、`TurnCardsTail({ turn }: { turn?: { data: { get(key: string): unknown } } })`

- [ ] **Step 1: 写失败的测试**

`tests/client-tail.test.tsx`：

```tsx
// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { TurnCardsTail, lastTurnCard } from '../src/client/TurnCardsTail.tsx'
import { isShown } from '../src/client/shown-cards.ts'

afterEach(cleanup)

const card = (callId: string, text: string) => ({ callId, seq: 1, spec: { items: [{ type: 'text', text }] } })
const turnWith = (value: unknown) => ({ data: { get: (key: string) => (key === 'dsh-cards' ? value : undefined) } })

describe('lastTurnCard', () => {
  it('returns the last well-formed card', () => {
    expect(lastTurnCard({ cards: [card('t-a', 'one'), card('t-b', 'two')] })?.callId).toBe('t-b')
  })

  it('returns undefined for missing or malformed data (Review Focus 5)', () => {
    expect(lastTurnCard(undefined)).toBeUndefined()
    expect(lastTurnCard({ cards: [] })).toBeUndefined()
    expect(lastTurnCard({ cards: [{ callId: 1 }] })).toBeUndefined()
    expect(lastTurnCard('x')).toBeUndefined()
  })
})

describe('TurnCardsTail', () => {
  it('renders only the last card and marks it shown while mounted (Review Focus 3)', () => {
    const view = render(<TurnCardsTail turn={turnWith({ cards: [card('t-1', '第一张'), card('t-2', '第二张')] })} />)
    expect(screen.queryByText('第一张')).toBeNull()
    expect(screen.getByText('第二张')).toBeTruthy()
    expect(view.container.querySelector('section.dshc-tail .dshc-root')).not.toBeNull()
    expect(isShown('t-2')).toBe(true)
    expect(isShown('t-1')).toBe(false)
    view.unmount()
    expect(isShown('t-2')).toBe(false)
  })

  it('renders nothing without data, with a throwing reader, or without a turn (Review Focus 5)', () => {
    const empty = render(<TurnCardsTail turn={turnWith(undefined)} />)
    expect(empty.container.innerHTML).toBe('')
    cleanup()
    const throwing = render(<TurnCardsTail turn={{ data: { get: () => { throw new Error('boom') } } }} />)
    expect(throwing.container.innerHTML).toBe('')
    cleanup()
    const none = render(<TurnCardsTail />)
    expect(none.container.innerHTML).toBe('')
  })
})
```

- [ ] **Step 2: 运行测试，确认失败**

Run: `pnpm vitest run tests/client-tail.test.tsx`
Expected: FAIL，报错 `Failed to resolve import "../src/client/TurnCardsTail.tsx"`。

- [ ] **Step 3: 实现**

`src/client/TurnCardsTail.tsx`：

```tsx
import { useEffect } from 'react'
import { isRecord } from '../spec/check.ts'
import { CardErrorBoundary } from './ErrorBoundary.tsx'
import { CardsBody } from './render.tsx'
import { markShown } from './shown-cards.ts'
import { TURN_CARDS_KEY, type TurnCard } from './turn-cards.ts'

/** Structural view of TurnLocation: only the data reader is used. */
interface TurnLike { readonly data: { get(key: string): unknown } }

/** Last well-formed card of a turn's published data; the Definition already validated each spec. */
export function lastTurnCard(value: unknown): TurnCard | undefined {
  if (!isRecord(value) || !Array.isArray(value.cards)) return undefined
  const last: unknown = value.cards.at(-1)
  if (!isRecord(last) || typeof last.callId !== 'string' || typeof last.seq !== 'number') return undefined
  if (!isRecord(last.spec) || !Array.isArray(last.spec.items)) return undefined
  return last as unknown as TurnCard
}

function readTurnData(turn: TurnLike | undefined): unknown {
  try {
    return turn?.data.get(TURN_CARDS_KEY)
  } catch {
    return undefined
  }
}

/** conversation.chat.turnTail entry: owner props arrive flat, so `turn` is a direct prop. */
export function TurnCardsTail({ turn }: { readonly turn?: TurnLike }) {
  const card = lastTurnCard(readTurnData(turn))
  const callId = card?.callId
  useEffect(() => (callId === undefined ? undefined : markShown(callId)), [callId])
  if (card === undefined) return null
  return (
    <section className="dshc-tail" aria-label="卡片">
      <CardErrorBoundary raw={JSON.stringify(card.spec, null, 2)}>
        <CardsBody spec={card.spec} />
      </CardErrorBoundary>
    </section>
  )
}
```

在 `src/client/styles.ts` 里，把这一行：

```
.dshc-pre { margin: 8px 0 0; white-space: pre-wrap; font-family: var(--ds-font-family-code, ui-monospace, monospace); font-size: 12px; }
```

改为两行：

```
.dshc-pre { margin: 8px 0 0; white-space: pre-wrap; font-family: var(--ds-font-family-code, ui-monospace, monospace); font-size: 12px; }
.dshc-tail { margin: 8px 0; }
```

- [ ] **Step 4: 运行测试，确认通过；再做类型检查**

Run: `pnpm vitest run && pnpm typecheck`
Expected: 全部 PASS。

- [ ] **Step 5: 提交**

```bash
git add -A && git commit -m "feat: render the last turn card in the turn tail"
```

---

### Task 5: 过程区收起

**Files:**
- Modify: `src/client/CardsView.tsx`
- Test: `tests/client-view.test.tsx`（在 `describe('CardsView', ...)` 里加入新用例）

**Interfaces:**
- Consumes: `isShown`、`subscribe`、`markShown`（Task 3）
- Produces: `CardsView` 的行为变化：状态为 `render` 且 `block.callId` 已登记时，只渲染一行提示 `已生成卡片，见本轮回复末尾`。

- [ ] **Step 1: 写失败的测试**

在 `tests/client-view.test.tsx` 顶部的 import 中加入：

```tsx
import { act } from '@testing-library/react'
import { markShown } from '../src/client/shown-cards.ts'
```

并在 `describe('CardsView', ...)` 块的末尾（最后那个 `})` 之前）加入：

```tsx
  it('collapses to a note while the same call is shown in the turn tail', () => {
    const block = { ...settled({}), callId: 'view-1' }
    render(<CardsView block={block} />)
    expect(screen.getByText('你好')).toBeTruthy()
    let release = () => {}
    act(() => { release = markShown('view-1') })
    expect(screen.queryByText('你好')).toBeNull()
    expect(screen.getByText('已生成卡片，见本轮回复末尾')).toBeTruthy()
    act(() => { release() })
    expect(screen.getByText('你好')).toBeTruthy()
  })

  it('keeps invalid notes even when the call id is marked', () => {
    const release = markShown('view-2')
    render(<CardsView block={settled({ callId: 'view-2', isError: true, content: [{ type: 'text', text: 'bad' }], error: { name: 'E', code: 'x' } })} />)
    expect(screen.getByText('界面描述有误，模型正在修正')).toBeTruthy()
    release()
  })
```

- [ ] **Step 2: 运行测试，确认失败**

Run: `pnpm vitest run tests/client-view.test.tsx`
Expected: FAIL。第一个新用例在 `getByText('已生成卡片，见本轮回复末尾')` 这一步找不到元素。

- [ ] **Step 3: 实现**

修改 `src/client/CardsView.tsx`：

1. 在 import 区加入：

```tsx
import { useSyncExternalStore } from 'react'
import { isShown, subscribe } from './shown-cards.ts'
```

2. 在 `export function CardsView` 之前加入：

```tsx
function callIdOf(block: unknown): string | undefined {
  return isRecord(block) && (typeof block.callId === 'string' || typeof block.callId === 'number')
    ? String(block.callId)
    : undefined
}
```

3. 把 `CardsView` 开头和 `case 'render':` 分支改为：

```tsx
export function CardsView({ block }: { readonly block?: unknown }) {
  const state = deriveViewState(block)
  const callId = callIdOf(block)
  const shownAtTail = useSyncExternalStore(subscribe, () => callId !== undefined && isShown(callId), () => false)
  switch (state.kind) {
    case 'render':
      if (shownAtTail) return <div className="dshc-root dshc-note">已生成卡片，见本轮回复末尾</div>
      return (
        <CardErrorBoundary raw={JSON.stringify(state.spec, null, 2)}>
          <CardsBody spec={state.spec} />
        </CardErrorBoundary>
      )
```

其余分支保持不变。

- [ ] **Step 4: 运行测试，确认通过；再做类型检查**

Run: `pnpm vitest run && pnpm typecheck`
Expected: 全部 PASS。

- [ ] **Step 5: 提交**

```bash
git add -A && git commit -m "feat: collapse the process-group card once the turn tail shows it"
```

---

### Task 6: 可选注册、产物测试、真实宿主验证与 README

**Files:**
- Modify: `src/client/index.ts`
- Modify: `tests/client-view.test.tsx`（改写 `describe('client entry', ...)` 中的第一个用例）
- Modify: `tests/artifact.test.ts`（假 ctx 增加 `inject`）
- Modify: `README.md`

**Interfaces:**
- Consumes: `turnCardsDefinition`（Task 2）、`TurnCardsTail`（Task 4）、`PLUGIN_ID`、`TOOL_NAME`
- Produces: 浏览器端 `apply(ctx)`：
  - 注册 toolview（与 v1 相同）；
  - 调用 `ctx.inject(['slots', 'uiConversation'], scope => ...)`，在回调中执行 `scope.uiConversation.events.register(turnCardsDefinition)`，并注册 turnTail：`{ name: 'conversation.chat.turnTail', id: 'dsh-cards' }`。

- [ ] **Step 1: 改写入口测试（先让它失败）**

在 `tests/client-view.test.tsx` 中，把 `it('declares identity and registers the toolview key with a removable style tag', ...)` 整个替换为下面两个用例，并在文件顶部的 import 中加入 `import { TurnCardsTail } from '../src/client/TurnCardsTail.tsx'` 和 `import { turnCardsDefinition } from '../src/client/turn-cards.ts'`：

```tsx
  function fakeClient(withConversation: boolean) {
    const calls: unknown[] = []
    const disposers: (() => void)[] = []
    const slots = {
      inject: (slot: string, factory: () => unknown) => { calls.push(['inject', slot]); factory() },
      register: (meta: unknown, component: unknown) => { calls.push(['register', meta, component]) },
    }
    const ctx = {
      effect: (setup: () => () => void) => { disposers.push(setup()) },
      slots,
      inject: (deps: readonly string[], callback: (scope: unknown) => void) => {
        calls.push(['scope', deps])
        if (!withConversation) return
        callback({
          slots,
          uiConversation: { events: { register: (definition: unknown) => { calls.push(['definition', definition]); return () => {} } } },
        })
      },
    }
    return { ctx, calls, disposers }
  }

  it('registers the toolview, the turn-cards definition and the turn tail, with a removable style tag', () => {
    expect(name).toBe('dsh-cards')
    expect(inject).toEqual(['slots'])
    const info = vi.spyOn(console, 'info').mockImplementation(() => undefined)
    const { ctx, calls, disposers } = fakeClient(true)
    apply(ctx as never)
    expect(calls).toEqual([
      ['inject', 'tool.call.toolview'],
      ['register', { name: 'tool.call.toolview', key: 'render_cards' }, CardsView],
      ['scope', ['slots', 'uiConversation']],
      ['definition', turnCardsDefinition],
      ['inject', 'conversation.chat.turnTail'],
      ['register', { name: 'conversation.chat.turnTail', id: 'dsh-cards' }, TurnCardsTail],
    ])
    expect(info).toHaveBeenCalledWith('[dsh-cards] client active')
    expect(document.querySelectorAll('style[data-plugin="dsh-cards"]')).toHaveLength(1)
    disposers.forEach(dispose => dispose())
    expect(document.querySelector('style[data-plugin="dsh-cards"]')).toBeNull()
    info.mockRestore()
  })

  it('keeps v1 behavior when the host has no uiConversation service (Review Focus 4)', () => {
    const info = vi.spyOn(console, 'info').mockImplementation(() => undefined)
    const { ctx, calls, disposers } = fakeClient(false)
    apply(ctx as never)
    expect(calls).toEqual([
      ['inject', 'tool.call.toolview'],
      ['register', { name: 'tool.call.toolview', key: 'render_cards' }, CardsView],
      ['scope', ['slots', 'uiConversation']],
    ])
    disposers.forEach(dispose => dispose())
    info.mockRestore()
  })
```

在 `tests/artifact.test.ts` 中，把传给 `plugin.apply` 的假 ctx：

```ts
    ;(plugin.apply as (ctx: unknown) => void)({
      effect: (setup: () => () => void) => setup(),
      slots: { inject: (_slot: string, factory: () => unknown) => factory(), register: (meta: unknown) => { registered.push(meta) } },
    })
    info.mockRestore()
    expect(registered).toEqual([{ name: 'tool.call.toolview', key: 'render_cards' }])
```

替换为：

```ts
    const definitions: unknown[] = []
    const slots = { inject: (_slot: string, factory: () => unknown) => factory(), register: (meta: unknown) => { registered.push(meta) } }
    ;(plugin.apply as (ctx: unknown) => void)({
      effect: (setup: () => () => void) => setup(),
      slots,
      inject: (_deps: readonly string[], callback: (scope: unknown) => void) => callback({
        slots,
        uiConversation: { events: { register: (definition: { kind: string }) => { definitions.push(definition.kind); return () => {} } } },
      }),
    })
    info.mockRestore()
    expect(registered).toEqual([
      { name: 'tool.call.toolview', key: 'render_cards' },
      { name: 'conversation.chat.turnTail', id: 'dsh-cards' },
    ])
    expect(definitions).toEqual(['dsh-cards'])
```

- [ ] **Step 2: 运行测试，确认失败**

Run: `pnpm vitest run tests/client-view.test.tsx tests/artifact.test.ts`
Expected: FAIL。入口用例的 `calls` 缺少 `['scope', ...]` 这一项；产物测试的 `registered` 只有 toolview。

- [ ] **Step 3: 实现**

把 `src/client/index.ts` 整个替换为：

```ts
import type { Context } from '@deepseek-ai/cordis'
import { PLUGIN_ID, TOOL_NAME } from '../constants.ts'
import { CardsView } from './CardsView.tsx'
import { installStyle } from './styles.ts'
import { TurnCardsTail } from './TurnCardsTail.tsx'
import { turnCardsDefinition } from './turn-cards.ts'

export const name = PLUGIN_ID
export const inject = ['slots']

interface SlotsService {
  inject(slot: string, factory: () => unknown): unknown
  register(meta: { name: string; key?: string; id?: string }, component: unknown): unknown
}

/** Services available once uiConversation is present (docs/subsystems/conversation.md). */
interface ConversationScope {
  readonly slots: SlotsService
  readonly uiConversation: { readonly events: { register(definition: unknown): () => void } }
}

/** Structural view of the client services used; see packages/client/ui-tool/README.md. */
interface ClientServices {
  effect(setup: () => () => void): unknown
  readonly slots: SlotsService
  inject(deps: readonly string[], callback: (scope: ConversationScope) => void): unknown
}

export function apply(ctx: Context): void {
  const client = ctx as unknown as ClientServices
  client.effect(() => installStyle(document))
  client.slots.inject('tool.call.toolview', () => client.slots.register(
    { name: 'tool.call.toolview', key: TOOL_NAME },
    CardsView,
  ))
  // Optional: hosts without uiConversation keep the v1 toolview-only behavior.
  // events.register is scoped to `scope` through the registry's own ctx.effect.
  client.inject(['slots', 'uiConversation'], (scope) => {
    scope.uiConversation.events.register(turnCardsDefinition)
    scope.slots.inject('conversation.chat.turnTail', () => scope.slots.register(
      { name: 'conversation.chat.turnTail', id: PLUGIN_ID },
      TurnCardsTail,
    ))
  })
  console.info('[dsh-cards] client active')
}
```

- [ ] **Step 4: 跑全量测试、类型检查，并确认体积**

Run: `pnpm vitest run && pnpm typecheck && wc -c lib/client.js`
Expected: 全部 PASS；`lib/client.js` 小于 40000 字节。

- [ ] **Step 5: 在本机真实 DSH 中验证加载**

```bash
cd /home/shoogure/txliu/tools/deepseek-harness
export DSH_HOME=/tmp/dsh-cards-e2e && rm -rf $DSH_HOME
pnpm dsh plugin --profile web add link:/home/shoogure/txliu/tools/dsh-cards
```

用 Bash 的 `run_in_background` 启动：`DSH_HOME=/tmp/dsh-cards-e2e pnpm dsh web --port 3199 --no-open > /tmp/dsh-cards-web.log 2>&1`

服务就绪后执行：

```bash
TOKEN_URL=$(grep -o "http://127.0.0.1:3199/?token=[A-Za-z0-9_-]*" /tmp/dsh-cards-web.log | head -1)
timeout 90 google-chrome --headless=new --disable-gpu --enable-logging=stderr --v=0 --virtual-time-budget=20000 \
  --dump-dom "$TOKEN_URL" 2>/tmp/dshc-chrome.err >/dev/null
grep -c "\[dsh-cards\] client active" /tmp/dshc-chrome.err
grep -i -E "CONSOLE.*(error|uncaught|already registered)" /tmp/dshc-chrome.err | head
grep -n -i -E "error|dsh-cards" /tmp/dsh-cards-web.log | head
```

Expected：
- `client active` 的计数为 1；
- 没有与 `dsh-cards`、`uiConversation`、`already registered` 相关的控制台错误；
- 服务端日志里没有报错。

检查完后停止服务。用 `ss -ltnp | grep 3199` 找到进程号，再 `kill <pid>`，**不要用 pkill**，因为它的匹配模式会把当前 shell 也杀掉。最后执行 `rm -rf /tmp/dsh-cards-e2e`。

- [ ] **Step 6: 更新 README**

在 `README.md` 的"## 使用"一节末尾追加：

```markdown

每一轮回复结束后，这一轮最后一次成功生成的卡片会完整显示在回复末尾（过程分组之外）；过程区里对应的调用缩成一行"已生成卡片，见本轮回复末尾"。生成过程中，卡片仍在过程区里显示。宿主没有 `uiConversation` 服务时（较老的 DSH），只在过程区显示卡片。
```

- [ ] **Step 7: 跑全量测试并提交**

Run: `pnpm vitest run && pnpm typecheck`
Expected: 全部 PASS。

```bash
git add -A && git commit -m "feat: show the last card of each turn in the turn tail" \
  -m "Verified in local DSH 0.1.6-alpha.2: plugin loads, [dsh-cards] client active, no uiConversation or registration errors."
```

Step 5 中任何一项不符合 Expected，都要在提交信息里如实写明。
