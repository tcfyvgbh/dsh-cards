import { describe, expect, it } from 'vitest'
import { validateSpec } from '../src/spec/validate.ts'

function errorsOf(items: readonly unknown[]): readonly string[] {
  const result = validateSpec({ items })
  return result.ok ? [] : result.errors.map(error => `${error.path}: ${error.message}`)
}

describe('stat', () => {
  it('accepts a full stat', () => {
    expect(errorsOf([{ type: 'stat', label: 'P95', value: '104 ms', delta: '-8.3%', better: 'down', spark: [132, 128, 104] }])).toEqual([])
  })

  it('requires spark to have at least two finite numbers', () => {
    expect(errorsOf([{ type: 'stat', label: 'x', value: 1, spark: [1] }])).toEqual(['items[0].spark: 至少需要 2 个数据点'])
    expect(errorsOf([{ type: 'stat', label: 'x', value: 1, spark: [1, '2'] }])).toEqual(['items[0].spark[1]: 应为数字，收到 "2"'])
  })

  it('validates better', () => {
    expect(errorsOf([{ type: 'stat', label: 'x', value: 1, better: 'lower' }])).toEqual(['items[0].better: 只允许 up | down，收到 "lower"'])
  })
})

describe('table', () => {
  const columns = ['服务', '负责人', 'QPS', 'P95', '错误率', '可用率', '状态']

  it('reports rows whose length differs from columns', () => {
    const good = ['a', 'b', 1, '2 ms', '0.1%', '99%', '正常']
    expect(errorsOf([{ type: 'table', columns, rows: [good, good, good, good.slice(0, 6)] }]))
      .toEqual(['items[0].rows[3]: 列数应为 7，实际 6'])
  })

  it('requires types to match the number of columns', () => {
    expect(errorsOf([{ type: 'table', columns: ['a', 'b'], rows: [], types: ['text'] }]))
      .toEqual(['items[0].types: 长度应为 2（与 columns 一致），实际 1'])
  })

  it('accepts an empty table and rejects unknown column types', () => {
    expect(errorsOf([{ type: 'table', columns: ['a'], rows: [] }])).toEqual([])
    expect(errorsOf([{ type: 'table', columns: ['a'], rows: [], types: ['money'] }]))
      .toEqual(['items[0].types[0]: 只允许 text | num | bar | badge，收到 "money"'])
  })

  it('enforces row and column limits', () => {
    const rows = Array.from({ length: 201 }, () => ['x'])
    expect(errorsOf([{ type: 'table', columns: ['a'], rows }])).toEqual(['items[0].rows: 行数量 201 超过上限 200'])
    const columns13 = Array.from({ length: 13 }, (_, i) => `c${i}`)
    expect(errorsOf([{ type: 'table', columns: columns13, rows: [] }])).toEqual(['items[0].columns: 列数量 13 超过上限 12'])
  })
})

describe('chart', () => {
  it('reports an unsupported kind with the spec example message', () => {
    expect(errorsOf([{ type: 'card', items: [
      { type: 'text', text: 'x' },
      { type: 'chart', kind: 'pie', labels: ['a'], series: [{ name: 's', data: [1] }] },
    ] }])).toEqual(['items[0].items[1].kind: 只允许 line | bar | donut，收到 "pie"'])
  })

  it('requires every series to match the labels length', () => {
    expect(errorsOf([{ type: 'chart', kind: 'line', labels: ['a', 'b'], series: [{ name: 's', data: [1] }] }]))
      .toEqual(['items[0].series[0].data: 长度应为 2（与 labels 一致），实际 1'])
  })

  it('rejects negative or all-zero donut data', () => {
    expect(errorsOf([{ type: 'chart', kind: 'donut', labels: ['a', 'b'], series: [{ name: 's', data: [1, -1] }] }]))
      .toEqual(['items[0].series[0].data: donut 的数值不能为负'])
    expect(errorsOf([{ type: 'chart', kind: 'donut', labels: ['a'], series: [{ name: 's', data: [0] }] }]))
      .toEqual(['items[0].series[0].data: donut 的数值不能全为 0'])
  })

  it('limits series count', () => {
    const series = Array.from({ length: 7 }, (_, i) => ({ name: `s${i}`, data: [1] }))
    expect(errorsOf([{ type: 'chart', kind: 'bar', labels: ['a'], series }])).toEqual(['items[0].series: 数据系列数量 7 超过上限 6'])
  })
})
