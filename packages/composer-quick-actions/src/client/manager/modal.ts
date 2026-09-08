/**
 * The modal semantics every Quick Action panel shares (spec 8.4).
 *
 * Spec 8.4 makes Escape cancellation, a clear focus ring, keyboard traversal and
 * focus return after a panel closes hard gates. None of these panels render
 * through a portal — a Slot entry renders in place, inside the composer stack —
 * so without a Tab boundary a keyboard user would tab straight out of an open
 * panel into the draft behind it, and every route back into the panel would take
 * the Escape handler with it.
 *
 * Both hooks are deliberately tiny and DOM-only: they read `document.activeElement`
 * and call `focus()`, which is the browser's own focus contract, not DSH's. No
 * Composer state, private event or Lexical path is touched (spec 9.1).
 */
import { useCallback, useEffect, useLayoutEffect, useRef } from 'react'
import type { KeyboardEvent as ReactKeyboardEvent, MutableRefObject } from 'react'

/**
 * What Tab may reach inside a panel. Disabled controls are excluded, which is
 * what keeps the boundary correct while a write is in flight and half the
 * panel's buttons are inert.
 */
export const MODAL_FOCUSABLE_SELECTOR = [
  'a[href]',
  'button:not([disabled])',
  'input:not([disabled])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(',')

/** What {@link useModalKeys} hands a panel. */
export interface ModalKeys<T extends HTMLElement> {
  /** Put on the panel element itself; the Tab boundary is computed from its subtree. */
  readonly panelRef: MutableRefObject<T | null>
  /** Put on the same element; handles Escape and the Tab boundary. */
  readonly onKeyDown: (event: ReactKeyboardEvent<T>) => void
}

/**
 * Escape cancels, and Tab stays inside.
 *
 * The focusable set is recomputed on every keystroke rather than cached: a
 * management panel grows a form, a form's Save button goes inert while a write
 * is in flight, and a stale boundary would trap focus on a control that is no
 * longer there.
 */
export function useModalKeys<T extends HTMLElement>(onCancel: () => void): ModalKeys<T> {
  const panelRef = useRef<T | null>(null)

  const onKeyDown = useCallback(
    (event: ReactKeyboardEvent<T>) => {
      if (event.key === 'Escape') {
        // Stopped here: the composer behind this panel also listens for Escape,
        // and cancelling a Quick Action must not also clear the user's draft.
        event.stopPropagation()
        onCancel()
        return
      }
      if (event.key !== 'Tab') return
      const focusable = Array.from(panelRef.current?.querySelectorAll<HTMLElement>(MODAL_FOCUSABLE_SELECTOR) ?? [])
      const first = focusable[0]
      const last = focusable[focusable.length - 1]
      if (first === undefined || last === undefined) return
      const edge = event.shiftKey ? first : last
      if (event.target !== edge) return
      event.preventDefault()
      ;(event.shiftKey ? last : first).focus()
    },
    [onCancel],
  )

  return { panelRef, onKeyDown }
}

/**
 * Return focus to whatever opened this panel, when it closes (spec 8.4).
 *
 * The opener is captured in a layout effect, so it must be declared *before* any
 * effect that moves focus into the panel: effects run in declaration order
 * within a component, and layout effects run before passive ones, so the capture
 * always sees the control the user actually activated.
 *
 * An opener that has since been unmounted — an action picked from a list that
 * closed with it — is skipped rather than focused, and the caller is free to
 * offer a fallback of its own.
 */
export function useFocusReturn(): void {
  const opener = useRef<HTMLElement | null>(null)

  useLayoutEffect(() => {
    const active = typeof document === 'undefined' ? null : document.activeElement
    opener.current = active === document.body ? null : (active as HTMLElement | null)
    return () => {
      const element = opener.current
      opener.current = null
      if (element === null || !element.isConnected) return
      element.focus()
    }
  }, [])
}

/** Move focus into a panel once, on open (spec 8.4). */
export function useInitialFocus<T extends HTMLElement>(): MutableRefObject<T | null> {
  const target = useRef<T | null>(null)
  useEffect(() => {
    target.current?.focus()
  }, [])
  return target
}
