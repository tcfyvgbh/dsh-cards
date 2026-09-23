import { describe, expect, it } from 'vitest'
import { countNodes, formatErrors, parseSpecInput, validateSpec } from '../src/spec/validate.ts'

function errorsOf(input: unknown): readonly string[] {
  const result = validateSpec(input)
  return result.ok ? [] : result.errors.map(error => `${error.path}: ${error.message}`)
}

describe('validateSpec: root', () => {
  it('accepts a minimal spec and counts nodes', () => {
    const result = validateSpec({ title: 'T', items: [{ type: 'text', text: 'hello' }] })
    expect(result).toEqual({ ok: true, spec: { title: 'T', items: [{ type: 'text', text: 'hello' }] }, nodes: 1 })
  })

  it('rejects a non-object root', () => {
    expect(errorsOf('x')).toEqual(['spec: 应为对象，收到 "x"'])
    expect(errorsOf(null)).toEqual(['spec: 应为对象，收到 null'])
  })

  it('requires at least one item', () => {
    expect(errorsOf({ items: [] })).toEqual(['items: 至少需要 1 个元素'])
    expect(errorsOf({})).toEqual(['items: 缺少必填字段'])
  })

  it('drops unknown fields on root and nodes (Review Focus 5)', () => {
    const result = validateSpec({ theme: 'dark', items: [{ type: 'text', text: 'a', color: 'red' }] })
    expect(result).toEqual({ ok: true, spec: { items: [{ type: 'text', text: 'a' }] }, nodes: 1 })
  })

  it('rejects an unknown node type with the allowed list', () => {
    const [message] = errorsOf({ items: [{ type: 'video' }] })
    expect(message).toMatch(/^items\[0\]\.type: 只允许 row \| grid \| card \| text \| callout \| list \| keyvalue \| badge/)
    expect(message).toMatch(/收到 "video"$/)
  })
})

describe('validateSpec: layout and text nodes', () => {
  it('accepts nested layout within the depth limit', () => {
    const spec = {
      items: [{
        type: 'row',
        items: [{
          type: 'grid', cols: 2,
          items: [{ type: 'card', title: 'c', items: [{ type: 'text', text: 'deep', variant: 'muted' }] }],
        }],
      }],
    }
    const result = validateSpec(spec)
    expect(result.ok).toBe(true)
    expect(result.ok && result.nodes).toBe(4)
  })

  it('rejects nesting deeper than 4', () => {
    const leaf = { type: 'text', text: 'x' }
    const wrap = (inner: unknown) => ({ type: 'row', items: [inner] })
    expect(errorsOf({ items: [wrap(wrap(wrap(wrap(leaf))))] }))
      .toEqual(['items[0].items[0].items[0].items[0].items[0]: 嵌套层级超过上限 4'])
  })

  it('validates grid cols as an integer from 1 to 4', () => {
    expect(errorsOf({ items: [{ type: 'grid', cols: 5, items: [{ type: 'text', text: 'a' }] }] }))
      .toEqual(['items[0].cols: 应为 1 到 4 之间的整数，收到 5'])
  })

  it('validates callout tone, list items and keyvalue pairs', () => {
    expect(errorsOf({ items: [
      { type: 'callout', tone: 'danger', content: 'c' },
      { type: 'list', items: ['a', 3] },
      { type: 'keyvalue', pairs: [{ key: 'k' }] },
      { type: 'badge', text: 'b', tone: 'neutral' },
    ] })).toEqual([
      'items[0].tone: 只允许 info | success | warning | error，收到 "danger"',
      'items[1].items[1]: 应为字符串，收到 3',
      'items[2].pairs[0].value: 缺少必填字段',
    ])
  })

  it('rejects strings over 2000 characters', () => {
    expect(errorsOf({ items: [{ type: 'text', text: 'a'.repeat(2001) }] }))
      .toEqual(['items[0].text: 字符串长度 2001 超过上限 2000'])
  })

  it('rejects more than 200 nodes in total', () => {
    const cards = Array.from({ length: 101 }, () => ({ type: 'card', items: [{ type: 'text', text: 'x' }] }))
    expect(errorsOf({ items: cards })).toEqual(['items: 节点总数 202 超过上限 200'])
  })
})

describe('parseSpecInput and formatErrors', () => {
  it('parses a JSON string spec', () => {
    const result = parseSpecInput('{"items":[{"type":"text","text":"a"}]}')
    expect(result.ok).toBe(true)
  })

  it('reports invalid JSON strings', () => {
    const result = parseSpecInput('{bad')
    expect(result.ok).toBe(false)
    expect(!result.ok && result.errors[0]?.message).toMatch(/^不是合法的 JSON：/)
  })

  it('formats at most the given number of errors', () => {
    const errors = Array.from({ length: 12 }, (_, i) => ({ path: `items[${i}]`, message: 'm' }))
    const text = formatErrors(errors)
    expect(text.split('\n')).toHaveLength(11)
    expect(text).toContain('...另有 2 条错误')
  })

  it('counts nested nodes', () => {
    expect(countNodes([{ type: 'row', items: [{ type: 'text', text: 'a' }, { type: 'badge', text: 'b' }] }])).toBe(3)
  })
})
