/**
 * Plugin-local record of which render_cards calls are currently shown in a
 * turn tail, so the process-group toolview can collapse to a one-line note.
 * Collections are replaced, never mutated.
 */
type Listener = () => void

let counts: ReadonlyMap<string, number> = new Map()
let listeners: ReadonlySet<Listener> = new Set()

function emit(): void {
  listeners.forEach(listener => listener())
}

/** Mark a call as shown; the returned release is idempotent. Marks are reference-counted. */
export function markShown(callId: string): () => void {
  counts = new Map([...counts, [callId, (counts.get(callId) ?? 0) + 1]])
  emit()
  let released = false
  return () => {
    if (released) return
    released = true
    const remaining = (counts.get(callId) ?? 1) - 1
    counts = remaining > 0
      ? new Map([...counts, [callId, remaining]])
      : new Map([...counts].filter(([id]) => id !== callId))
    emit()
  }
}

export function isShown(callId: string): boolean {
  return (counts.get(callId) ?? 0) > 0
}

export function subscribe(listener: Listener): () => void {
  listeners = new Set([...listeners, listener])
  return () => {
    listeners = new Set([...listeners].filter(entry => entry !== listener))
  }
}
