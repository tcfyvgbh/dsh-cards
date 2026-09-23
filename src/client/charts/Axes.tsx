import { FRAME, formatTick, labelStride, scaleY, ticks, type Domain } from './scale.ts'

export function Axes({ domain, labels, xOf }: {
  readonly domain: Domain
  readonly labels: readonly string[]
  readonly xOf: (index: number) => number
}) {
  const y = scaleY(domain)
  const stride = labelStride(labels.length)
  return (
    <g className="dshc-axes">
      {ticks(domain).map(tick => (
        <g key={tick}>
          <line className={tick === 0 ? 'dshc-gridline dshc-zero' : 'dshc-gridline'} x1={FRAME.left} x2={FRAME.width - FRAME.right} y1={y(tick)} y2={y(tick)} />
          <text className="dshc-tick" x={FRAME.left - 6} y={y(tick)} textAnchor="end" dominantBaseline="middle">{formatTick(tick)}</text>
        </g>
      ))}
      {labels.map((label, index) => (index % stride === 0
        ? <text key={index} className="dshc-tick" x={xOf(index)} y={FRAME.height - 8} textAnchor="middle">{label}</text>
        : null))}
    </g>
  )
}
