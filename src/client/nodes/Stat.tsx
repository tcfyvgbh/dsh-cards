import type { StatNode } from '../../spec/types.ts'
import { deltaTone } from '../format.ts'
import { renderInline } from '../inline.tsx'

const round = (value: number): number => Math.round(value * 100) / 100

/** Polyline points in a width x height box with 2px vertical padding. */
export function sparkPoints(values: readonly number[], width = 100, height = 24): string {
  const min = Math.min(...values)
  const span = Math.max(...values) - min
  return values.map((value, index) => {
    const x = values.length === 1 ? width / 2 : (index / (values.length - 1)) * width
    const y = span === 0 ? height / 2 : height - 2 - ((value - min) / span) * (height - 4)
    return `${round(x)},${round(y)}`
  }).join(' ')
}

export function Sparkline({ values }: { readonly values: readonly number[] }) {
  return (
    <svg className="dshc-spark" viewBox="0 0 100 24" preserveAspectRatio="none" aria-hidden="true">
      <polyline points={sparkPoints(values)} />
    </svg>
  )
}

export function Stat({ node }: { readonly node: StatNode }) {
  const tone = node.delta === undefined ? 'neutral' : deltaTone(node.delta, node.better ?? 'up')
  return (
    <div className="dshc-stat">
      <div className="dshc-stat-label">{renderInline(node.label)}</div>
      <div className="dshc-stat-value">{String(node.value)}</div>
      {node.delta !== undefined && <div className={`dshc-delta dshc-delta-${tone}`}>{node.delta}</div>}
      {node.spark !== undefined && <Sparkline values={node.spark} />}
    </div>
  )
}
