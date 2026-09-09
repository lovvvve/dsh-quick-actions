/**
 * The Composer Quick Action surfaces' stylesheet (spec 8.2, 8.4).
 *
 * It is shipped as one string installed into a `<style data-plugin-css>` tag,
 * the same shape and idempotence the first-party DSH client bundles use, rather
 * than as CSS Modules: the Client build adapter produces one browser CJS file
 * with no CSS pipeline (spec 11.2), and adding one would change a contract the
 * bundle's own tests pin. Class names carry the `dsh-cqa-` prefix instead of a
 * generated hash, which gives the same collision safety by convention.
 *
 * Colours are DSH alias theme tokens only — nothing here defines a palette, and
 * nothing overrides a global theme (spec 8.4).
 *
 * ## The width rule (spec 8.2)
 *
 * The two layouts sit in different boxes, so they reach the same outer edges by
 * different arithmetic:
 *
 * - `.dsh-cqa-ribbon` renders in the composer stack, outside the InputBar, which
 *   is the element that owns `--dsh-composer-side-clearance` as padding. It
 *   therefore subtracts that clearance from both sides itself.
 * - `.dsh-cqa-bar` renders as the InputBar's last child, inside that padding, so
 *   it is simply `100%` wide.
 *
 * Both are then capped at `--dsh-composer-card-max-width` — the same cap the
 * composer card uses — and centred, so their left and right edges coincide with
 * the input box exactly rather than approximately.
 */

const TAG_ID = 'dsh-quick-actions/surfaces.css'

