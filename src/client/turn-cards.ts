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
