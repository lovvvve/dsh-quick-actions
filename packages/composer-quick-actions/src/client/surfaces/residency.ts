/**
 * The Resident Composer predicate (spec 2.3, 8.1; spec 15, decision 6).
 *
 * ## Why a predicate is needed at all
 *
 * The two dock Slots this feature registers into do not have the same reach:
 *
 * - `conversation.composer.dock` — "Ambient entries below the composer card" —
 *   is rendered by the shipped `InputBar` under
 *   `variant === 'composer' && input !== undefined && sessionId !== undefined`.
 *   The blank-session hero renders the same bar with `variant: 'hero'`, and that
 *   branch renders no composer dock at all.
 * - `conversation.input.dock` — "Full-width entries above the composer card" —
 *   is rendered by `ConversationRoot` from the composer stack, which is shared
 *   by the hero and the resident composer. Its `zone` owner prop only requires
 *   a Session and an Input, so the entry *does* mount on the hero.
 *
 * So the input dock alone cannot tell a Resident Composer from a hero, and the
 * first release must render in one and never the other.
 *
 * ## The predicate
 *
 * A `conversation.composer.dock` entry is mounted **if and only if** the shipped
 * composer is in its resident, session-backed variant. That mount is therefore
 * DSH's own public statement of residency, and this registry is how the input
 * dock reads it: the composer-dock entry marks its Session resident while it is
 * mounted, and the input-dock entry renders the current layout only while the
 * mark stands.
 *
 * It is a contract-level signal, not a guess: no DOM is measured, no private
 * Composer state is read, and the shipped hero branch is not re-derived here —
 * which is what spec 8.1 forbids ("不得通过 DOM 或私有 Composer 状态猜测来规避").
 * The mark is published from a layout effect, so a hero that becomes resident
 * brings the layout up in the same commit rather than the next one; and if that
 * ever slipped a frame, it would slip in the required direction — the hard rule
 * is that nothing appears on the hero, never that it appears instantly.
 *
 * Takeover composers need no predicate of their own: when a `conversation.composer`
 * chain entry wins, the renderer keeps the resident fallback mounted but hides
 * its wrapper, so both docks — and everything in them — go with it.
 */

/** Which Sessions currently have a Resident Composer on screen. */
export interface ResidentComposerRegistry {
  /**
   * Mark one Session's Composer resident. The disposer withdraws the mark, and
   * marks are counted, so a remount that overlaps its own unmount cannot leave
   * the Session looking non-resident.
   */
  mark(sessionId: string): () => void
  isResident(sessionId: string): boolean
  subscribe(listener: () => void): () => void
}

export function createResidentComposerRegistry(): ResidentComposerRegistry {
  const marks = new Map<string, number>()
  const listeners = new Set<() => void>()

  function publish(): void {
    for (const listener of Array.from(listeners)) listener()
  }

  return {
    mark(sessionId) {
      marks.set(sessionId, (marks.get(sessionId) ?? 0) + 1)
      publish()
      let withdrawn = false
      return () => {
        if (withdrawn) return
        withdrawn = true
        const held = (marks.get(sessionId) ?? 1) - 1
        if (held > 0) marks.set(sessionId, held)
        else marks.delete(sessionId)
        publish()
      }
    },
    isResident: (sessionId) => marks.has(sessionId),
    subscribe(listener) {
      listeners.add(listener)
      return () => {
        listeners.delete(listener)
      }
    },
  }
}
