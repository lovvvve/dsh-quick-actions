/**
 * The shared action panel's search rule (spec 8.1).
 *
 * Spec 8.1 requires the search to *actually* filter — the prototype's
 * "shows everything" placeholder is explicitly forbidden — to keep matches in
 * their `actionOrder` relative order, and to have one stated policy for which
 * fields are searched, how case is handled and how Unicode is normalized.
 *
 * That policy is:
 *
 * - **Fields**: the label and the static text, and nothing else. Those are the
 *   two things the user wrote and can read; the icon is decoration and never an
 *   accessible or searchable name (spec 8.4), and the Command badge is derived
 *   from the text that is already searched.
 * - **Case**: folded with `toLowerCase()`, which is the locale-independent
 *   Unicode default mapping. `toLocaleLowerCase()` is deliberately avoided: it
 *   would make the same query behave differently for a Turkish `i` depending on
 *   the UI language, and a filter that depends on the locale cannot be pinned.
 * - **Unicode**: NFKC. It folds the compatibility forms a CJK IME actually
 *   produces — full-width Latin and full-width punctuation above all — so a
 *   query typed with the IME still finds half-width text.
 * - **Whitespace**: every run collapses to one space, on both sides, so a
 *   one-line query can match a multi-line action text. The run definition is
 *   the regex `\s`, which is the same ECMAScript whitespace `trim()` uses, so
 *   this stays consistent with the blank rules of spec 4.3.
 *
 * Matching is per field and by substring: an action matches when the normalized
 * query appears in its normalized label or in its normalized text. Fields are
 * never concatenated first, which would let a query match across a boundary
 * that does not exist.
 *
 * The comparison is deliberately not locale-collated (`Intl.Collator`): a
 * collator answers "are these equal", not "does this contain that", and a
 * substring search is what a filter box means.
 */
import type { ProjectedQuickAction } from '../../model/index.js'

/** The fields a query is compared against, for documentation and tests. */
export const QUICK_ACTION_SEARCH_FIELDS: readonly ['label', 'text'] = ['label', 'text']

/**
 * The one normalization both sides of a comparison go through. Applying it to
 * the query and to the haystack through the same function is what keeps the two
 * from drifting apart.
 */
export function normalizeQuickActionSearchText(value: string): string {
  return value.normalize('NFKC').toLowerCase().replace(/\s+/gu, ' ').trim()
}

/**
 * The actions matching `query`, in their original relative order.
 *
 * An empty or whitespace-only query hands the same array back by identity: an
 * unsearched panel is not a filtered panel, and returning a copy would remount
 * every row for nothing.
 */
export function filterQuickActions(
  actions: readonly ProjectedQuickAction[],
  query: string,
): readonly ProjectedQuickAction[] {
  const needle = normalizeQuickActionSearchText(query)
  if (needle === '') return actions
  return actions.filter((action) =>
    QUICK_ACTION_SEARCH_FIELDS.some((field) => normalizeQuickActionSearchText(action[field]).includes(needle)),
  )
}
