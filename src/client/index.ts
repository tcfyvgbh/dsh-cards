import type { Context } from '@deepseek-ai/cordis'
import { PLUGIN_ID, TOOL_NAME } from '../constants.ts'
import { CardsView } from './CardsView.tsx'
import { installStyle } from './styles.ts'

export const name = PLUGIN_ID
export const inject = ['slots']

/** Structural view of the client services used; see packages/client/ui-tool/README.md. */
interface ClientServices {
  effect(setup: () => () => void): unknown
  readonly slots: {
    inject(slot: string, factory: () => unknown): unknown
    register(meta: { name: string; key: string }, component: unknown): unknown
  }
}

export function apply(ctx: Context): void {
  const client = ctx as unknown as ClientServices
  client.effect(() => installStyle(document))
  client.slots.inject('tool.call.toolview', () => client.slots.register(
    { name: 'tool.call.toolview', key: TOOL_NAME },
    CardsView,
  ))
  console.info('[dsh-cards] client active')
}
