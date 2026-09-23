import type { Cell } from '../spec/types.ts'

/** A cell counts as numeric only when it starts with a number: "412 ms" yes, "v2-api" no. */
const LEADING_NUMBER = /^[+\-−]?[¥$€]?\s*(\d[\d,]*(?:\.\d+)?|\.\d+)/

export function numericValue(cell: Cell): number | undefined {
  if (typeof cell === 'number') return cell
  const trimmed = cell.trim()
  const match = LEADING_NUMBER.exec(trimmed)
  if (match === null || match[1] === undefined) return undefined
  const sign = trimmed.startsWith('-') || trimmed.startsWith('−') ? -1 : 1
  return sign * Number(match[1].replace(/,/g, ''))
}

/** Numbers sort by value in `sign` direction; non-numeric cells always come last. */
export function compareCells(a: Cell, b: Cell, sign: 1 | -1): number {
  const left = numericValue(a)
  const right = numericValue(b)
  if (left !== undefined && right !== undefined) return sign * (left - right)
  if (left !== undefined) return -1
  if (right !== undefined) return 1
  return sign * String(a).localeCompare(String(b), 'zh-CN')
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
