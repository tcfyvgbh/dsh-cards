// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { Stat, sparkPoints } from '../src/client/nodes/Stat.tsx'
import { Table, nextSort, sortRows } from '../src/client/nodes/Table.tsx'
import type { TableNode } from '../src/spec/types.ts'

afterEach(cleanup)

describe('Stat', () => {
  it('colors delta by the better direction and draws a sparkline', () => {
    const { container } = render(<Stat node={{ type: 'stat', label: 'P95', value: '104 ms', delta: '-8.3%', better: 'down', spark: [132, 118, 104] }} />)
    expect(screen.getByText('-8.3%').className).toContain('dshc-delta-good')
    expect(container.querySelector('.dshc-spark polyline')?.getAttribute('points')).toBe(sparkPoints([132, 118, 104]))
  })

  it('computes spark points and handles flat data', () => {
    expect(sparkPoints([1, 2, 3])).toBe('0,22 50,12 100,2')
    expect(sparkPoints([5, 5])).toBe('0,12 100,12')
  })

  it('omits delta and sparkline when absent', () => {
    const { container } = render(<Stat node={{ type: 'stat', label: '在线', value: 12 }} />)
    expect(container.querySelector('.dshc-delta')).toBeNull()
    expect(container.querySelector('.dshc-spark')).toBeNull()
    expect(screen.getByText('12')).toBeTruthy()
  })
})

describe('table sorting helpers', () => {
  it('cycles asc, desc, none on the same column and resets on a new one', () => {
    const asc = nextSort(null, 1)
    expect(asc).toEqual({ column: 1, direction: 'asc' })
    const desc = nextSort(asc, 1)
    expect(desc).toEqual({ column: 1, direction: 'desc' })
    expect(nextSort(desc, 1)).toBeNull()
    expect(nextSort(desc, 2)).toEqual({ column: 2, direction: 'asc' })
  })

  it('keeps placeholders last in both directions and does not mutate input (Review Focus 2)', () => {
    const rows = [['a', '8,420'], ['b', '—'], ['c', '12,860'], ['d', '156']] as const
    const ascending = sortRows(rows, { column: 1, direction: 'asc' }).map(row => row[0])
    const descending = sortRows(rows, { column: 1, direction: 'desc' }).map(row => row[0])
    expect(ascending).toEqual(['d', 'a', 'c', 'b'])
    expect(descending).toEqual(['c', 'a', 'd', 'b'])
    expect(rows.map(row => row[0])).toEqual(['a', 'b', 'c', 'd'])
  })

  it('sorts text containing digits as text (Review Focus 3)', () => {
    const rows = [['v2-api'], ['auth'], ['v10-api']] as const
    expect(sortRows(rows, { column: 0, direction: 'asc' }).map(row => row[0])).toEqual(['auth', 'v10-api', 'v2-api'])
  })
})

describe('Table', () => {
  const node: TableNode = {
    type: 'table',
    columns: ['服务', 'QPS', '可用率', '状态'],
    types: ['text', 'num', 'bar', 'badge'],
    rows: [['gateway', '8,420', '99.52%', '故障'], ['search', '15,430', '99.88%', '正常'], ['report', '1,180', '99.98%', '正常']],
  }

  const firstColumn = () => Array.from(document.querySelectorAll('tbody tr td:first-child')).map(cell => cell.textContent)

  it('sorts by clicking a header and exposes aria-sort', () => {
    render(<Table node={node} />)
    fireEvent.click(screen.getByRole('button', { name: /QPS/ }))
    expect(firstColumn()).toEqual(['report', 'gateway', 'search'])
    expect(screen.getByRole('columnheader', { name: /QPS/ }).getAttribute('aria-sort')).toBe('ascending')
    fireEvent.click(screen.getByRole('button', { name: /QPS/ }))
    expect(firstColumn()).toEqual(['search', 'gateway', 'report'])
    fireEvent.click(screen.getByRole('button', { name: /QPS/ }))
    expect(firstColumn()).toEqual(['gateway', 'search', 'report'])
  })

  it('renders bar and badge columns', () => {
    const { container } = render(<Table node={node} />)
    expect((container.querySelector('.dshc-bar-fill') as HTMLElement).style.width).toBe('99.52%')
    expect(screen.getByText('故障').className).toContain('dshc-badge')
  })

  it('renders plain headers when sortable is false, and an empty body for no rows', () => {
    const { container } = render(<Table node={{ type: 'table', columns: ['a'], rows: [], sortable: false }} />)
    expect(screen.queryByRole('button')).toBeNull()
    expect(container.querySelectorAll('tbody tr')).toHaveLength(0)
  })
})
