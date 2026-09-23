// @vitest-environment jsdom
import { act, cleanup, render, screen } from '@testing-library/react'
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

  it('re-renders when the turn data source publishes later (final review #1)', () => {
    let value: unknown
    const listeners = new Set<() => void>()
    const turn = {
      data: {
        get: () => value,
        source: () => ({
          getSnapshot: () => value,
          subscribe: (listener: () => void) => { listeners.add(listener); return () => { listeners.delete(listener) } },
        }),
      },
    }
    const view = render(<TurnCardsTail turn={turn} />)
    expect(view.container.innerHTML).toBe('')
    act(() => {
      value = { cards: [card('t-late', '稍后发布')] }
      listeners.forEach(listener => listener())
    })
    expect(screen.getByText('稍后发布')).toBeTruthy()
    expect(isShown('t-late')).toBe(true)
  })
})
