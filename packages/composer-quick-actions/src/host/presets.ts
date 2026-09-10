/**
 * The package's built-in Preset Quick Action manifest — component 1 of the
 * Preset Catalog (spec 5.1), declared ahead of the Host composition's
 * `Config.presets`.
 *
 * These are author-facing product copy in one language; changing a label or a
 * text is a product decision, not an implementation one.
 *
 * Two rules bind any edit here:
 *
 * - A Preset Action ID is permanent. Label, icon and text may change under the
 *   same id, but `kind` and `confirm` are the immutable safety behaviour
 *   signature — changing either needs a new id (spec 5.1). Editing a text so it
 *   crosses the Command Send Action boundary counts as crossing that signature.
 * - Adding an entry is additive: a new id appends to the end of every existing
 *   user's order and rewrites no stored data (spec 5.3).
 *
 * `summarize` and `explain` carry new ids rather than reusing
 * `summarize-thread` and `explain-last-change`: those two shipped on the
 * default `confirm: true`, and turning confirmation off is exactly the
 * signature change the first rule reserves a new id for. The old ids simply
 * leave the catalog, which the model already handles — a stored preference for
 * an id no longer in the catalog is kept as a tombstone, neither shown nor
 * counted (spec 5.3).
 */
export const BUILT_IN_PRESETS: readonly unknown[] = Object.freeze([
  Object.freeze({
    id: 'approve',
    label: '确认',
    text: '确认，按你刚才说的做。',
    icon: '✅',
    // The four one-press replies below are deliberately unconfirmed: their
    // whole value is answering in a single press, and a panel that echoes
    // "继续。" back for approval would cost more than it protects.
    confirm: false,
  }),
  Object.freeze({
    id: 'continue',
    label: '继续',
    text: '继续。',
    icon: '▶️',
    confirm: false,
  }),
  Object.freeze({
    id: 'summarize',
    label: '总结',
    text: '总结当前对话：已确定的结论、仍未决的问题、下一步要做的事。',
    icon: '📝',
    confirm: false,
  }),
  Object.freeze({
    id: 'explain',
    label: '解释',
    text: '解释你刚才的改动：为什么这样做，考虑过哪些替代方案，取舍是什么。',
    icon: '🔍',
    confirm: false,
  }),
  Object.freeze({
    id: 'compact-context',
    label: '压缩',
    // A Command Send Action, and the one preset that keeps `confirm` at the
    // default `true`: the confirmation panel shows the exact text before it
    // reaches DSH's own command adjudication (spec 9.3). Only the label
    // changed here, so the id is unchanged.
    text: '/compact',
    icon: '🧹',
  }),
])
