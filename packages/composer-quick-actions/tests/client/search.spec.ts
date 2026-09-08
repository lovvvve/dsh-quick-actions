/**
 * The shared action panel's search rule (spec 8.1).
 *
 * Spec 8.1 requires the search to actually filter, to keep the matches in their
 * `actionOrder` relative order, and to have its searched fields, case handling
 * and Unicode normalization defined by the implementation and pinned by tests.
 * This file is that pin.
 */
import { describe, expect, it } from 'vitest'
import { filterQuickActions, normalizeQuickActionSearchText } from '../../src/client/manager/search.js'
import type { ProjectedQuickAction } from '../../src/model/index.js'

function action(overrides: Partial<ProjectedQuickAction> & { readonly id: string }): ProjectedQuickAction {
  const { id, ...rest } = overrides
  return {
    ref: { source: 'custom', id },
    label: id,
    text: `text for ${id}`,
    icon: undefined,
    confirm: false,
    command: false,
    editable: true,
    hidden: false,
    clonedFromPresetId: undefined,
    ...rest,
  }
}

describe('the searched fields', () => {
  it('matches a Quick Action on its label', () => {
    const actions = [action({ id: 'a', label: 'Summarize thread' }), action({ id: 'b', label: 'Explain change' })]

    expect(filterQuickActions(actions, 'summarize').map((found) => found.ref.id)).toEqual(['a'])
  })

  it('matches a Quick Action on its static text', () => {
    const actions = [action({ id: 'a', label: 'A', text: '/compact' }), action({ id: 'b', label: 'B', text: 'plain' })]

    expect(filterQuickActions(actions, '/compact').map((found) => found.ref.id)).toEqual(['a'])
  })

  it('does not match on the icon, which is decorative only', () => {
    // Spec 8.4: an emoji is decoration, never an accessible or searchable name.
    const actions = [action({ id: 'a', label: 'A', text: 'plain', icon: '🧹' })]

    expect(filterQuickActions(actions, '🧹')).toEqual([])
  })

  it('reports no match rather than falling back to the full list', () => {
    const actions = [action({ id: 'a', label: 'A', text: 'plain' })]

    expect(filterQuickActions(actions, 'nothing here')).toEqual([])
  })
})

describe('case and Unicode normalization', () => {
  it('ignores case in both directions', () => {
    const actions = [action({ id: 'a', label: 'Summarize' })]

    expect(filterQuickActions(actions, 'SUMMARIZE')).toHaveLength(1)
    expect(filterQuickActions([action({ id: 'a', label: 'SUMMARIZE' })], 'summarize')).toHaveLength(1)
  })

  it('folds compatibility forms, so a full-width query finds half-width text', () => {
    const actions = [action({ id: 'a', label: 'Compact' })]

    expect(filterQuickActions(actions, 'Ｃｏｍｐａｃｔ')).toHaveLength(1)
    expect(filterQuickActions([action({ id: 'a', label: 'ＣＯＭＰＡＣＴ' })], 'compact')).toHaveLength(1)
  })

  it('folds every run of whitespace, so a one-line query finds multi-line text', () => {
    const actions = [action({ id: 'a', label: 'A', text: '总结当前对话：\n已确定的结论' })]

    expect(filterQuickActions(actions, '对话： 已确定')).toHaveLength(1)
  })

  it('normalizes a query and a haystack through the same function', () => {
    expect(normalizeQuickActionSearchText('  Ｃｏｍｐａｃｔ\n\tＴＨＩＳ  ')).toBe('compact this')
  })
})

describe('an empty query', () => {
  it('filters nothing, and hands back the very same list', () => {
    const actions = [action({ id: 'a' }), action({ id: 'b' })]

    // Identity, not just equality: an unsearched panel must not remount its rows.
    expect(filterQuickActions(actions, '')).toBe(actions)
  })

  it('treats a whitespace-only query as empty', () => {
    const actions = [action({ id: 'a' }), action({ id: 'b' })]

    expect(filterQuickActions(actions, '   \n ')).toBe(actions)
  })
})

describe('the order of the matches', () => {
  it('keeps the actionOrder relative order rather than ranking by relevance', () => {
    const actions = [
      action({ id: 'first', label: 'zzz send' }),
      action({ id: 'second', label: 'send' }),
      action({ id: 'third', label: 'aaa send' }),
    ]

    // An exact match on `second` must not be promoted above `first`.
    expect(filterQuickActions(actions, 'send').map((found) => found.ref.id)).toEqual(['first', 'second', 'third'])
  })
})
