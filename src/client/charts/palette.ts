const PALETTE_SIZE = 6

/** Colors resolve through CSS variables defined in styles.ts (light and dark sets). */
export function seriesColor(index: number): string {
  return `var(--dshc-c${(index % PALETTE_SIZE) + 1})`
}