export const QUICK_ACTIONS_CSS = `
.dsh-cqa-ribbon,
.dsh-cqa-launcher {
  box-sizing: border-box;
  width: calc(100% - var(--dsh-composer-side-clearance) - var(--dsh-composer-side-clearance));
  max-width: var(--dsh-composer-card-max-width);
  margin: 0 auto;
}
.dsh-cqa-bar {
  box-sizing: border-box;
  width: 100%;
  max-width: var(--dsh-composer-card-max-width);
  margin: 0 auto;
}

.dsh-cqa-row {
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
  padding: 2px 0;
}
.dsh-cqa-row[data-density='narrow'] {
  gap: 6px;
}

.dsh-cqa-title {
  flex: none;
  color: var(--dsw-alias-label-tertiary);
  font-size: 12px;
  font-weight: 500;
  line-height: 18px;
  white-space: nowrap;
}

/* The ribbon overflows horizontally; the management entry never scrolls away. */
.dsh-cqa-scroll {
  display: flex;
  align-items: center;
  gap: 8px;
  flex: 1 1 auto;
  min-width: 0;
  overflow-x: auto;
  scrollbar-width: thin;
}
.dsh-cqa-fit {
  display: flex;
  align-items: center;
  gap: 8px;
  flex: 1 1 auto;
  min-width: 0;
  overflow: hidden;
}
.dsh-cqa-trailing {
  display: flex;
  align-items: center;
  gap: 8px;
  flex: none;
  margin-left: auto;
}

/*
 * The capsule itself — height, radius, padding, colours, hover and ":disabled"
 * — belongs to the official "Button". What is left here is what a shared
 * control cannot know (how it behaves inside these rows) plus what the
 * primitive does not supply. Nothing below may restate a Button property,
 * because the plugin class is applied after the primitive's and would win on
 * equal specificity.
 *
 * The focus ring is one of the things it does not supply: "Button.module.css"
 * and "Pill.module.css" carry no ":focus" rule at all — the library leaves the
 * ring to each component that wants one ("Input.module.css" has
 * ":focus-within", "HoverCard" and "JsonTree" their own). Spec 8.4 makes a
 * clear focus ring a hard gate, so it stays here for every control this plugin
 * renders.
 */
.dsh-cqa-action,
.dsh-cqa-entry {
  /* No global border-box reset exists in this stylesheet, and Button pads
     itself, so the cap has to count that padding to mean 240px on screen. */
  box-sizing: border-box;
  flex: none;
  /* Long labels truncate rather than pushing the row's other controls out. */
  max-width: 240px;
}
.dsh-cqa-action:focus-visible,
.dsh-cqa-entry:focus-visible {
  outline: 2px solid var(--dsw-alias-state-business-primary);
  outline-offset: 1px;
}
/* "aria-disabled" is not ":disabled": a control kept focusable while a write is
   in flight still has to read as inert, and no primitive expresses that. */
.dsh-cqa-entry[aria-disabled='true'] {
  opacity: 0.5;
  cursor: default;
}
/* The searchable panel's rows stay native — a full-width, left-aligned list row
   is not a capsule — so they still need a focus ring of their own. */
.dsh-cqa-panel-item:focus-visible,
.dsh-cqa-link:focus-visible {
  outline: 2px solid var(--dsw-alias-state-business-primary);
  outline-offset: 1px;
}
.dsh-cqa-label {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.dsh-cqa-icon {
  flex: none;
}
/* The chip look is "Pill"'s; only its behaviour in a flex row is ours. */
.dsh-cqa-badge,
.dsh-cqa-tag {
  flex: none;
}

.dsh-cqa-note {
  box-sizing: border-box;
  width: 100%;
  margin: 4px 0 0;
  padding: 4px 8px;
  border-radius: 8px;
  background: var(--dsw-alias-interactive-bg-hover);
  color: var(--dsw-alias-label-secondary);
  font-size: 12px;
  line-height: 18px;
  display: flex;
  align-items: center;
  gap: 8px;
}
.dsh-cqa-note-text {
  flex: 1 1 auto;
  min-width: 0;
}
.dsh-cqa-link {
  flex: none;
  border: 0;
  background: none;
  padding: 0;
  color: var(--dsw-alias-state-business-primary);
  font: inherit;
  font-size: 12px;
  cursor: pointer;
  text-decoration: underline;
}

/* Anchored surfaces: the popover list and the confirmation panel. */
.dsh-cqa-anchor {
  position: relative;
}
.dsh-cqa-backdrop {
  position: fixed;
  z-index: 19;
  inset: 0;
}
.dsh-cqa-panel {
  position: absolute;
  z-index: 20;
  bottom: calc(100% + 6px);
  left: 0;
  box-sizing: border-box;
  max-width: min(100%, 360px);
  min-width: 220px;
  max-height: 260px;
  overflow-y: auto;
  padding: 6px;
  border: 0.5px solid var(--dsw-alias-border-l1);
  border-radius: 12px;
  background: var(--dsw-specific-tip);
  box-shadow: var(--dsw-elevation-soft);
}
.dsh-cqa-panel-head {
  display: flex;
  align-items: center;
  gap: 8px;
}
.dsh-cqa-panel-head .dsh-cqa-panel-title {
  flex: 1 1 auto;
  min-width: 0;
}
.dsh-cqa-panel-title {
  padding: 4px 8px;
  color: var(--dsw-alias-label-tertiary);
  font-size: 12px;
  line-height: 18px;
}
.dsh-cqa-panel-item {
  display: flex;
  align-items: center;
  gap: 6px;
  width: 100%;
  padding: 6px 8px;
  border: 0;
  border-radius: 8px;
  background: none;
  color: var(--dsw-alias-label-primary);
  font: inherit;
  font-size: 13px;
  line-height: 20px;
  text-align: left;
  cursor: pointer;
}
.dsh-cqa-panel-item:hover:not(:disabled) {
  background: var(--dsw-alias-interactive-bg-hover);
}
.dsh-cqa-panel-item:disabled {
  opacity: 0.5;
  cursor: default;
}

.dsh-cqa-confirm-text {
  margin: 6px 0;
  padding: 8px;
  border-radius: 8px;
  background: var(--dsw-alias-interactive-bg-hover);
  color: var(--dsw-alias-label-primary);
  font-family: var(--ds-font-family-code);
  font-size: 12px;
  line-height: 18px;
  white-space: pre-wrap;
  word-break: break-word;
  max-height: 160px;
  overflow-y: auto;
}
.dsh-cqa-confirm-actions {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
}

/* ------------------------------------------------------------------------- */
/* Fields, shared by the search box and the Custom Quick Action form         */
/* ------------------------------------------------------------------------- */

.dsh-cqa-field {
  display: flex;
  flex-direction: column;
  gap: 2px;
  padding: 4px 0;
}
.dsh-cqa-field-label {
  color: var(--dsw-alias-label-secondary);
  font-size: 12px;
  line-height: 18px;
}
.dsh-cqa-field-hint {
  color: var(--dsw-alias-label-tertiary);
  font-size: 11px;
  line-height: 16px;
}
.dsh-cqa-field-error {
  color: var(--dsw-alias-state-danger-primary, var(--dsw-alias-label-primary));
  font-size: 11px;
  line-height: 16px;
  font-weight: 500;
}

.dsh-cqa-input,
.dsh-cqa-textarea {
  box-sizing: border-box;
  width: 100%;
  padding: 4px 8px;
  border: 0.5px solid var(--dsw-alias-border-l1);
  border-radius: 8px;
  background: transparent;
  color: var(--dsw-alias-label-primary);
  font: inherit;
  font-size: 13px;
  line-height: 20px;
}
.dsh-cqa-textarea {
  resize: vertical;
  min-height: 72px;
  font-family: var(--ds-font-family-code);
  white-space: pre-wrap;
}
.dsh-cqa-input:focus-visible,
.dsh-cqa-textarea:focus-visible {
  outline: 2px solid var(--dsw-alias-state-business-primary);
  outline-offset: 1px;
}
.dsh-cqa-input:disabled,
.dsh-cqa-textarea:disabled {
  opacity: 0.5;
}

.dsh-cqa-switch {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 4px 0;
  cursor: pointer;
}

/* ------------------------------------------------------------------------- */
/* The centralized management overlay                                        */
/* ------------------------------------------------------------------------- */

/*
 * The overlay and its click-catching backdrop. Neither paints: only DSH alias
 * theme tokens may be used here, and this release has no token to spend on a
 * modal scrim (spec 8.4).
 *
 * These two numbers rank the overlay against its own backdrop, and nothing
 * else. Since ticket 26 the overlay is portaled to the document body, so it and
 * the anchored popovers (19 and 20, still rendered in the input dock) sit in
 * different stacking contexts: which of them paints on top follows from where
 * the dock's own ancestors land in the root context, not from comparing 31
 * against 20. Raising these would not change that.
 */
.dsh-cqa-manager-backdrop {
  z-index: 30;
}
.dsh-cqa-manager {
  position: fixed;
  z-index: 31;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  box-sizing: border-box;
  display: flex;
  flex-direction: column;
  gap: 6px;
  width: min(560px, calc(100vw - 24px));
  max-height: min(80vh, 680px);
  overflow-y: auto;
  padding: 12px;
  border: 0.5px solid var(--dsw-alias-border-l1);
  border-radius: 12px;
  background: var(--dsw-specific-tip);
  color: var(--dsw-alias-label-primary);
  box-shadow: var(--dsw-elevation-soft);
}

.dsh-cqa-manager-head {
  display: flex;
  align-items: center;
  gap: 8px;
}
.dsh-cqa-manager-title {
  flex: 1 1 auto;
  min-width: 0;
  margin: 0;
  color: var(--dsw-alias-label-primary);
  font-size: 14px;
  font-weight: 600;
  line-height: 20px;
}

.dsh-cqa-section {
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding: 6px 0;
  border-top: 0.5px solid var(--dsw-alias-border-l1);
}
.dsh-cqa-section-head {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}
.dsh-cqa-section-head .dsh-cqa-section-title {
  flex: 1 1 auto;
}
.dsh-cqa-section-title {
  color: var(--dsw-alias-label-secondary);
  font-size: 12px;
  font-weight: 500;
  line-height: 18px;
}
.dsh-cqa-group {
  display: flex;
  align-items: center;
  gap: 6px;
  flex-wrap: wrap;
}
.dsh-cqa-entry[aria-pressed='true'] {
  background: var(--dsw-alias-state-business-tertiary);
  color: var(--dsw-alias-label-primary-bluish);
  opacity: 1;
}

.dsh-cqa-list {
  display: flex;
  flex-direction: column;
  gap: 6px;
  margin: 0;
  padding: 0;
  list-style: none;
}
.dsh-cqa-list-item {
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding: 6px 8px;
  border-radius: 8px;
  background: var(--dsw-alias-interactive-bg-hover);
}
/* A hidden or disabled action stays legible: it is managed here, not removed. */
.dsh-cqa-list-item[data-quick-action-hidden] .dsh-cqa-list-head,
.dsh-cqa-list-item[data-quick-action-hidden] .dsh-cqa-list-text {
  opacity: 0.6;
}
.dsh-cqa-list-head {
  display: flex;
  align-items: center;
  gap: 6px;
  flex-wrap: wrap;
  min-width: 0;
  font-size: 13px;
  line-height: 20px;
}
.dsh-cqa-list-text {
  min-width: 0;
  overflow: hidden;
  color: var(--dsw-alias-label-tertiary);
  font-family: var(--ds-font-family-code);
  font-size: 11px;
  line-height: 16px;
  white-space: nowrap;
  text-overflow: ellipsis;
}
.dsh-cqa-list-controls {
  display: flex;
  align-items: center;
  gap: 4px;
  flex-wrap: wrap;
}

.dsh-cqa-form {
  display: flex;
  flex-direction: column;
  gap: 2px;
  padding: 6px 0 0;
  border-top: 0.5px solid var(--dsw-alias-border-l1);
}
.dsh-cqa-form-actions {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  padding-top: 6px;
}
`

