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
