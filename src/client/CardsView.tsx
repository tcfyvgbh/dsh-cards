import { isRecord } from '../spec/check.ts'
import type { Spec } from '../spec/types.ts'
import { specFromArgs } from '../spec/args.ts'
import { formatErrors } from '../spec/validate.ts'
import { CardErrorBoundary } from './ErrorBoundary.tsx'
import { CardsBody } from './render.tsx'

export type ViewState =
  | { readonly kind: 'render'; readonly spec: Spec }
  | { readonly kind: 'pending' }
  | { readonly kind: 'invalid'; readonly message: string }
  | { readonly kind: 'interrupted' }
  | { readonly kind: 'missing' }

function contentText(content: unknown): string {
  if (typeof content === 'string') return content
  if (!Array.isArray(content)) return ''
  return content
    .map(block => (isRecord(block) && typeof block.text === 'string' ? block.text : ''))
    .filter(text => text !== '')
    .join('\n')
}

/**
 * Map DSH's ToolCallBlock (RunningToolCall | ToolResultNode, see
 * packages/client/ui-conversation/src/client/contract/records.ts) to a view state.
 * Only argsRaw, kind, call, isError, error.code/reason and content are read.
 */
export function deriveViewState(block: unknown): ViewState {
  if (!isRecord(block)) return { kind: 'pending' }
  if (!('kind' in block)) {
    const parsed = specFromArgs(block.argsRaw)
    return parsed?.ok === true ? { kind: 'render', spec: parsed.spec } : { kind: 'pending' }
  }
  const call = isRecord(block.call) ? block.call : undefined
  const parsed = call === undefined ? undefined : specFromArgs(call.argsRaw)
  const error = isRecord(block.error) ? block.error : undefined
  if (block.isError === true && error?.code === 'interrupted') {
    return parsed?.ok === true ? { kind: 'render', spec: parsed.spec } : { kind: 'interrupted' }
  }
  if (block.isError === true) {
    const reason = typeof error?.reason === 'string' ? error.reason : '工具调用失败'
    return { kind: 'invalid', message: contentText(block.content) || reason }
  }
  if (call === undefined) return { kind: 'missing' }
  if (parsed === undefined) return { kind: 'invalid', message: '无法解析工具参数' }
  return parsed.ok ? { kind: 'render', spec: parsed.spec } : { kind: 'invalid', message: formatErrors(parsed.errors) }
}

export function CardsView({ block }: { readonly block?: unknown }) {
  const state = deriveViewState(block)
  switch (state.kind) {
    case 'render':
      return (
        <CardErrorBoundary raw={JSON.stringify(state.spec, null, 2)}>
          <CardsBody spec={state.spec} />
        </CardErrorBoundary>
      )
    case 'pending':
      return <div className="dshc-root dshc-note" aria-busy="true">正在生成卡片...</div>
    case 'interrupted':
      return <div className="dshc-root dshc-note">卡片生成已中断</div>
    case 'missing':
      return <div className="dshc-root dshc-note">卡片数据已不在当前会话窗口中</div>
    case 'invalid':
      return (
        <details className="dshc-root dshc-note">
          <summary>界面描述有误，模型正在修正</summary>
          <pre className="dshc-pre">{state.message}</pre>
        </details>
      )
  }
}
