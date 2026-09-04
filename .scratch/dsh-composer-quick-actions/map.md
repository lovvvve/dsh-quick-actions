# Deliver DSH Composer Quick Actions

Label: `wayfinder:map`

## Destination

Implement, verify, and document a persistent installable DSH plugin that exposes global Quick Actions near every message composer. The delivered plugin supports author-owned presets and user-owned custom actions, static-text insertion at the cursor, direct sending with per-action confirmation, and DSH-local persistence across restarts.

## Notes

- Domain: DSH composer interaction and persistent Cordis plugin delivery. Use the vocabulary in [`CONTEXT.md`](../../CONTEXT.md).
- This effort explicitly carries execution, testing, packaging, and usage documentation through completion; it does not stop at an implementation-ready specification.
- Preset Quick Actions are read-only, but users may hide them or clone them into editable Custom Quick Actions.
- All Quick Actions are global in the first release.
- Consult `cordis-plugin-development` before relying on Cordis Services, Events, Builtins, Slots, or tokens; Inspect results are the source of truth for runtime contracts.
- Run Client `cordis_inspect_query` calls only from the foreground parent session with the active GUI page, then pass the result to research agents. A background child query can remain pending indefinitely when no page answers for that child Agent; Host Inspect and packaged-source reads are safe in children.
- Consult `prototype` and `frontend-design` for visual interaction work, `domain-modeling` when vocabulary changes, `test-driven-development` during implementation, and `verification-before-completion` before declaring delivery complete.
- The workspace is a local Git repository on `main` with no remote. Local Markdown under this directory is the issue tracker, and research evidence is isolated on `research/<topic>` branches.

## Decisions so far

<!-- Closed-ticket index only. Each decision lives in its ticket. -->

- [Establish a Versioned Workspace for Research](./issues/01-establish-versioned-research-workspace.md) — A committed local `main` baseline now supports isolated research branches; no remote is required.

## Not yet specified

- Concrete implementation slices and source-file boundaries; these can be named only after the supported DSH extension seams and architecture are chosen.
- Exact automated-test split, fixtures, and manual browser verification procedure; these will graduate after runtime behavior and architecture are settled.
- Packaging, installation, upgrade, and end-user documentation tasks; these will graduate after the package contract is known.

## Out of scope

- A temporary dynamic Plugin that disappears when the current DSH process restarts.
- Per-Agent, per-Preset, or per-conversation visibility rules in the first release.
- Cross-device synchronization, import, and export in the first release.
- Runtime variables, templates, arbitrary scripts, or other generated content in Quick Action text.
- Non-button invocation surfaces such as command palettes or keyboard-only macro systems.
