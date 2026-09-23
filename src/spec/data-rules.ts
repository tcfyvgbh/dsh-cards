import { LIMITS, type Cell, type ChartNode, type ChartSeries, type StatNode, type TableNode } from './types.ts'
import {
  bool, cell, describe, each, fail, isRecord, list, num, object, ok, oneOf, optional, str,
  type Checked, type Rule, type SpecError,
} from './check.ts'

const COLUMN_TYPES = ['text', 'num', 'bar', 'badge'] as const
const CHART_KINDS = ['line', 'bar', 'donut'] as const
const DIRECTIONS = ['up', 'down'] as const

/** Run cross-field checks only once every field passed on its own. */
function withCrossChecks<T>(base: Checked<T>, cross: (value: T) => readonly SpecError[]): Checked<T> {
  if (base.value === undefined) return base
  const errors = cross(base.value)
  return errors.length > 0 ? { errors } : base
}

function spark(value: unknown, path: string): Checked<readonly number[]> {
  return each(list(value, path, { min: 2, max: LIMITS.points, noun: '数据点' }), path, num)
}

const stat: Rule = (v, p) => object<StatNode>({
  type: ok('stat'),
  label: str(v.label, `${p}.label`),
  value: cell(v.value, `${p}.value`),
  delta: optional(v.delta, `${p}.delta`, str),
  spark: optional(v.spark, `${p}.spark`, spark),
  better: optional(v.better, `${p}.better`, (x, q) => oneOf(x, DIRECTIONS, q)),
})

function tableRow(value: unknown, path: string): Checked<readonly Cell[]> {
  return each(list(value, path, { min: 1, max: LIMITS.columns, noun: '单元格' }), path, cell)
}

const table: Rule = (v, p) => withCrossChecks(object<TableNode>({
  type: ok('table'),
  columns: each(list(v.columns, `${p}.columns`, { min: 1, max: LIMITS.columns, noun: '列' }), `${p}.columns`, str),
  rows: each(list(v.rows, `${p}.rows`, { min: 0, max: LIMITS.rows, noun: '行' }), `${p}.rows`, tableRow),
  types: optional(v.types, `${p}.types`, (x, q) => each(
    list(x, q, { min: 1, max: LIMITS.columns, noun: '列类型' }),
    q,
    (y, r) => oneOf(y, COLUMN_TYPES, r),
  )),
  sortable: optional(v.sortable, `${p}.sortable`, bool),
}), node => [
  ...node.rows.flatMap((cells, index) => cells.length === node.columns.length
    ? []
    : [{ path: `${p}.rows[${index}]`, message: `列数应为 ${node.columns.length}，实际 ${cells.length}` }]),
  ...(node.types !== undefined && node.types.length !== node.columns.length
    ? [{ path: `${p}.types`, message: `长度应为 ${node.columns.length}（与 columns 一致），实际 ${node.types.length}` }]
    : []),
])

function series(value: unknown, path: string): Checked<ChartSeries> {
  if (!isRecord(value)) return fail(path, `应为对象，收到 ${describe(value)}`)
  return object<ChartSeries>({
    name: str(value.name, `${path}.name`),
    data: each(list(value.data, `${path}.data`, { min: 1, max: LIMITS.points, noun: '数据点' }), `${path}.data`, num),
  })
}

const chart: Rule = (v, p) => withCrossChecks(object<ChartNode>({
  type: ok('chart'),
  kind: oneOf(v.kind, CHART_KINDS, `${p}.kind`),
  title: optional(v.title, `${p}.title`, str),
  labels: each(list(v.labels, `${p}.labels`, { min: 1, max: LIMITS.points, noun: '标签' }), `${p}.labels`, str),
  series: each(list(v.series, `${p}.series`, { min: 1, max: LIMITS.series, noun: '数据系列' }), `${p}.series`, series),
}), node => {
  const lengthErrors = node.series.flatMap((entry, index) => entry.data.length === node.labels.length
    ? []
    : [{ path: `${p}.series[${index}].data`, message: `长度应为 ${node.labels.length}（与 labels 一致），实际 ${entry.data.length}` }])
  if (node.kind !== 'donut' || lengthErrors.length > 0) return lengthErrors
  const data = node.series[0]?.data ?? []
  if (data.some(value => value < 0)) return [{ path: `${p}.series[0].data`, message: 'donut 的数值不能为负' }]
  if (data.every(value => value === 0)) return [{ path: `${p}.series[0].data`, message: 'donut 的数值不能全为 0' }]
  return []
})

export const DATA_RULES: Readonly<Record<string, Rule>> = { stat, table, chart }
