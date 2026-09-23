import type { Context } from '@deepseek-ai/cordis'
import { PLUGIN_ID } from './constants.ts'
import { GUIDANCE_ORDER, GUIDANCE_SECTION_NAME, GUIDANCE_TEXT } from './prompt.ts'
import { createCardsTool } from './tool.ts'

export const name = PLUGIN_ID
export const inject = ['tools', 'systemPrompt']

/** Row config from cordis.patch.yml; `guidance: false` keeps rendering but drops the prompt section. */
export interface Config { readonly guidance?: boolean }

/**
 * Structural view of the two host services this plugin uses. Both return
 * Cordis-scoped disposers, so unloading the plugin retracts them.
 */
interface HostServices {
  readonly tools: { register(definition: unknown): () => void }
  readonly systemPrompt: {
    section(section: { name: string; order: number; text: string; interpolate: boolean }): () => void
  }
}

export function apply(ctx: Context, config: Config = {}): void {
  const host = ctx as unknown as HostServices
  host.tools.register(createCardsTool())
  if (config.guidance !== false) {
    host.systemPrompt.section({ name: GUIDANCE_SECTION_NAME, order: GUIDANCE_ORDER, text: GUIDANCE_TEXT, interpolate: false })
  }
}
