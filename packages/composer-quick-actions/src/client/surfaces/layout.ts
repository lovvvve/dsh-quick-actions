/**
 * The width and density rules of spec 8.2, as pure functions.
 *
 * The geometry itself is CSS (see `src/styles/`), because the two docks sit in
 * different boxes: the ribbon renders outside the InputBar, which owns the side
 * clearance, so it must subtract that clearance itself; the bar renders inside
 * the InputBar, whose padding already is the clearance, so it takes the full
 * width. Both are then capped by the card's own max width and centred, which is
 * what makes their outer edges line up with the input box.
 *
 * What is left over is the part that cannot be expressed in CSS: how many
 * leading actions the `bar` layout shows before the rest fold into "more", and
 * which density the surface renders at. Both are decided here so the rules can
 * be pinned by tests rather than by a screenshot.
 */

/** How the surface presents itself at the current width (spec 8.2). */
export type SurfaceDensity = 'wide' | 'narrow'

/**
 * Below this surface width the layout drops secondary information — the section
 * title — and tightens its spacing. It never changes the outer width, and it
 * never drops a control's visible text label (spec 8.2, 8.4).
 *
 * Sized against the viewports spec 13.3 requires: a desktop or ~768px viewport
 * leaves the composer far above this, and a ~360px viewport lands well below it.
 */
export const NARROW_SURFACE_WIDTH = 480

export function densityFor(width: number): SurfaceDensity {
  return width > 0 && width < NARROW_SURFACE_WIDTH ? 'narrow' : 'wide'
}

/** One measured row of the `bar` layout. */
export interface BarFitInput {
  /** Usable inner width of the action row. */
  readonly available: number
  /** Measured width of each action control, in the shared order. */
  readonly widths: readonly number[]
  /** Width the always-visible controls ("more", "manage") need to keep. */
  readonly reserved: number
  /** Gap between adjacent controls. */
  readonly gap: number
}

/**
 * How many leading actions the `bar` layout shows (spec 8.1). The rest fold into
 * the shared action panel behind "more", and the management entry stays visible
 * whatever the answer is.
 *
 * Before the first measurement — a fresh mount, or a headless environment with
 * no layout — every width reads as zero. That answers "all of them": showing the
 * full row and letting the browser's own overflow handle it for one frame is
 * better than flashing a "more" button that the next frame withdraws.
 */
export function fitActionCount(input: BarFitInput): number {
  const { available, widths, reserved, gap } = input
  if (widths.length === 0) return 0
  if (available <= 0 || widths.every((width) => width <= 0)) return widths.length

  let used = reserved
  let shown = 0
  for (const width of widths) {
    const next = used + width + (shown === 0 && reserved === 0 ? 0 : gap)
    if (next > available) break
    used = next
    shown += 1
  }
  return shown
}
