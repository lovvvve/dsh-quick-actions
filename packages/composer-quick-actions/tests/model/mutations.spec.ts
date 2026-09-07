import { describe, expect, it } from 'vitest'
import {
  QUICK_ACTION_TOTAL_LIMIT,
  newQuickActionDraft,
  planClonePresetQuickAction,
  planCreateCustomQuickAction,
  planDeleteCustomQuickAction,
  planMoveQuickAction,
  planReorderQuickActions,
  planSetCustomQuickActionEnabled,
  planSetPresetQuickActionHidden,
  planSetQuickActionLayout,
  planUpdateCustomQuickAction,
  projectQuickActions,
  readQuickActionSettings,
  type QuickActionMutationContext,
} from '../../src/model/index.js'
import { accepted, catalogOf, orderOf } from './support.js'

const catalog = catalogOf(
  { id: 'p1', label: 'Compact', text: '/compact', icon: '\u{1F9F9}', confirm: false },
  { id: 'p2', label: 'Explain', text: 'Explain this.' },
)

function context(raw: unknown = {}, revision = 'rev-1', against = catalog): QuickActionMutationContext {
  return { settings: readQuickActionSettings(raw, against), catalog: against, revision }
}

const draft = { label: 'Ship', text: 'ship it', icon: '', confirm: true }

describe('the mutation fence', () => {
  it('carries the revision the write has to be fenced to', () => {
    const outcome = planSetQuickActionLayout(context({}, 'rev-7'), { layout: 'bar' })
    expect(outcome.ok && outcome.plan.expectedRevision).toBe('rev-7')
  })

  it('reports a mutation that changes nothing', () => {
    const outcome = planSetQuickActionLayout(context({ layout: 'bar' }), { layout: 'bar' })
    expect(outcome.ok && outcome.plan.changed).toBe(false)
  })

  it('reports a mutation that changes the snapshot', () => {
    const outcome = planSetQuickActionLayout(context(), { layout: 'launcher' })
    expect(outcome.ok && outcome.plan.changed).toBe(true)
    expect(accepted(outcome).layout).toBe('launcher')
  })

  it('returns a canonical snapshot ready to persist', () => {
    const next = accepted(planCreateCustomQuickAction(context(), { id: 'a-1', draft }))
    expect(orderOf(next)).toEqual(['preset:p1', 'preset:p2', 'custom:a-1'])
  })
})

describe('creating a custom action', () => {
  it('appends it with the send discriminant and the enabled default', () => {
    const next = accepted(planCreateCustomQuickAction(context(), { id: 'a-1', draft }))
    expect(next.userActionsById['a-1']).toEqual({
      kind: 'send',
      label: 'Ship',
      text: 'ship it',
      confirm: true,
      enabled: true,
    })
  })

  it('initializes the confirmation default only here, from the new-action draft', () => {
    expect(newQuickActionDraft()).toEqual({ label: '', text: '', icon: '', confirm: true })
  })

  it('keeps a Command Send Action the author unconfirmed at creation time', () => {
    const next = accepted(
      planCreateCustomQuickAction(context(), { id: 'a-1', draft: { ...draft, text: '/compact', confirm: false } }),
    )
    expect(next.userActionsById['a-1']).toMatchObject({ text: '/compact', confirm: false })
  })

  it('reports the failing fields instead of saving a broken action', () => {
    const outcome = planCreateCustomQuickAction(context(), { id: 'a-1', draft: { ...draft, label: '  ' } })
    expect(outcome).toEqual({
      ok: false,
      rejection: { reason: 'invalid-fields', issues: [{ field: 'label', reason: 'blank' }] },
    })
  })

  it('refuses a Custom Action ID that is already taken so the caller mints another', () => {
    const seeded = accepted(planCreateCustomQuickAction(context(), { id: 'a-1', draft }))
    const outcome = planCreateCustomQuickAction(
      { settings: seeded, catalog, revision: 'rev-1' },
      { id: 'a-1', draft },
    )
    expect(outcome).toEqual({
      ok: false,
      rejection: { reason: 'id-in-use', issues: [{ field: 'id', reason: 'duplicate' }] },
    })
  })
})

describe('cloning a preset', () => {
  it('copies the content and the confirmation policy as they stand, with a fresh identity', () => {
    const next = accepted(planClonePresetQuickAction(context(), { presetId: 'p1', id: 'a-1' }))
    expect(next.userActionsById['a-1']).toEqual({
      kind: 'send',
      label: 'Compact',
      text: '/compact',
      icon: '\u{1F9F9}',
      confirm: false,
      enabled: true,
      clonedFromPresetId: 'p1',
    })
  })

  it('refuses to clone a preset the catalog does not carry', () => {
    const outcome = planClonePresetQuickAction(context(), { presetId: 'retired', id: 'a-1' })
    expect(outcome).toEqual({
      ok: false,
      rejection: { reason: 'unknown-action', issues: [{ field: 'id', reason: 'missing' }] },
    })
  })
})

