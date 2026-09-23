// @vitest-environment jsdom
import { cleanup, render } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { Chart } from '../src/client/charts/Chart.tsx'
import { formatTick, labelStride, niceDomain, niceStep, ticks } from '../src/client/charts/scale.ts'
import type { ChartNode } from '../src/spec/types.ts'

afterEach(cleanup)

describe('scale', () => {
  it('picks nice steps and zero-based domains', () => {
    expect(niceStep(78)).toBe(100)
    expect(niceStep(3.75)).toBe(5)
    expect(niceDomain([312, 298, 224])).toEqual({ lo: 0, hi: 400, step: 100 })
    expect(ticks(niceDomain([312, 298, 224]))).toEqual([0, 100, 200, 300, 400])
    expect(niceDomain([-5, 10])).toEqual({ lo: -5, hi: 10, step: 5 })
    expect(niceDomain([0, 0])).toEqual({ lo: 0, hi: 1, step: 0.25 })
  })

  it('formats ticks and thins labels', () => {
    expect(formatTick(42_800_000)).toBe('42.8M')
    expect(formatTick(1500)).toBe('1.5k')
    expect(formatTick(0.25)).toBe('0.25')
    expect(labelStride(24)).toBe(3)
    expect(labelStride(5)).toBe(1)
  })
})

const labels = ['06:00', '07:00', '08:00']

describe('Chart', () => {
  it('draws one polyline per line series with titled points and a legend', () => {
    const node: ChartNode = { type: 'chart', kind: 'line', title: 'P95', labels, series: [{ name: 'a', data: [3, 2, 1] }, { name: 'b', data: [1, 2, 3] }] }
    const { container } = render(<Chart node={node} />)
    expect(container.querySelectorAll('polyline.dshc-line')).toHaveLength(2)
    expect(container.querySelectorAll('circle.dshc-dot')).toHaveLength(6)
    expect(container.querySelector('circle.dshc-dot title')?.textContent).toBe('a · 06:00: 3')
    expect(container.querySelector('figcaption')?.textContent).toBe('P95')
    expect(container.querySelectorAll('.dshc-legend li')).toHaveLength(2)
  })

  it('centers a single-point line chart without NaN (Review Focus 4)', () => {
    const { container } = render(<Chart node={{ type: 'chart', kind: 'line', labels: ['only'], series: [{ name: 's', data: [5] }] }} />)
    const dot = container.querySelector('circle.dshc-dot')
    expect(dot?.getAttribute('cx')).not.toContain('NaN')
    expect(Number(dot?.getAttribute('cx'))).toBeCloseTo(48 + (600 - 48 - 12) / 2)
    expect(container.querySelector('.dshc-legend')).toBeNull()
  })

  it('draws grouped bars, with negative bars hanging below zero', () => {
    const node: ChartNode = { type: 'chart', kind: 'bar', labels, series: [{ name: 'a', data: [4, -2, 6] }, { name: 'b', data: [1, 1, 1] }] }
    const { container } = render(<Chart node={node} />)
    const bars = container.querySelectorAll('rect.dshc-bar-rect')
    expect(bars).toHaveLength(6)
    const zeroLine = Number(container.querySelector('line.dshc-zero')?.getAttribute('y1'))
    expect(Number(bars[1]?.getAttribute('y'))).toBeCloseTo(zeroLine)
  })

  it('draws donut slices for non-zero values and a legend with percentages', () => {
    const node: ChartNode = { type: 'chart', kind: 'donut', labels: ['a', 'b', 'c'], series: [{ name: 's', data: [1, 0, 3] }] }
    const { container } = render(<Chart node={node} />)
    expect(container.querySelectorAll('circle.dshc-slice')).toHaveLength(2)
    const legend = Array.from(container.querySelectorAll('.dshc-legend li')).map(item => item.textContent)
    expect(legend).toEqual(['a 1（25%）', 'b 0（0%）', 'c 3（75%）'])
  })
})
