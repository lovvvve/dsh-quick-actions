/**
 * The send preconditions of spec 9.2, derived from nothing but the public
 * per-Session snapshots a dock Slot entry receives.
 *
 * Both functions are total over the published `InputState` and the published
 * `SessionSnapshot`: every field of the public Input snapshot is accounted for
 * here or explained as deliberately not a precondition, because spec 9.5 makes
 * that exact field set the only evidence this feature may judge a send by.
 */
import type { ComposerBlock, InputState, SessionSnapshot } from '../dsh.js'

/** Why no Quick Action may execute in this Composer right now (spec 3, 9.2). */
export type QuickActionUnavailableReason =
  /** The draft holds text, an attachment or a reference chip (Occupied Draft). */
  | 'occupied-draft'
  /** The input machine is mid-adjudication, mid-submit, or in command mode. */
  | 'composer-busy'
  /** A feature-owned Composer block is raised for this Session. */
  | 'composer-blocked'
  /** The Session was removed. */
  | 'session-removed'
  /** A continuable subagent whose parent is not available: the composer is inert. */
  | 'parent-offline'
  /** This Session already has a send in flight (spec 9.5 single-flight). */
  | 'sending'

/**
 * Whether the draft is occupied (spec 9.2). Occupancy is any text — pure
 * whitespace included, so the raw string is compared against `''` and never
 * trimmed — any attachment, and any rich reference.
 *
 * The public snapshot exposes exactly `{ draft, attachmentIds, draftRev, phase,
 * claim?, occurrences, queue }`. Occupancy reads three of them:
 *
 * - `draft` — the clipboard-text projection of the whole document;
 * - `attachmentIds` — the ordered draft attachments, and the only public
 *   attachment field there is. Since 0.1.5-rc.1 it admits any attachment kind,
 *   not just images;
 * - `occurrences` — the reference chips. They are already expanded inside
 *   `draft`, so this test is redundant today; it is kept because a future chip
 *   whose clipboard projection is empty must still count as content the send
 *   action would carry away.
 *
 * The remaining fields are not occupancy: `draftRev` is a revision counter,
 * `phase`/`claim` are the submit plane (handled by {@link composerGate}), and
 * `queue` is the Session's transient inbox, which spec 9.2 explicitly allows a
 * send to join.
 */
export function isOccupiedDraft(input: InputState): boolean {
  return input.draft !== '' || input.attachmentIds.length > 0 || input.occurrences.length > 0
}

/**
 * The composer-level guard, reproducing the shipped send button's own
 * conditions from public state alone (spec 9.2).
 *
 * `disabled` in spec 9.2's list is the shipped bar's inert state, which is
 * reached only without a Session or on the blank-session hero. Neither can
 * occur here: both dock Slots are session-scoped, and the Quick Action surfaces
 * render only where the Resident Composer predicate holds.
 */
export function composerGate(
  input: InputState,
  session: SessionSnapshot,
  block: ComposerBlock | undefined,
): QuickActionUnavailableReason | undefined {
  if (session.removed) return 'session-removed'
  if (block !== undefined) return 'composer-blocked'
  if (session.subagent?.address.mode === 'continuable' && session.subagent.parentAvailable !== true) {
    return 'parent-offline'
  }
  // `claimed` is listed with the busy phases on purpose: a live command claim
  // owns the draft, and admitting a send there would submit the user's command
  // token rather than the action's text.
  if (input.phase !== 'plain') return 'composer-busy'
  if (isOccupiedDraft(input)) return 'occupied-draft'
  return undefined
}
