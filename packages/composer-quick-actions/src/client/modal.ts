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
 * This module is a leaf beside `dsh.ts`, owned by no directory of spec 14's
 * source map: the confirmation panel (`session/`), the action panel and the
 * management panel (`manager/`) all need it, and putting it inside any one of
 * them would make another depend on that one's directory for something that is
 * neither an action nor an execution concern.
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
const FOCUSABLE_SELECTOR = [
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
        // A nested editing context — the management form — stops Escape before
        // it reaches this handler, so leaving the form does not close the panel;
        // the form takes focus on open, so that holds from its first keystroke.
        event.stopPropagation()
        onCancel()
        return
      }
      if (event.key !== 'Tab') return
      const focusable = Array.from(panelRef.current?.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR) ?? [])
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
 *
 * @param scope - the closing context's own element, for an editing context
 * nested inside a panel (the management form inside the management panel).
 * When the outer panel closes, React runs the outer cleanup first, the inner
 * cleanup next, and only then removes the outer DOM: by the time the nested
 * context returns focus, the panel has already handed it to *its* opener, and
 * the nested opener is a control about to leave the document. So a nested
 * context returns focus only while focus is still inside it (or fell to the
 * body); focus that has already left belongs to whoever moved it.
 */
export function useFocusReturn(scope?: MutableRefObject<HTMLElement | null>): void {
  const opener = useRef<HTMLElement | null>(null)

  useLayoutEffect(() => {
    const active = typeof document === 'undefined' ? null : document.activeElement
    opener.current = active === document.body ? null : (active as HTMLElement | null)
    return () => {
      const element = opener.current
      opener.current = null
      if (element === null || !element.isConnected) return
      const current = document.activeElement
      if (
        scope?.current != null &&
        current !== null &&
        current !== document.body &&
        !scope.current.contains(current)
      ) {
        return
      }
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

/**
 * Move focus into a panel once, on open, addressing the target through the
 * panel rather than through a ref (spec 8.4).
 *
 * `@deepseek-ai/dsh-client-ui-primitives` publishes no `forwardRef` at all, so
 * an official `Button` or `Input` cannot carry one. Addressing the opening
 * target by marker attribute — the way the Tab boundary above already addresses
 * the focusable set — keeps that limitation in this one module instead of
 * pushing every panel back onto native controls.
 *
 * @param container - the panel whose subtree holds the target.
 * @param selector - CSS selector for the control that should open focused.
 */
export function useInitialFocusIn<T extends HTMLElement>(
  container: MutableRefObject<T | null>,
  selector: string,
): void {
  useEffect(() => {
    container.current?.querySelector<HTMLElement>(selector)?.focus()
  }, [container, selector])
}
