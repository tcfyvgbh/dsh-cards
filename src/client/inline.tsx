import { Fragment, type ReactNode } from 'react'

/** Only `code` and **bold**; everything else stays literal text (no HTML parsing). */
const TOKEN = /(`[^`\n]+`|\*\*[^*\n]+\*\*)/g

export function renderInline(text: string): ReactNode {
  return text.split(TOKEN).map((part, index) => {
    if (index % 2 === 1) {
      return part.startsWith('`')
        ? <code key={index} className="dshc-code">{part.slice(1, -1)}</code>
        : <strong key={index}>{part.slice(2, -2)}</strong>
    }
    return part === '' ? null : <Fragment key={index}>{part}</Fragment>
  })
}
