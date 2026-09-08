/**
 * One Slot entry's local error boundary (spec 7.3).
 *
 * A render error inside the Quick Action surfaces replaces the Quick Action
 * area and nothing else: the Composer, its draft and its submit button keep
 * working, and the user can ask for the surface back. Retrying remounts the
 * subtree by changing its key, so a transient failure clears without a reload.
 *
 * DSH's own submission errors never reach here — they are reported by the
 * Composer, and this feature must not repeat them (spec 9.5).
 */
import { Component, Fragment } from 'react'
import type { ErrorInfo, ReactNode } from 'react'
import type { Translate } from '../dsh.js'

export interface SurfaceErrorBoundaryProps {
  readonly t: Translate
  readonly children: ReactNode
}

interface SurfaceErrorBoundaryState {
  readonly failed: boolean
  /** Bumped on retry so the failing subtree is rebuilt rather than reused. */
  readonly attempt: number
}

export class SurfaceErrorBoundary extends Component<SurfaceErrorBoundaryProps, SurfaceErrorBoundaryState> {
  override state: SurfaceErrorBoundaryState = { failed: false, attempt: 0 }

  static getDerivedStateFromError(): Partial<SurfaceErrorBoundaryState> {
    return { failed: true }
  }

  override componentDidCatch(error: Error, info: ErrorInfo): void {
    // The console is the only channel here: a toast would compete with DSH's own
    // error surface, and the retry affordance below is the user-facing report.
    console.error('[composer-quick-actions] surface failed', error, info.componentStack)
  }

  private readonly retry = (): void => {
    this.setState((current) => ({ failed: false, attempt: current.attempt + 1 }))
  }

  override render(): ReactNode {
    const { t, children } = this.props
    // A Fragment, never an element: both docks lay their entries out in a flex
    // column with a gap, so an empty wrapper would shift the Composer every time
    // the surfaces render nothing — on the hero, and on the dock that does not
    // own the current layout.
    if (!this.state.failed) return <Fragment key={this.state.attempt}>{children}</Fragment>
    return (
      <div className="dsh-cqa-note" role="status">
        <span className="dsh-cqa-note-text">{t('crash.title')}</span>
        <button type="button" className="dsh-cqa-link" onClick={this.retry}>
          {t('crash.retry')}
        </button>
      </div>
    )
  }
}
