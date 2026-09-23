import type { Context } from '@deepseek-ai/cordis'
import { PLUGIN_ID, TOOL_NAME } from '../constants.ts'
import { CardsView } from './CardsView.tsx'
import { installStyle } from './styles.ts'
import { TurnCardsTail } from './TurnCardsTail.tsx'
import { turnCardsDefinition } from './turn-cards.ts'

export const name = PLUGIN_ID
export const inject = ['slots']

interface SlotsService {
  inject(slot: string, factory: () => unknown): unknown
  register(meta: { name: string; key?: string; id?: string }, component: unknown): unknown
}

/** Services available once uiConversation is present (docs/subsystems/conversation.md). */
interface ConversationScope {
  readonly slots: SlotsService
  readonly uiConversation: { readonly events: { register(definition: unknown): () => void } }
}

/** Structural view of the client services used; see packages/client/ui-tool/README.md. */
interface ClientServices {
  effect(setup: () => () => void): unknown
  readonly slots: SlotsService
  inject(deps: readonly string[], callback: (scope: ConversationScope) => void): unknown
}

export function apply(ctx: Context): void {
  const client = ctx as unknown as ClientServices
  client.effect(() => installStyle(document))
  client.slots.inject('tool.call.toolview', () => client.slots.register(
    { name: 'tool.call.toolview', key: TOOL_NAME },
    CardsView,
  ))
  // Optional: hosts without uiConversation keep the v1 toolview-only behavior.
  // events.register is scoped to `scope` through the registry's own ctx.effect.
  client.inject(['slots', 'uiConversation'], (scope) => {
    scope.uiConversation.events.register(turnCardsDefinition)
    scope.slots.inject('conversation.chat.turnTail', () => scope.slots.register(
      { name: 'conversation.chat.turnTail', id: PLUGIN_ID },
      TurnCardsTail,
    ))
  })
  console.info('[dsh-cards] client active')
}
