/**
 * Unicode primitives shared by every Quick Action entry point (spec 4.3).
 * Config loading, the management form, migration and Settings mutations must all
 * measure and trim text through these functions so one rule cannot drift from another.
 */

/**
 * Reference placeholder code points DSH reserves and strips inside `setDraft`:
 * the reference marker block plus the legacy object replacement character.
 * Static text carrying one of them would submit something other than what the
 * user configured, so the model rejects it as a field error (spec 4.3).
 *
 * Source: `REFERENCE_PLACEHOLDER_RE` in `@deepseek-ai/dsh-client-ui-conversation`
 * (`lib/client.js`, input machine), applied by `setDraft` before it rebuilds the
 * draft. Verified identical in 0.1.1-rc.2, 0.1.2-rc.1 and 0.1.5-rc.1 — the release
 * that renamed `imageIds` left this range untouched (ticket 29). Its tail is
 * published as a named constant, which 0.1.5-rc.1 moved and renamed:
 * `PLACEHOLDER = "\uFFFC"` in `lib/types/client/input/machine.d.ts` became
 * `ATOMIC_CHAR = "\uFFFC"` in `lib/types/client/input/editor/projection.d.ts`.
 * Re-check this range when the supported DSH range moves.
 */
const RESERVED_REFERENCE_PLACEHOLDER = /[\u{E100}-\u{E11D}\u{FFFC}]/u

/** Unicode code point length — the counting unit for every length limit (spec 4.3). */
export function countCodePoints(value: string): number {
  let count = 0
  for (const _ of value) count += 1
  return count
}

/** Whether a text holds no character outside ECMAScript `trim()` whitespace (spec 4.3). */
export function isBlankQuickActionText(text: string): boolean {
  return text.trim().length === 0
}

/** Whether a text carries a DSH-reserved reference placeholder code point (spec 4.3). */
export function containsReservedReferencePlaceholder(text: string): boolean {
  return RESERVED_REFERENCE_PLACEHOLDER.test(text)
}

/**
 * Whether a static text is a Command Send Action: its first non-whitespace
 * character is `/` (spec 4.3). Whitespace is ECMAScript `trim()` whitespace.
 */
export function isCommandSendActionText(text: string): boolean {
  return text.trimStart().startsWith('/')
}

/** Code points allowed to appear inside an emoji grapheme cluster. */
const EMOJI_CLUSTER_MEMBER = /^[\p{Extended_Pictographic}\p{Emoji_Component}\p{Emoji_Modifier}\u{FE0E}\u{FE0F}\u{200D}]+$/u
/** A keycap sequence carries no pictographic code point of its own. */
const KEYCAP_CLUSTER = /^[0-9#*]\u{FE0F}?\u{20E3}$/u
/** A flag is a pair of regional indicators, also without a pictographic code point. */
const FLAG_CLUSTER = /^\p{Regional_Indicator}{2}$/u

const graphemeSegmenter = new Intl.Segmenter('en', { granularity: 'grapheme' })

function isEmojiCluster(cluster: string): boolean {
  if (!EMOJI_CLUSTER_MEMBER.test(cluster)) return false
  return /\p{Extended_Pictographic}/u.test(cluster) || KEYCAP_CLUSTER.test(cluster) || FLAG_CLUSTER.test(cluster)
}

/** Grapheme-cluster reading of an icon candidate (spec 4.3). */
export interface EmojiClusterScan {
  /** Grapheme clusters in the candidate, emoji or not. */
  readonly clusters: number
  /** Whether every grapheme cluster is an emoji cluster. */
  readonly emojiOnly: boolean
}

/**
 * Segment an icon candidate into grapheme clusters and report whether each one
 * is an emoji cluster, so validation can tell `too-long` from `not-emoji`.
 */
export function scanEmojiClusters(icon: string): EmojiClusterScan {
  let clusters = 0
  let emojiOnly = true
  for (const { segment } of graphemeSegmenter.segment(icon)) {
    clusters += 1
    if (!isEmojiCluster(segment)) emojiOnly = false
  }
  return { clusters, emojiOnly }
}
