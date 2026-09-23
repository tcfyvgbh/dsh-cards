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
