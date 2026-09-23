import {
  LIMITS,
  type BadgeNode, type CalloutNode, type CardNode, type GridNode, type KeyValueNode, type KeyValuePair,
  type ListNode, type Node, type RowNode, type Spec, type TextNode,
} from './types.ts'
import {
  bool, cell, describe, each, fail, intRange, isRecord, list, object, ok, oneOf, optional, str,
  type Checked, type Rule, type SpecError,
} from './check.ts'
import { DATA_RULES } from './data-rules.ts'

export type ValidationResult =
  | { readonly ok: true; readonly spec: Spec; readonly nodes: number }
  | { readonly ok: false; readonly errors: readonly SpecError[] }

const TONES = ['info', 'success', 'warning', 'error'] as const
const BADGE_TONES = ['neutral', ...TONES] as const
const VARIANTS = ['h2', 'h3', 'body', 'muted'] as const

function children(value: unknown, path: string, depth: number): Checked<readonly Node[]> {
  return each(
    list(value, path, { min: 1, max: LIMITS.nodes, noun: '元素' }),
    path,
    (item, itemPath) => node(item, itemPath, depth + 1),
  )
}

function pair(value: unknown, path: string): Checked<KeyValuePair> {
  if (!isRecord(value)) return fail(path, `应为对象，收到 ${describe(value)}`)
  return object<KeyValuePair>({ key: str(value.key, `${path}.key`), value: cell(value.value, `${path}.value`) })
}

const BASE_RULES: Readonly<Record<string, Rule>> = {
  row: (v, p, d) => object<RowNode>({ type: ok('row'), items: children(v.items, `${p}.items`, d) }),
  grid: (v, p, d) => object<GridNode>({
    type: ok('grid'),
    cols: intRange(v.cols, 1, 4, `${p}.cols`),
    items: children(v.items, `${p}.items`, d),
  }),
  card: (v, p, d) => object<CardNode>({
    type: ok('card'),
    title: optional(v.title, `${p}.title`, str),
    items: children(v.items, `${p}.items`, d),
  }),
  text: (v, p) => object<TextNode>({
    type: ok('text'),
    text: str(v.text, `${p}.text`),
    variant: optional(v.variant, `${p}.variant`, (x, q) => oneOf(x, VARIANTS, q)),
  }),
  callout: (v, p) => object<CalloutNode>({
    type: ok('callout'),
    tone: oneOf(v.tone, TONES, `${p}.tone`),
    title: optional(v.title, `${p}.title`, str),
    content: str(v.content, `${p}.content`),
  }),
  list: (v, p) => object<ListNode>({
    type: ok('list'),
    items: each(list(v.items, `${p}.items`, { min: 1, max: LIMITS.rows, noun: '条目' }), `${p}.items`, str),
    ordered: optional(v.ordered, `${p}.ordered`, bool),
  }),
  keyvalue: (v, p) => object<KeyValueNode>({
    type: ok('keyvalue'),
    pairs: each(list(v.pairs, `${p}.pairs`, { min: 1, max: LIMITS.rows, noun: '键值对' }), `${p}.pairs`, pair),
  }),
  badge: (v, p) => object<BadgeNode>({
    type: ok('badge'),
    text: str(v.text, `${p}.text`),
    tone: optional(v.tone, `${p}.tone`, (x, q) => oneOf(x, BADGE_TONES, q)),
  }),
}

const RULES: Readonly<Record<string, Rule>> = { ...BASE_RULES, ...DATA_RULES }
const TYPES = Object.keys(RULES)

function node(value: unknown, path: string, depth: number): Checked<Node> {
  if (!isRecord(value)) return fail(path, `应为对象，收到 ${describe(value)}`)
  if (depth > LIMITS.depth) return fail(path, `嵌套层级超过上限 ${LIMITS.depth}`)
  const type = oneOf(value.type, TYPES, `${path}.type`)
  const rule = type.value === undefined ? undefined : RULES[type.value]
  return rule === undefined ? { errors: type.errors } : rule(value, path, depth)
}

/** Count every node, including nested layout children. */
export function countNodes(items: readonly Node[]): number {
  return items.reduce(
    (total, item) => total + 1
      + (item.type === 'row' || item.type === 'grid' || item.type === 'card' ? countNodes(item.items) : 0),
    0,
  )
}

/** Validate an already-parsed spec object and return a normalized copy. */
export function validateSpec(input: unknown): ValidationResult {
  if (!isRecord(input)) return { ok: false, errors: [{ path: 'spec', message: `应为对象，收到 ${describe(input)}` }] }
  const checked = object<Spec>({
    title: optional(input.title, 'title', str),
    items: children(input.items, 'items', 0),
  })
  if (checked.value === undefined) return { ok: false, errors: checked.errors }
  const nodes = countNodes(checked.value.items)
  if (nodes > LIMITS.nodes) {
    return { ok: false, errors: [{ path: 'items', message: `节点总数 ${nodes} 超过上限 ${LIMITS.nodes}` }] }
  }
  return { ok: true, spec: checked.value, nodes }
}

/** Accept a spec object or its JSON string form (models sometimes serialize it). */
export function parseSpecInput(input: unknown): ValidationResult {
  if (typeof input !== 'string') return validateSpec(input)
  try {
    return validateSpec(JSON.parse(input))
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error)
    return { ok: false, errors: [{ path: 'spec', message: `不是合法的 JSON：${reason}` }] }
  }
}

/** Render errors one per line as `path: message`, capped at `limit`. */
export function formatErrors(errors: readonly SpecError[], limit = 10): string {
  const lines = errors.slice(0, limit).map(error => `${error.path}: ${error.message}`)
  return errors.length > limit ? [...lines, `...另有 ${errors.length - limit} 条错误`].join('\n') : lines.join('\n')
}
