// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { CardsView, deriveViewState } from '../src/client/CardsView.tsx'
import { CardErrorBoundary } from '../src/client/ErrorBoundary.tsx'
import { apply, inject, name } from '../src/client/index.ts'
import { installStyle } from '../src/client/styles.ts'

afterEach(cleanup)

const spec = { items: [{ type: 'text', text: '你好' }] }
const argsRaw = JSON.stringify({ spec })
const running = { callId: 'c1', name: 'render_cards', argsRaw, turn: 1, step: 1, time: 0, subCalls: [] }
const settled = (extra: Record<string, unknown>) => ({
  kind: 'tool-result', seq: 1, time: 0, callId: 'c1', call: { name: 'render_cards', argsRaw }, callTime: 0,
  content: [{ type: 'text', text: '{"ok":true,"nodes":1}' }], isError: false, subCalls: [], ...extra,
})

describe('deriveViewState', () => {
  it('renders a running call whose args already parse', () => {
    expect(deriveViewState(running)).toEqual({ kind: 'render', spec })
  })

  it('shows pending for a running call with unparsable args', () => {
    expect(deriveViewState({ ...running, argsRaw: '{"spec":' })).toEqual({ kind: 'pending' })
    expect(deriveViewState(undefined)).toEqual({ kind: 'pending' })
  })

  it('renders a successful result', () => {
    expect(deriveViewState(settled({}))).toEqual({ kind: 'render', spec })
  })

  it('reports validation failures with the tool error text', () => {
    const state = deriveViewState(settled({
      isError: true,
      content: [{ type: 'text', text: 'render_cards 参数校验失败：\nitems[0].kind: x' }],
      error: { name: 'Error', code: 'tool_error' },
    }))
    expect(state).toEqual({ kind: 'invalid', message: 'render_cards 参数校验失败：\nitems[0].kind: x' })
  })

  it('renders an interrupted call when args parse, else shows interrupted', () => {
    const interrupted = { isError: true, error: { name: 'Abort', code: 'interrupted' } }
    expect(deriveViewState(settled(interrupted))).toEqual({ kind: 'render', spec })
    expect(deriveViewState(settled({ ...interrupted, call: { name: 'render_cards', argsRaw: '{' } }))).toEqual({ kind: 'interrupted' })
  })

  it('shows missing when the call head fell out of the window (Review Focus 1)', () => {
    expect(deriveViewState(settled({ call: null }))).toEqual({ kind: 'missing' })
  })
})

describe('CardsView', () => {
  it('renders cards, invalid notes and missing notes', () => {
    render(<CardsView block={settled({})} />)
    expect(screen.getByText('你好')).toBeTruthy()
    cleanup()
    render(<CardsView block={settled({ isError: true, content: [{ type: 'text', text: 'bad path' }], error: { name: 'E', code: 'x' } })} />)
    expect(screen.getByText('界面描述有误，模型正在修正')).toBeTruthy()
    expect(screen.getByText('bad path')).toBeTruthy()
    cleanup()
    render(<CardsView block={settled({ call: null })} />)
    expect(screen.getByText('卡片数据已不在当前会话窗口中')).toBeTruthy()
  })
})

describe('CardErrorBoundary', () => {
  it('shows a fallback with the raw spec when a child throws', () => {
    const quiet = vi.spyOn(console, 'error').mockImplementation(() => undefined)
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined)
    const swallow = (event: ErrorEvent) => event.preventDefault()
    window.addEventListener('error', swallow)
    const Boom = (): never => { throw new Error('boom') }
    render(<CardErrorBoundary raw='{"items":[]}'><Boom /></CardErrorBoundary>)
    window.removeEventListener('error', swallow)
    expect(screen.getByText('卡片渲染失败')).toBeTruthy()
    expect(screen.getByText('{"items":[]}')).toBeTruthy()
    quiet.mockRestore()
    warn.mockRestore()
  })
})

describe('client entry', () => {
  it('declares identity and registers the toolview key with a removable style tag', () => {
    expect(name).toBe('dsh-cards')
    expect(inject).toEqual(['slots'])
    const calls: unknown[] = []
    const disposers: (() => void)[] = []
    const info = vi.spyOn(console, 'info').mockImplementation(() => undefined)
    apply({
      effect: (setup: () => () => void) => { disposers.push(setup()) },
      slots: {
        inject: (slot: string, factory: () => unknown) => { calls.push(['inject', slot]); factory() },
        register: (meta: unknown, component: unknown) => { calls.push(['register', meta, component]) },
      },
    } as never)
    expect(calls).toEqual([
      ['inject', 'tool.call.toolview'],
      ['register', { name: 'tool.call.toolview', key: 'render_cards' }, CardsView],
    ])
    expect(info).toHaveBeenCalledWith('[dsh-cards] client active')
    expect(document.querySelectorAll('style[data-plugin="dsh-cards"]')).toHaveLength(1)
    disposers.forEach(dispose => dispose())
    expect(document.querySelector('style[data-plugin="dsh-cards"]')).toBeNull()
    info.mockRestore()
  })

  it('installs the style tag only once', () => {
    const first = installStyle(document)
    const second = installStyle(document)
    expect(document.querySelectorAll('style[data-plugin="dsh-cards"]')).toHaveLength(1)
    second()
    expect(document.querySelectorAll('style[data-plugin="dsh-cards"]')).toHaveLength(1)
    first()
    expect(document.querySelector('style[data-plugin="dsh-cards"]')).toBeNull()
  })
})
