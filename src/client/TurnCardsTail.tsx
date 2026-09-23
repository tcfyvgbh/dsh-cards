import { useEffect, useMemo, useSyncExternalStore } from 'react'
import { isRecord } from '../spec/check.ts'
import { CardErrorBoundary } from './ErrorBoundary.tsx'
import { CardsBody } from './render.tsx'
import { markShown } from './shown-cards.ts'
import { TURN_CARDS_KEY, type TurnCard } from './turn-cards.ts'

/** Structural view of a Location-data source (ConversationLocationDataSource). */
interface DataSourceLike { getSnapshot(): unknown; subscribe(listener: () => void): () => void }

/** Structural view of TurnLocation: the keyed data reader and, when present, its live source. */
interface TurnLike { readonly data: { get(key: string): unknown; source?(key: string): DataSourceLike } }

/** Last well-formed card of a turn's published data; the Definition already validated each spec. */
export function lastTurnCard(value: unknown): TurnCard | undefined {
  if (!isRecord(value) || !Array.isArray(value.cards)) return undefined
  const last: unknown = value.cards.at(-1)
  if (!isRecord(last) || typeof last.callId !== 'string' || typeof last.seq !== 'number') return undefined
  if (!isRecord(last.spec) || !Array.isArray(last.spec.items)) return undefined
  return last as unknown as TurnCard
}

const NO_SUBSCRIPTION = (): (() => void) => () => {}

/**
 * Live source for this turn's cards. Prefers data.source(key) (published updates,
 * as ui-chat's use-turn-data does); falls back to a one-shot get(). Reads never throw.
 */
function turnCardsSource(turn: TurnLike | undefined): DataSourceLike {
  const read = (): unknown => {
    try {
      return turn?.data.get(TURN_CARDS_KEY)
    } catch {
      return undefined
    }
  }
  try {
    const live = typeof turn?.data.source === 'function' ? turn.data.source(TURN_CARDS_KEY) : undefined
    if (live !== undefined && typeof live.subscribe === 'function' && typeof live.getSnapshot === 'function') {
      return {
        subscribe: listener => live.subscribe(listener),
        getSnapshot: () => {
          try {
            return live.getSnapshot()
          } catch {
            return undefined
          }
        },
      }
    }
  } catch {
    // fall through to the one-shot reader
  }
  return { subscribe: NO_SUBSCRIPTION, getSnapshot: read }
}

/** conversation.chat.turnTail entry: owner props arrive flat, so `turn` is a direct prop. */
export function TurnCardsTail({ turn }: { readonly turn?: TurnLike }) {
  const source = useMemo(() => turnCardsSource(turn), [turn])
  const card = lastTurnCard(useSyncExternalStore(source.subscribe, source.getSnapshot))
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
