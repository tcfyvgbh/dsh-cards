import type { BadgeTone, CalloutNode, KeyValueNode, ListNode, TextNode } from '../../spec/types.ts'
import { renderInline } from '../inline.tsx'

export function TextBlock({ node }: { readonly node: TextNode }) {
  const content = renderInline(node.text)
  if (node.variant === 'h2') return <h2 className="dshc-h2">{content}</h2>
  if (node.variant === 'h3') return <h3 className="dshc-h3">{content}</h3>
  return <p className={node.variant === 'muted' ? 'dshc-text dshc-muted' : 'dshc-text'}>{content}</p>
}

export function Callout({ node }: { readonly node: CalloutNode }) {
  return (
    <div className={`dshc-callout dshc-tone-${node.tone}`} role="note">
      {node.title !== undefined && <div className="dshc-callout-title">{renderInline(node.title)}</div>}
      <div>{renderInline(node.content)}</div>
    </div>
  )
}

export function ListBlock({ node }: { readonly node: ListNode }) {
  const items = node.items.map((item, index) => <li key={index}>{renderInline(item)}</li>)
  return node.ordered === true ? <ol className="dshc-list">{items}</ol> : <ul className="dshc-list">{items}</ul>
}

export function KeyValue({ node }: { readonly node: KeyValueNode }) {
  return (
    <dl className="dshc-kv">
      {node.pairs.map((pair, index) => (
        <div key={index} className="dshc-kv-row">
          <dt>{renderInline(pair.key)}</dt>
          <dd>{typeof pair.value === 'number' ? String(pair.value) : renderInline(pair.value)}</dd>
        </div>
      ))}
    </dl>
  )
}

export function Badge({ text, tone }: { readonly text: string; readonly tone?: BadgeTone }) {
  return <span className={`dshc-badge dshc-tone-${tone ?? 'neutral'}`}>{text}</span>
}
