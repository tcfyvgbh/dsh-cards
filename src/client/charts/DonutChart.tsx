import type { ChartNode } from '../../spec/types.ts'
import { seriesColor } from './palette.ts'

const RADIUS = 70
const WIDTH = 22
const CIRCUMFERENCE = 2 * Math.PI * RADIUS

export function DonutChart({ node }: { readonly node: ChartNode }) {
  const data = node.series[0]?.data ?? []
  const total = data.reduce((sum, value) => sum + value, 0)
  const lengths = data.map(value => (total === 0 ? 0 : (value / total) * CIRCUMFERENCE))
  const offsets = lengths.map((_, index) => lengths.slice(0, index).reduce((sum, length) => sum + length, 0))
  return (
    <svg className="dshc-chart-svg dshc-donut" viewBox="0 0 200 200" role="img" aria-label={node.title ?? '环形图'}>
      {lengths.map((length, index) => (length === 0 ? null : (
        <circle
          key={index}
          className="dshc-slice"
          cx={100}
          cy={100}
          r={RADIUS}
          fill="none"
          stroke={seriesColor(index)}
          strokeWidth={WIDTH}
          strokeDasharray={`${length} ${CIRCUMFERENCE - length}`}
          strokeDashoffset={-(offsets[index] ?? 0)}
          transform="rotate(-90 100 100)"
        >
          <title>{`${node.labels[index]}: ${data[index]}`}</title>
        </circle>
      )))}
    </svg>
  )
}
