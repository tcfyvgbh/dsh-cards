// @vitest-environment jsdom
import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import * as React from 'react'
import * as jsxRuntime from 'react/jsx-runtime'
import { beforeAll, describe, expect, it, vi } from 'vitest'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')

beforeAll(() => {
  execFileSync('pnpm', ['build'], { cwd: ROOT, stdio: 'pipe' })
})

describe('lib/client.js', () => {
  it('registers through __ModuleLoader__ and wires the toolview slot', () => {
    const code = readFileSync(resolve(ROOT, 'lib/client.js'), 'utf8')
    expect(code.startsWith('window.__ModuleLoader__.load({ id: "dsh-cards", factory: (require) => {')).toBe(true)
    expect(code.length).toBeLessThan(40_000)

    const entries: { id: string; factory: (require: (id: string) => unknown) => Record<string, unknown> }[] = []
    const fakeWindow = { __ModuleLoader__: { load: (entry: (typeof entries)[number]) => { entries.push(entry) } } }
    new Function('window', code)(fakeWindow)
    expect(entries.map(entry => entry.id)).toEqual(['dsh-cards'])

    const requested: string[] = []
    const modules: Record<string, unknown> = { react: React, 'react/jsx-runtime': jsxRuntime }
    const plugin = entries[0]!.factory(id => {
      requested.push(id)
      if (!(id in modules)) throw new Error(`unexpected require ${id}`)
      return modules[id]
    })
    expect(new Set(requested)).toEqual(new Set(['react', 'react/jsx-runtime']))
    expect(plugin.name).toBe('dsh-cards')
    expect(plugin.inject).toEqual(['slots'])

    const registered: unknown[] = []
    const info = vi.spyOn(console, 'info').mockImplementation(() => undefined)
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
  })
})

describe('lib/index.js', () => {
  it('exports the host plugin without runtime DSH imports', async () => {
    const code = readFileSync(resolve(ROOT, 'lib/index.js'), 'utf8')
    expect(code).not.toMatch(/from ['"]@deepseek-ai\//)
    expect(code).not.toMatch(/require\(['"]@deepseek-ai\//)
    const host = await import(pathToFileURL(resolve(ROOT, 'lib/index.js')).href)
    expect(host.name).toBe('dsh-cards')
    expect(host.inject).toEqual(['tools', 'systemPrompt'])
    expect(typeof host.apply).toBe('function')
  })
})
