// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { renderInline } from '../src/client/inline.tsx'
import { compareCells, deltaDirection, deltaTone, numericValue, percentOf } from '../src/client/format.ts'
import { CardsBody } from '../src/client/render.tsx'

afterEach(cleanup)

describe('renderInline', () => {
  it('renders code and bold, leaves other markup as text', () => {
    const { container } = render(<p>{renderInline('用 `ls` 查看 **全部**，<b>x</b> 保持原样')}</p>)
    expect(container.querySelector('code')?.textContent).toBe('ls')
    expect(container.querySelector('strong')?.textContent).toBe('全部')
    expect(container.querySelector('b')).toBeNull()
    expect(container.textContent).toContain('<b>x</b> 保持原样')
  })
})

describe('format helpers', () => {
  it('extracts leading numbers only', () => {
    expect(numericValue('8,420')).toBe(8420)
    expect(numericValue('412 ms')).toBe(412)
    expect(numericValue('4.80%')).toBe(4.8)
    expect(numericValue('-8.4%')).toBe(-8.4)
    expect(numericValue('−3')).toBe(-3)
    expect(numericValue('v2-api')).toBeUndefined()
    expect(numericValue('—')).toBeUndefined()
    expect(numericValue(7)).toBe(7)
  })

  it('compares numbers before text regardless of direction', () => {
    expect(compareCells('10', '9', 1)).toBeGreaterThan(0)
    expect(compareCells('10', '9', -1)).toBeLessThan(0)
    expect(compareCells('—', '9', 1)).toBeGreaterThan(0)
    expect(compareCells('—', '9', -1)).toBeGreaterThan(0)
  })

  it('classifies deltas', () => {
    expect(deltaDirection('+6.8%')).toBe('up')
    expect(deltaDirection('-8.3%')).toBe('down')
    expect(deltaDirection('0')).toBe('flat')
    expect(deltaTone('-8.3%', 'down')).toBe('good')
    expect(deltaTone('+0.6pp', 'down')).toBe('bad')
    expect(deltaTone('+6.8%', 'up')).toBe('good')
    expect(deltaTone('0', 'up')).toBe('neutral')
  })

  it('clamps percentages', () => {
    expect(percentOf('99.5%')).toBe(99.5)
    expect(percentOf(140)).toBe(100)
    expect(percentOf('n/a')).toBe(0)
  })
})

describe('CardsBody with layout and text nodes', () => {
  it('renders title, headings, callout, lists, keyvalue and badge', () => {
    render(<CardsBody spec={{
      title: '交付',
      items: [
        { type: 'text', text: '概览', variant: 'h2' },
        { type: 'grid', cols: 2, items: [
          { type: 'card', title: '左', items: [{ type: 'text', text: '说明', variant: 'muted' }] },
          { type: 'row', items: [{ type: 'badge', text: '正常', tone: 'success' }] },
        ] },
        { type: 'callout', tone: 'warning', title: '注意', content: '`auth` 偏高' },
        { type: 'list', items: ['一', '二'], ordered: true },
        { type: 'keyvalue', pairs: [{ key: '文件', value: 'calculator.html' }, { key: '行数', value: 798 }] },
      ],
    }} />)
    expect(screen.getByText('交付')).toBeTruthy()
    expect(screen.getByRole('heading', { level: 2 }).textContent).toBe('概览')
    expect(screen.getByText('左').tagName).toBe('H4')
    expect(screen.getByText('说明').className).toContain('dshc-muted')
    expect(screen.getByText('正常').className).toContain('dshc-tone-success')
    expect(screen.getByRole('note').className).toContain('dshc-tone-warning')
    expect(document.querySelectorAll('ol > li')).toHaveLength(2)
    expect(screen.getByText('798').tagName).toBe('DD')
    expect((document.querySelector('.dshc-grid') as HTMLElement).style.getPropertyValue('--dshc-cols')).toBe('2')
  })
})
