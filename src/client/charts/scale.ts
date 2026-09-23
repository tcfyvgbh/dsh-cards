export interface Frame {
  readonly width: number
  readonly height: number
  readonly left: number
  readonly right: number
  readonly top: number
  readonly bottom: number
}

export const FRAME: Frame = { width: 600, height: 220, left: 48, right: 12, top: 12, bottom: 28 }

const MIN_WIDTH = 240
/** Horizontal room one x-axis label needs at the 11px tick font size. */
const LABEL_SLOT = 48

/** A frame whose viewBox width equals the rendered pixel width, so SVG text stays at its CSS size. */
export function frameFor(width: number): Frame {
  return { ...FRAME, width: Math.max(MIN_WIDTH, Math.round(width)) }
}

/** How many x-axis labels fit without overlapping. */
export function maxLabelsFor(frame: Frame): number {
  return Math.max(2, Math.floor((frame.width - frame.left - frame.right) / LABEL_SLOT))
}

export interface Domain { readonly lo: number; readonly hi: number; readonly step: number }

export function niceStep(raw: number): number {
  if (!(raw > 0)) return 1
  const power = 10 ** Math.floor(Math.log10(raw))
  const fraction = raw / power
  const nice = fraction <= 1 ? 1 : fraction <= 2 ? 2 : fraction <= 5 ? 5 : 10
  return nice * power
}

/** Always includes zero so bars and lines share a baseline. */
export function niceDomain(values: readonly number[]): Domain {
  const low = Math.min(0, ...values)
  const high = Math.max(0, ...values)
  if (low === high) return { lo: 0, hi: 1, step: 0.25 }
  const step = niceStep((high - low) / 4)
  return { lo: Math.floor(low / step) * step, hi: Math.ceil(high / step) * step, step }
}

export function ticks(domain: Domain): readonly number[] {
  const count = Math.round((domain.hi - domain.lo) / domain.step)
  return Array.from({ length: count + 1 }, (_, index) => Number((domain.lo + index * domain.step).toPrecision(12)))
}

export function scaleY(domain: Domain, frame: Frame = FRAME): (value: number) => number {
  const span = frame.height - frame.top - frame.bottom
  return value => frame.top + (1 - (value - domain.lo) / (domain.hi - domain.lo)) * span
}

export function labelStride(count: number, maxLabels = 8): number {
  return Math.max(1, Math.ceil(count / maxLabels))
}

export function formatTick(value: number): string {
  const abs = Math.abs(value)
  if (abs >= 1e6) return `${Number((value / 1e6).toFixed(1))}M`
  if (abs >= 1e3) return `${Number((value / 1e3).toFixed(1))}k`
  return String(Number(value.toFixed(2)))
}
