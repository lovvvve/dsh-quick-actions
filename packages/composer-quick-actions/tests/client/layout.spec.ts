/**
 * The width, density and overflow rules of spec 8.2, plus the Resident Composer
 * registry's own bookkeeping.
 *
 * The equal-width requirement is pinned here as the formula the stylesheet
 * declares: the ribbon subtracts the side clearance the InputBar owns, takes the
 * composer card's max width and centres. The bar makes no equal-width claim since
 * spec 22.9 — it is a content-sized member of DSH's composer dock row — so its
 * rule only has to stay shrinkable and capped. Measuring the rendered result to
 * the CSS pixel is the GUI verification task's job; keeping the formula from
 * drifting is this suite's.
 */
import { describe, expect, it } from 'vitest'
import { NARROW_SURFACE_WIDTH, densityFor, fitActionCount } from '../../src/client/surfaces/layout.js'
import { createResidentComposerRegistry } from '../../src/client/surfaces/residency.js'
import { QUICK_ACTIONS_CSS } from '../../src/styles/index.js'

describe('the surface width formula', () => {
  it('subtracts the InputBar clearance for the ribbon, which renders outside it', () => {
    expect(QUICK_ACTIONS_CSS).toContain(
      'width: calc(100% - var(--dsh-composer-side-clearance) - var(--dsh-composer-side-clearance));',
    )
  })

  it('caps the ribbon at the composer card width and centres it', () => {
    const rule = QUICK_ACTIONS_CSS.split('}').find((candidate) => candidate.includes('.dsh-cqa-ribbon,'))
    expect(rule).toContain('max-width: var(--dsh-composer-card-max-width);')
    expect(rule).toContain('margin: 0 auto;')
  })

  it('leaves the bar content-sized and shrinkable inside DSH\'s dock row (spec 22.9)', () => {
    const bar = QUICK_ACTIONS_CSS.slice(QUICK_ACTIONS_CSS.indexOf('.dsh-cqa-bar {'))
    const rule = bar.slice(0, bar.indexOf('}'))
    // A width of its own would be a percentage of a row DSH sizes to its content: at
    // best a no-op, at worst a flex basis as wide as the row, squeezing DSH's own pills.
    expect(rule).not.toMatch(/(^|[\s;{])width:/)
    // DSH centres the row; an auto margin would claim space the row never has.
    expect(rule).not.toContain('margin: 0 auto;')
    expect(rule).toContain('min-width: 0;')
    expect(rule).toContain('max-width: var(--dsh-composer-card-max-width);')
  })

  it("widens a bar that has to fold to the composer card, for the dock row to cap", () => {
    // Content-sized, a folding bar would measure only what it already shows (spec 22.9).
    // The card width is a plain length in the main conversation body, so it can open up
    // a row DSH sizes to its content; the row's own `max-width: 100%` caps it.
    const rule = QUICK_ACTIONS_CSS.split('}').find((candidate) => candidate.includes('.dsh-cqa-bar[data-quick-actions-overflow]'))
    expect(rule).toContain('width: var(--dsh-composer-card-max-width);')
  })

  it('defines no colour of its own, only DSH alias theme tokens', () => {
    const colours = QUICK_ACTIONS_CSS.match(/(#[0-9a-fA-F]{3,8}\b|\brgba?\(|\bhsla?\()/g)
    expect(colours).toBeNull()
  })
})

describe('the density rule', () => {
  it('is wide on a desktop and a ~768px viewport, narrow on a ~360px one', () => {
    // The composer card is the viewport less two 16px clearances.
    expect(densityFor(1200 - 32)).toBe('wide')
    expect(densityFor(768 - 32)).toBe('wide')
    expect(densityFor(360 - 32)).toBe('narrow')
  })

  it('stays wide until the threshold, and before the first measurement', () => {
    expect(densityFor(NARROW_SURFACE_WIDTH)).toBe('wide')
    expect(densityFor(NARROW_SURFACE_WIDTH - 1)).toBe('narrow')
    expect(densityFor(0)).toBe('wide')
  })
})

describe('the bar overflow split', () => {
  it('shows the leading actions that fit and folds the rest away', () => {
    expect(fitActionCount({ available: 200, widths: [80, 80, 80], reserved: 0, gap: 8 })).toBe(2)
  })

  it('keeps room for the controls that must stay visible', () => {
    expect(fitActionCount({ available: 200, widths: [80, 80], reserved: 100, gap: 8 })).toBe(1)
  })

  it('does not fold an action away over a sub-pixel difference', () => {
    // A content-sized bar measures a region exactly as wide as the controls it shows
    // (spec 22.9): three 52.6 px faces and two gaps. Fractional layout can report that
    // region a hair narrower, and folding one face over it would shrink the region
    // again — the start of a cascade.
    expect(fitActionCount({ available: 173.5, widths: [52.6, 52.6, 52.6], reserved: 0, gap: 8 })).toBe(3)
    // A real shortfall still folds.
    expect(fitActionCount({ available: 172.5, widths: [52.6, 52.6, 52.6], reserved: 0, gap: 8 })).toBe(2)
  })

  it('folds everything away when not even the first action fits', () => {
    expect(fitActionCount({ available: 40, widths: [80, 80], reserved: 0, gap: 8 })).toBe(0)
  })

  it('shows everything before the first measurement rather than flashing an overflow entry', () => {
    expect(fitActionCount({ available: 0, widths: [0, 0], reserved: 0, gap: 8 })).toBe(2)
    expect(fitActionCount({ available: 200, widths: [0, 0], reserved: 0, gap: 8 })).toBe(2)
  })

  it('answers zero for an empty projection', () => {
    expect(fitActionCount({ available: 200, widths: [], reserved: 0, gap: 8 })).toBe(0)
  })
})

describe('the Resident Composer registry', () => {
  it('starts with no Session resident', () => {
    const registry = createResidentComposerRegistry()
    expect(registry.isResident('session-1')).toBe(false)
  })

  it('publishes a mark and withdraws it', () => {
    const registry = createResidentComposerRegistry()
    const seen: boolean[] = []
    registry.subscribe(() => {
      seen.push(registry.isResident('session-1'))
    })

    const withdraw = registry.mark('session-1')
    expect(registry.isResident('session-1')).toBe(true)
    withdraw()

    expect(registry.isResident('session-1')).toBe(false)
    expect(seen).toEqual([true, false])
  })

  it('keeps a Session resident across an overlapping remount', () => {
    const registry = createResidentComposerRegistry()
    const first = registry.mark('session-1')
    const second = registry.mark('session-1')

    first()
    expect(registry.isResident('session-1')).toBe(true)
    second()
    expect(registry.isResident('session-1')).toBe(false)
  })

  it('ignores a withdrawal that already ran', () => {
    const registry = createResidentComposerRegistry()
    const withdraw = registry.mark('session-1')
    withdraw()
    withdraw()
    expect(registry.isResident('session-1')).toBe(false)
  })

  it('tracks each Session on its own', () => {
    const registry = createResidentComposerRegistry()
    registry.mark('session-1')
    expect(registry.isResident('session-2')).toBe(false)
  })
})
