import { useState, type ReactNode } from 'react'
import type { Cell, ColumnType, TableNode } from '../../spec/types.ts'
import { compareCells, percentOf } from '../format.ts'
import { renderInline } from '../inline.tsx'
import { Badge } from './Text.tsx'

export type SortState = { readonly column: number; readonly direction: 'asc' | 'desc' } | null

/** Same column: asc -> desc -> original order. New column: asc. */
export function nextSort(current: SortState, column: number): SortState {
  if (current === null || current.column !== column) return { column, direction: 'asc' }
  return current.direction === 'asc' ? { column, direction: 'desc' } : null
}

export function sortRows(rows: readonly (readonly Cell[])[], sort: SortState): readonly (readonly Cell[])[] {
  if (sort === null) return rows
  const sign = sort.direction === 'asc' ? 1 : -1
  return rows.toSorted((a, b) => compareCells(a[sort.column] ?? '', b[sort.column] ?? '', sign))
}

function renderCell(cell: Cell, type: ColumnType): ReactNode {
  if (type === 'bar') {
    return (
      <span className="dshc-bar-cell">
        <span className="dshc-bar" aria-hidden="true">
          <span className="dshc-bar-fill" style={{ width: `${percentOf(cell)}%` }} />
        </span>
        <span>{String(cell)}</span>
      </span>
    )
  }
  if (type === 'badge') return <Badge text={String(cell)} />
  return typeof cell === 'number' ? String(cell) : renderInline(cell)
}

export function Table({ node }: { readonly node: TableNode }) {
  const [sort, setSort] = useState<SortState>(null)
  const sortable = node.sortable !== false
  const typeOf = (column: number): ColumnType => node.types?.[column] ?? 'text'
  const numClass = (column: number): string | undefined => (typeOf(column) === 'num' ? 'dshc-num' : undefined)
  const rows = sortRows(node.rows, sort)
  return (
    <div className="dshc-table-wrap">
      <table className="dshc-table">
        <thead>
          <tr>
            {node.columns.map((column, index) => {
              const direction = sort !== null && sort.column === index ? sort.direction : undefined
              const ariaSort = direction === undefined ? undefined : direction === 'asc' ? 'ascending' : 'descending'
              const mark = direction === undefined ? '' : direction === 'asc' ? '↑' : '↓'
              return (
                <th key={index} scope="col" aria-sort={ariaSort} className={numClass(index)}>
                  {sortable
                    ? (
                        <button type="button" className="dshc-sort" onClick={() => setSort(current => nextSort(current, index))}>
                          {column}<span className="dshc-sort-mark">{mark}</span>
                        </button>
                      )
                    : column}
                </th>
              )
            })}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, rowIndex) => (
            <tr key={rowIndex}>
              {row.map((cell, column) => <td key={column} className={numClass(column)}>{renderCell(cell, typeOf(column))}</td>)}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
