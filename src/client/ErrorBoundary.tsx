import { Component, type ReactNode } from 'react'

interface Props { readonly raw: string; readonly children: ReactNode }
interface State { readonly failed: boolean }

/** Contain a render failure to one card so the conversation keeps working. */
export class CardErrorBoundary extends Component<Props, State> {
  override state: State = { failed: false }

  static getDerivedStateFromError(): State {
    return { failed: true }
  }

  override componentDidCatch(error: Error): void {
    console.warn('[dsh-cards] 卡片渲染失败', error)
  }

  override render(): ReactNode {
    if (!this.state.failed) return this.props.children
    return (
      <details className="dshc-root dshc-note">
        <summary>卡片渲染失败</summary>
        <pre className="dshc-pre">{this.props.raw.slice(0, 4000)}</pre>
      </details>
    )
  }
}
