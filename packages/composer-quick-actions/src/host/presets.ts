/**
 * The package's built-in Preset Quick Action manifest — component 1 of the
 * Preset Catalog (spec 5.1), declared ahead of the Host composition's
 * `Config.presets`.
 *
 * These are a first draft of the shipped copy, kept deliberately generic. The
 * labels and texts are author-facing product copy in one language; changing them
 * is a product decision, not an implementation one.
 *
 * Two rules bind any edit here:
 *
 * - A Preset Action ID is permanent. Label, icon and text may change under the
 *   same id, but `kind` and `confirm` are the immutable safety behaviour
 *   signature — changing either needs a new id (spec 5.1). Editing a text so it
 *   crosses the Command Send Action boundary counts as crossing that signature.
 * - Adding an entry is additive: a new id appends to the end of every existing
 *   user's order and rewrites no stored data (spec 5.3).
 */
export const BUILT_IN_PRESETS: readonly unknown[] = Object.freeze([
  Object.freeze({
    id: 'summarize-thread',
    label: '总结对话',
    text: '总结当前对话：已确定的结论、仍未决的问题、下一步要做的事。',
    icon: '📝',
  }),
  Object.freeze({
    id: 'explain-last-change',
    label: '解释改动',
    text: '解释你刚才的改动：为什么这样做，考虑过哪些替代方案，取舍是什么。',
    icon: '🔍',
  }),
  Object.freeze({
    id: 'compact-context',
    label: '压缩上下文',
    // A Command Send Action: `confirm` is left to the default `true`, so the
    // confirmation panel shows the exact text before it reaches DSH's own
    // command adjudication (spec 9.3).
    text: '/compact',
    icon: '🧹',
  }),
])