/**
 * Install the stylesheet once per document and return its disposer, so the
 * Client fiber owns it like every other registration (spec 7.3).
 *
 * The holder count lives on the tag rather than in this module, because a hot
 * reload runs two bundle instances at once: the new fiber installs before the
 * old one unloads, and each has its own module scope. Counting in the DOM is
 * what keeps the surviving instance's styles from being removed underneath it.
 */
export function installQuickActionStyles(): () => void {
  if (typeof document === 'undefined') return () => {}
  const selector = `style[data-plugin-css=${JSON.stringify(TAG_ID)}]`
  const existing = document.querySelector<HTMLStyleElement>(selector)
  const tag = existing ?? document.createElement('style')
  if (existing === null) {
    tag.dataset['plugin'] = 'dsh-quick-actions'
    tag.dataset['pluginCss'] = TAG_ID
    tag.textContent = QUICK_ACTIONS_CSS
    document.head.appendChild(tag)
  }
  tag.dataset['pluginCssHolders'] = String(holdersOf(tag) + 1)

  let released = false
  return () => {
    if (released) return
    released = true
    const left = holdersOf(tag) - 1
    if (left > 0) {
      tag.dataset['pluginCssHolders'] = String(left)
      return
    }
    tag.remove()
  }
}

function holdersOf(tag: HTMLStyleElement): number {
  const held = Number(tag.dataset['pluginCssHolders'])
  return Number.isFinite(held) && held > 0 ? held : 0
}
