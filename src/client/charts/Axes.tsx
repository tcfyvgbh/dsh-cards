import { formatTick, labelStride, maxLabelsFor, scaleY, ticks, type Domain, type Frame } from './scale.ts'

export function Axes({ frame, domain, labels, xOf }: {
  readonly frame: Frame
  readonly domain: Domain
  readonly labels: readonly string[]
  readonly xOf: (index: number) => number
}) {
  const y = scaleY(domain, frame)
  const stride = labelStride(labels.length, maxLabelsFor(frame))
  return (
    <g className="dshc-axes">
      {ticks(domain).map(tick => (
        <g key={tick}>
          <line className={tick === 0 ? 'dshc-gridline dshc-zero' : 'dshc-gridline'} x1={frame.left} x2={frame.width - frame.right} y1={y(tick)} y2={y(tick)} />
          <text className="dshc-tick" x={frame.left - 6} y={y(tick)} textAnchor="end" dominantBaseline="middle">{formatTick(tick)}</text>
        </g>
      ))}
      {labels.map((label, index) => (index % stride === 0
        ? (
            <text key={index} className="dshc-tick dshc-xlabel" x={xOf(index)} y={frame.height - 8}
              textAnchor={xOf(index) >= frame.width - frame.right ? 'end' : 'middle'}>{label}</text>
          )
        : null))}
    </g>
  )
}
