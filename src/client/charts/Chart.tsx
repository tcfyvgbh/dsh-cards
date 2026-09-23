import type { ChartNode } from '../../spec/types.ts'
import { renderInline } from '../inline.tsx'
import { BarChart } from './BarChart.tsx'
import { DonutChart } from './DonutChart.tsx'
import { LineChart } from './LineChart.tsx'
import { seriesColor } from './palette.ts'

interface LegendEntry { readonly label: string; readonly color: string }

function legendOf(node: ChartNode): readonly LegendEntry[] {
  if (node.kind === 'donut') {
    const data = node.series[0]?.data ?? []
    const total = data.reduce((sum, value) => sum + value, 0)
    return node.labels.map((label, index) => {
      const value = data[index] ?? 0
      const percent = total === 0 ? 0 : Math.round((value / total) * 100)
      return { label: `${label} ${value}（${percent}%）`, color: seriesColor(index) }
    })
  }
  return node.series.length > 1 ? node.series.map((entry, index) => ({ label: entry.name, color: seriesColor(index) })) : []
}

export function Chart({ node }: { readonly node: ChartNode }) {
  const legend = legendOf(node)
  const body = node.kind === 'line' ? <LineChart node={node} /> : node.kind === 'bar' ? <BarChart node={node} /> : <DonutChart node={node} />
  return (
    <figure className="dshc-chart">
      {node.title !== undefined && <figcaption className="dshc-chart-title">{renderInline(node.title)}</figcaption>}
      {body}
      {legend.length > 0 && (
        <ul className="dshc-legend">
          {legend.map((entry, index) => (
            <li key={index}><span className="dshc-swatch" style={{ background: entry.color }} />{entry.label}</li>
          ))}
        </ul>
      )}
    </figure>
  )
}
