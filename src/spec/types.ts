/** Component protocol for render_cards; see docs/specs/2026-09-23-dsh-cards-design.md section 3. */

export type Tone = 'info' | 'success' | 'warning' | 'error'
export type BadgeTone = 'neutral' | Tone
export type TextVariant = 'h2' | 'h3' | 'body' | 'muted'
export type ColumnType = 'text' | 'num' | 'bar' | 'badge'
export type ChartKind = 'line' | 'bar' | 'donut'
export type Cell = string | number

export interface RowNode { readonly type: 'row'; readonly items: readonly Node[] }
export interface GridNode { readonly type: 'grid'; readonly cols: number; readonly items: readonly Node[] }
export interface CardNode { readonly type: 'card'; readonly title?: string; readonly items: readonly Node[] }
export interface TextNode { readonly type: 'text'; readonly text: string; readonly variant?: TextVariant }
export interface CalloutNode { readonly type: 'callout'; readonly tone: Tone; readonly title?: string; readonly content: string }
export interface ListNode { readonly type: 'list'; readonly items: readonly string[]; readonly ordered?: boolean }
export interface KeyValuePair { readonly key: string; readonly value: Cell }
export interface KeyValueNode { readonly type: 'keyvalue'; readonly pairs: readonly KeyValuePair[] }
export interface BadgeNode { readonly type: 'badge'; readonly text: string; readonly tone?: BadgeTone }
export interface StatNode {
  readonly type: 'stat'
  readonly label: string
  readonly value: Cell
  readonly delta?: string
  readonly spark?: readonly number[]
  readonly better?: 'up' | 'down'
}
export interface TableNode {
  readonly type: 'table'
  readonly columns: readonly string[]
  readonly rows: readonly (readonly Cell[])[]
  readonly types?: readonly ColumnType[]
  readonly sortable?: boolean
}
export interface ChartSeries { readonly name: string; readonly data: readonly number[] }
export interface ChartNode {
  readonly type: 'chart'
  readonly kind: ChartKind
  readonly title?: string
  readonly labels: readonly string[]
  readonly series: readonly ChartSeries[]
}

export type Node =
  | RowNode | GridNode | CardNode
  | TextNode | CalloutNode | ListNode | KeyValueNode | BadgeNode
  | StatNode | TableNode | ChartNode

export interface Spec { readonly title?: string; readonly items: readonly Node[] }

export const LIMITS = {
  depth: 4,
  nodes: 200,
  rows: 200,
  columns: 12,
  series: 6,
  points: 100,
  text: 2000,
} as const
