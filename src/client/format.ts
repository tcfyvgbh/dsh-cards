import type { Cell } from '../spec/types.ts'

/**
 * A cell is numeric only when the whole value is a number plus an optional unit:
 * "412 ms", "4.80%", "3,231/min", "+0.06pp" yes; "2026-09-23", "09:30", "1.10.0", "v2-api" no.
 */
const WHOLE_NUMBER = /^[+\-−]?[¥$€]?\s*(\d[\d,]*(?:\.\d+)?|\.\d+)\s*(?:%|[A-Za-zµ/]+)?$/

export function numericValue(cell: Cell): number | undefined {
  if (typeof cell === 'number') return cell
  const trimmed = cell.trim()
  const match = WHOLE_NUMBER.exec(trimmed)
  if (match === null || match[1] === undefined) return undefined
  const sign = trimmed.startsWith('-') || trimmed.startsWith('−') ? -1 : 1
  return sign * Number(match[1].replace(/,/g, ''))
}

/** Numbers sort by value in `sign` direction; non-numeric cells always come last, in natural order. */
export function compareCells(a: Cell, b: Cell, sign: 1 | -1): number {
  const left = numericValue(a)
  const right = numericValue(b)
  if (left !== undefined && right !== undefined) return sign * (left - right)
  if (left !== undefined) return -1
  if (right !== undefined) return 1
  return sign * String(a).localeCompare(String(b), 'zh-CN', { numeric: true })
}

export function deltaDirection(delta: string): 'up' | 'down' | 'flat' {
  const trimmed = delta.trim()
  if (trimmed.startsWith('+')) return 'up'
  if (trimmed.startsWith('-') || trimmed.startsWith('−')) return 'down'
  return 'flat'
}

export function deltaTone(delta: string, better: 'up' | 'down'): 'good' | 'bad' | 'neutral' {
  const direction = deltaDirection(delta)
  if (direction === 'flat') return 'neutral'
  return direction === better ? 'good' : 'bad'
}

export function percentOf(cell: Cell): number {
  const value = numericValue(cell) ?? 0
  return Math.min(100, Math.max(0, value))
}
