import type { CSSProperties, ReactNode } from 'react'
import { renderInline } from '../inline.tsx'

export function Row({ children }: { readonly children: ReactNode }) {
  return <div className="dshc-row">{children}</div>
}

export function Grid({ cols, children }: { readonly cols: number; readonly children: ReactNode }) {
  return <div className="dshc-grid" style={{ '--dshc-cols': String(cols) } as CSSProperties}>{children}</div>
}

export function Card({ title, children }: { readonly title?: string; readonly children: ReactNode }) {
  return (
    <section className="dshc-card">
      {title !== undefined && <h4 className="dshc-card-title">{renderInline(title)}</h4>}
      {children}
    </section>
  )
}
