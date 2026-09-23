import type { ChartNode } from '../../spec/types.ts'
import { Axes } from './Axes.tsx'
import { seriesColor } from './palette.ts'
import { FRAME, niceDomain, scaleY } from './scale.ts'

export function LineChart({ node }: { readonly node: ChartNode }) {
  const domain = niceDomain(node.series.flatMap(entry => entry.data))
  const y = scaleY(domain)
  const inner = FRAME.width - FRAME.left - FRAME.right
  const xOf = (index: number): number => (node.labels.length === 1
    ? FRAME.left + inner / 2
    : FRAME.left + (index / (node.labels.length - 1)) * inner)
  return (
    <svg className="dshc-chart-svg" viewBox={`0 0 ${FRAME.width} ${FRAME.height}`} role="img" aria-label={node.title ?? '折线图'}>
      <Axes domain={domain} labels={node.labels} xOf={xOf} />
      {node.series.map((entry, seriesIndex) => (
        <g key={seriesIndex} style={{ color: seriesColor(seriesIndex) }}>
          <polyline className="dshc-line" points={entry.data.map((value, index) => `${xOf(index)},${y(value)}`).join(' ')} />
          {entry.data.map((value, index) => (
            <circle key={index} className="dshc-dot" cx={xOf(index)} cy={y(value)} r={3}>
              <title>{`${entry.name} · ${node.labels[index]}: ${value}`}</title>
            </circle>
          ))}
        </g>
      ))}
    </svg>
  )
}
