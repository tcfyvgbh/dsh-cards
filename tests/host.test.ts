import { describe, expect, it } from 'vitest'
import { apply, inject, name } from '../src/index.ts'
import { GUIDANCE_ORDER, GUIDANCE_SECTION_NAME } from '../src/prompt.ts'
import { createCardsTool } from '../src/tool.ts'

function fakeContext() {
  const tools: unknown[] = []
  const sections: unknown[] = []
  const ctx = {
    tools: { register: (definition: unknown) => { tools.push(definition); return () => undefined } },
    systemPrompt: { section: (section: unknown) => { sections.push(section); return () => undefined } },
  }
  return { ctx, tools, sections }
}

const VALID = { items: [{ type: 'text', text: 'a' }, { type: 'badge', text: 'b' }] }

describe('host plugin', () => {
  it('declares its Cordis identity', () => {
    expect(name).toBe('dsh-cards')
    expect(inject).toEqual(['tools', 'systemPrompt'])
  })

  it('registers render_cards and the guidance section by default', () => {
    const { ctx, tools, sections } = fakeContext()
    apply(ctx as never)
    expect(tools).toHaveLength(1)
    expect((tools[0] as { name: string }).name).toBe('render_cards')
    expect(sections).toEqual([expect.objectContaining({
      name: GUIDANCE_SECTION_NAME,
      order: GUIDANCE_ORDER,
      interpolate: false,
      text: expect.stringContaining('render_cards'),
    })])
  })

  it('skips the guidance section when guidance is false', () => {
    const { ctx, tools, sections } = fakeContext()
    apply(ctx as never, { guidance: false })
    expect(tools).toHaveLength(1)
    expect(sections).toEqual([])
  })
})

describe('render_cards tool', () => {
  const tool = createCardsTool()

  it('declares a spec parameter and an ok/nodes output', () => {
    expect(tool.parameters).toEqual(expect.objectContaining({ type: 'object', required: ['spec'] }))
    expect(tool.output.schema).toEqual(expect.objectContaining({ required: ['ok', 'nodes'] }))
    expect(tool.output.render({}, { ok: true, nodes: 2 })).toEqual([{ type: 'text', text: '{"ok":true,"nodes":2}' }])
  })

  it('returns ok with the node count for a valid spec object or string', async () => {
    await expect(tool.execute({ spec: VALID })).resolves.toEqual({ ok: true, nodes: 2 })
    await expect(tool.execute({ spec: JSON.stringify(VALID) })).resolves.toEqual({ ok: true, nodes: 2 })
  })

  it('throws path-addressed errors for an invalid spec', async () => {
    const bad = { items: [{ type: 'chart', kind: 'pie', labels: ['a'], series: [{ name: 's', data: [1] }] }] }
    await expect(tool.execute({ spec: bad })).rejects.toThrow(/items\[0\]\.kind: 只允许 line \| bar \| donut，收到 "pie"/)
    await expect(tool.execute({ spec: bad })).rejects.toThrow(/请修正后重新调用 render_cards/)
  })

  it('reports a missing spec argument', async () => {
    await expect(tool.execute({})).rejects.toThrow(/spec: 应为对象，收到 空值/)
  })
})
