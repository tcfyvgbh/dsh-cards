import type { ChartNode } from '../../spec/types.ts'
import { Axes } from './Axes.tsx'
import { seriesColor } from './palette.ts'
import { FRAME, niceDomain, scaleY } from './scale.ts'

export function BarChart({ node }: { readonly node: ChartNode }) {
  const domain = niceDomain(node.series.flatMap(entry => entry.data))
  const y = scaleY(domain)
  const inner = FRAME.width - FRAME.left - FRAME.right
  const band = inner / node.labels.length
  const pad = band * 0.2
  const barWidth = (band - pad) / node.series.length
  const zero = y(0)
  const xOf = (index: number): number => FRAME.left + index * band + band / 2
  return (
    <svg className="dshc-chart-svg" viewBox={`0 0 ${FRAME.width} ${FRAME.height}`} role="img" aria-label={node.title ?? '柱状图'}>
      <Axes domain={domain} labels={node.labels} xOf={xOf} />
      {node.series.map((entry, seriesIndex) => entry.data.map((value, index) => (
        <rect
          key={`${seriesIndex}-${index}`}
          className="dshc-bar-rect"
          x={FRAME.left + index * band + pad / 2 + seriesIndex * barWidth}
          y={Math.min(y(value), zero)}
          width={Math.max(barWidth - 1, 1)}
          height={Math.abs(y(value) - zero)}
          fill={seriesColor(seriesIndex)}
        >
          <title>{`${entry.name} · ${node.labels[index]}: ${value}`}</title>
        </rect>
      )))}
    </svg>
  )
}
