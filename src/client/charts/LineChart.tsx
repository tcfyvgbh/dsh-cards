import type { ChartNode } from '../../spec/types.ts'
import { Axes } from './Axes.tsx'
import { seriesColor } from './palette.ts'
import { frameFor, niceDomain, scaleY } from './scale.ts'

export function LineChart({ node, width }: { readonly node: ChartNode; readonly width: number }) {
  const frame = frameFor(width)
  const domain = niceDomain(node.series.flatMap(entry => entry.data))
  const y = scaleY(domain, frame)
  const inner = frame.width - frame.left - frame.right
  const xOf = (index: number): number => (node.labels.length === 1
    ? frame.left + inner / 2
    : frame.left + (index / (node.labels.length - 1)) * inner)
  return (
    <svg className="dshc-chart-svg" viewBox={`0 0 ${frame.width} ${frame.height}`} role="img" aria-label={node.title ?? '折线图'}>
      <Axes frame={frame} domain={domain} labels={node.labels} xOf={xOf} />
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