describe('editing a custom action', () => {
  const seeded = () => {
    const next = accepted(
      planCreateCustomQuickAction(context(), { id: 'a-1', draft: { ...draft, text: '/compact', confirm: false } }),
    )
    return { settings: next, catalog, revision: 'rev-1' }
  }

  it('saves the edited content and keeps the enabled state', () => {
    const next = accepted(
      planUpdateCustomQuickAction(seeded(), { id: 'a-1', draft: { ...draft, label: 'Renamed', confirm: false } }),
    )
    expect(next.userActionsById['a-1']).toMatchObject({ label: 'Renamed', confirm: false, enabled: true })
  })

  it('never restores the confirmation the user switched off', () => {
    const next = accepted(planUpdateCustomQuickAction(seeded(), { id: 'a-1', draft: { ...draft, text: '/clear', confirm: false } }))
    expect(next.userActionsById['a-1']).toMatchObject({ text: '/clear', confirm: false })
  })

  it('disables and re-enables without touching the rest of the value', () => {
    const disabled = accepted(planSetCustomQuickActionEnabled(seeded(), { id: 'a-1', enabled: false }))
    expect(disabled.userActionsById['a-1']).toMatchObject({ enabled: false, confirm: false })
    const projection = projectQuickActions(disabled, catalog)
    expect(projection.composer.map((action) => action.ref.id)).not.toContain('a-1')
  })

  it('deletes the action and its order reference together', () => {
    const next = accepted(planDeleteCustomQuickAction(seeded(), { id: 'a-1' }))
    expect(next.userActionsById['a-1']).toBe(undefined)
    expect(orderOf(next)).toEqual(['preset:p1', 'preset:p2'])
  })

  it.each([
    ['update', (ctx: QuickActionMutationContext) => planUpdateCustomQuickAction(ctx, { id: 'ghost', draft })],
    ['enable', (ctx: QuickActionMutationContext) => planSetCustomQuickActionEnabled(ctx, { id: 'ghost', enabled: false })],
    ['delete', (ctx: QuickActionMutationContext) => planDeleteCustomQuickAction(ctx, { id: 'ghost' })],
  ])('refuses to %s an action it cannot render', (_name, mutate) => {
    const ctx = context({ userActionsById: { ghost: { kind: 'insert', label: 'Ghost', text: 'g' } } })
    expect(mutate(ctx)).toEqual({
      ok: false,
      rejection: { reason: 'unknown-action', issues: [{ field: 'id', reason: 'missing' }] },
    })
  })
})

describe('hiding a preset', () => {
  it('hides and restores it', () => {
    const hidden = accepted(planSetPresetQuickActionHidden(context(), { presetId: 'p2', hidden: true }))
    expect(hidden.presetStateById).toEqual({ p2: { hidden: true } })
    const restored = accepted(
      planSetPresetQuickActionHidden({ settings: hidden, catalog, revision: 'rev-1' }, { presetId: 'p2', hidden: false }),
    )
    expect(restored.presetStateById).toEqual({})
  })

  it('refuses a preset the catalog does not carry', () => {
    const outcome = planSetPresetQuickActionHidden(context(), { presetId: 'retired', hidden: true })
    expect(outcome.ok).toBe(false)
  })
})

describe('reordering', () => {
  const seeded = () =>
    context({
      userActionsById: { 'a-1': { kind: 'send', label: 'Ship', text: 'ship', confirm: true, enabled: true } },
      actionOrder: [
        { source: 'preset', id: 'p1' },
        { source: 'preset', id: 'retired' },
        { source: 'preset', id: 'p2' },
        { source: 'custom', id: 'a-1' },
      ],
    })

  it('applies a new order to the actions the user can see', () => {
    const next = accepted(
      planReorderQuickActions(seeded(), {
        order: [
          { source: 'custom', id: 'a-1' },
          { source: 'preset', id: 'p2' },
          { source: 'preset', id: 'p1' },
        ],
      }),
    )
    expect(orderOf(next)).toEqual(['custom:a-1', 'preset:retired', 'preset:p2', 'preset:p1'])
  })

  it('rejects an order that is not a permutation of the managed actions', () => {
    const outcome = planReorderQuickActions(seeded(), { order: [{ source: 'preset', id: 'p1' }] })
    expect(outcome).toEqual({ ok: false, rejection: { reason: 'invalid-order', issues: [] } })
  })

  it('moves one action to a new position in the managed list', () => {
    const next = accepted(planMoveQuickAction(seeded(), { ref: { source: 'custom', id: 'a-1' }, toIndex: 0 }))
    expect(orderOf(next)).toEqual(['custom:a-1', 'preset:retired', 'preset:p1', 'preset:p2'])
  })

  it('refuses to move an action that is not in the managed list', () => {
    const outcome = planMoveQuickAction(seeded(), { ref: { source: 'preset', id: 'retired' }, toIndex: 0 })
    expect(outcome.ok).toBe(false)
  })
})

describe('the fifty action ceiling', () => {
  const full = () => {
    const userActionsById = Object.fromEntries(
      Array.from({ length: QUICK_ACTION_TOTAL_LIMIT }, (_unused, index) => [
        `a-${index}`,
        { kind: 'send', label: `Custom ${index}`, text: `text ${index}`, confirm: true, enabled: true },
      ]),
    )
    return context({ userActionsById }, 'rev-1', catalogOf())
  }

  it('refuses a new action at the ceiling', () => {
    expect(planCreateCustomQuickAction(full(), { id: 'a-new', draft })).toEqual({
      ok: false,
      rejection: { reason: 'limit-reached', issues: [] },
    })
  })

  it('refuses a clone at the ceiling', () => {
    const ctx = { ...full(), catalog }
    expect(planClonePresetQuickAction(ctx, { presetId: 'p1', id: 'a-new' }).ok).toBe(false)
  })

  it('still allows editing, disabling, deleting and reordering while passively over the ceiling', () => {
    const base = full()
    const over = { ...base, catalog, settings: readQuickActionSettings(base.settings, catalog) }
    expect(projectQuickActions(over.settings, catalog).counts.overflow).toBe(true)
    expect(planUpdateCustomQuickAction(over, { id: 'a-0', draft }).ok).toBe(true)
    expect(planSetCustomQuickActionEnabled(over, { id: 'a-0', enabled: false }).ok).toBe(true)
    expect(planSetPresetQuickActionHidden(over, { presetId: 'p1', hidden: true }).ok).toBe(true)
    expect(planDeleteCustomQuickAction(over, { id: 'a-0' }).ok).toBe(true)
  })
})
