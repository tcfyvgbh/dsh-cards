import { useEffect } from 'react'
import { isRecord } from '../spec/check.ts'
import { CardErrorBoundary } from './ErrorBoundary.tsx'
import { CardsBody } from './render.tsx'
import { markShown } from './shown-cards.ts'
import { TURN_CARDS_KEY, type TurnCard } from './turn-cards.ts'

/** Structural view of TurnLocation: only the data reader is used. */
interface TurnLike { readonly data: { get(key: string): unknown } }

/** Last well-formed card of a turn's published data; the Definition already validated each spec. */
export function lastTurnCard(value: unknown): TurnCard | undefined {
  if (!isRecord(value) || !Array.isArray(value.cards)) return undefined
  const last: unknown = value.cards.at(-1)
  if (!isRecord(last) || typeof last.callId !== 'string' || typeof last.seq !== 'number') return undefined
  if (!isRecord(last.spec) || !Array.isArray(last.spec.items)) return undefined
  return last as unknown as TurnCard
}

function readTurnData(turn: TurnLike | undefined): unknown {
  try {
    return turn?.data.get(TURN_CARDS_KEY)
  } catch {
    return undefined
  }
}

/** conversation.chat.turnTail entry: owner props arrive flat, so `turn` is a direct prop. */
export function TurnCardsTail({ turn }: { readonly turn?: TurnLike }) {
  const card = lastTurnCard(readTurnData(turn))
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
