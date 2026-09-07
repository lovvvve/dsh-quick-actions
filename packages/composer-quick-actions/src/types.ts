/**
 * Public type entry: the shared Quick Action data contract — action and Settings
 * V1 shapes, Preset Catalog and projection shapes, validation issue vocabulary
 * and the Settings mutation plan shapes.
 *
 * Types only. The runtime rules that go with them (validation, catalog assembly,
 * decoding, normalization, projection, mutation planning) stay internal to the
 * package: Host and Client import them from `src/model/`, and whether any of them
 * becomes a published runtime export is part of the release-surface decision.
 */
export type * from './model/index.js'
