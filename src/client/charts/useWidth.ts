import { useLayoutEffect, useRef, useState, type RefObject } from 'react'

/**
 * Track an element's rendered width. Without ResizeObserver (jsdom, old
 * browsers) the fallback width is kept, which reproduces a fixed viewBox.
 */
export function useWidth(fallback: number): readonly [RefObject<HTMLDivElement>, number] {
  const ref = useRef<HTMLDivElement>(null)
  const [width, setWidth] = useState(fallback)
  useLayoutEffect(() => {
    const element = ref.current
    if (element === null || typeof ResizeObserver === 'undefined') return undefined
    const observer = new ResizeObserver(entries => {
      const measured = entries[0]?.contentRect.width
      if (measured !== undefined && measured > 0) setWidth(measured)
    })
    observer.observe(element)
    return () => observer.disconnect()
  }, [])
  return [ref, width]
}
