/**
 * When a mutating control in the management panel may be pressed, and how it
 * says so (spec 5.4, 8.4, 10).
 *
 * ## Why two ways of saying "no"
 *
 * Only sustained, externally-imposed unavailability — a read-only namespace, or a
 * connection that can no longer vouch for the held snapshot — uses a real
 * `disabled`, which takes the control out of the tab order entirely.
 *
 * Everything else uses `aria-disabled` plus a guarded handler, because
 * everything else can become true *as a result of the press itself*: the write
 * this control just started, the row that just reached an end of the list, the
 * layout it just selected becoming current, the clone that just filled the last
 * slot. A real `disabled` there would drop the keyboard caret to the document
 * body mid-reorder — and focus handling is a hard gate of spec 8.4, not a nicety.
 */

/** What every mutating control in the panel is gated on. */
export interface ManagerWriteGate {
  /** Sustained and external: the panel is genuinely inert and must not be tabbable. */
  readonly readOnly: boolean
  /** A write is in flight; transient, and usually started by the focused control. */
  readonly busy: boolean
  /** Whether creating or cloning is allowed at all right now (spec 5.4). */
  readonly canAdd: boolean
}

/** The props one mutating control spreads onto its `<button>`. */
export interface PressProps {
  readonly disabled: boolean
  readonly 'aria-disabled': boolean
  readonly onClick: () => void
}

/**
 * Gate one control. `blocked` is its own extra condition — an end of the list,
 * the ceiling, the choice already made; the gate's own `busy` is folded in here
 * so no caller has to remember it.
 */
export function pressProps(gate: ManagerWriteGate, blocked: boolean, onPress: () => void): PressProps {
  const refused = gate.readOnly || gate.busy || blocked
  return {
    disabled: gate.readOnly,
    'aria-disabled': gate.busy || blocked,
    onClick: () => {
      if (refused) return
      onPress()
    },
  }
}
