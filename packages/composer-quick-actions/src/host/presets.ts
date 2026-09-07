/**
 * The package's built-in Preset Quick Action manifest — component 1 of the
 * Preset Catalog (spec 5.1), declared ahead of the Host composition's
 * `Config.presets`.
 *
 * It ships empty on purpose. Preset labels and texts are author-facing product
 * copy in one specific language, and choosing that copy is a product decision
 * rather than an implementation one; a deployment declares its own presets
 * through `Config.presets`, which is the authoring channel the release docs
 * still have to write up (ticket 17).
 * Populating this list later is additive: a new Preset Action ID appends to the
 * end of every existing user's order (spec 5.3) and rewrites no stored data.
 */
export const BUILT_IN_PRESETS: readonly unknown[] = Object.freeze([])
