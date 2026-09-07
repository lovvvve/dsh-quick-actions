import { describe, expect, it } from 'vitest'
import {
  QUICK_ACTION_LABEL_MAX_CODE_POINTS,
  QUICK_ACTION_TEXT_MAX_CODE_POINTS,
  validateQuickActionDraft,
  type QuickActionDraft,
} from '../../src/model/index.js'

function draft(overrides: Partial<QuickActionDraft> = {}): QuickActionDraft {
  return { label: 'Summarize', text: 'Summarize this thread.', icon: '', confirm: true, ...overrides }
}

describe('Quick Action draft validation', () => {
  it('saves the label trimmed and keeps the text whitespace untouched', () => {
    const result = validateQuickActionDraft(draft({ label: '  Summarize  ', text: '  keep\n  me  ' }))
    expect(result).toEqual({
      ok: true,
      value: { label: 'Summarize', text: '  keep\n  me  ', icon: undefined, confirm: true },
    })
  })

  it('reads an empty icon as no icon', () => {
    const result = validateQuickActionDraft(draft({ icon: '' }))
    expect(result.ok && result.value.icon).toBe(undefined)
  })

  it('keeps an emoji icon', () => {
    const result = validateQuickActionDraft(draft({ icon: '\u{1F642}' }))
    expect(result.ok && result.value.icon).toBe('\u{1F642}')
  })

  it('accepts a Command Send Action with confirmation switched off', () => {
    const result = validateQuickActionDraft(draft({ text: '/compact', confirm: false }))
    expect(result).toEqual({
      ok: true,
      value: { label: 'Summarize', text: '/compact', icon: undefined, confirm: false },
    })
  })

  it('rejects a label that is blank once trimmed', () => {
    expect(validateQuickActionDraft(draft({ label: '   ' }))).toEqual({
      ok: false,
      issues: [{ field: 'label', reason: 'blank' }],
    })
  })

  it('measures the label limit in code points after trimming', () => {
    const atLimit = '\u{1F642}'.repeat(QUICK_ACTION_LABEL_MAX_CODE_POINTS)
    expect(validateQuickActionDraft(draft({ label: ` ${atLimit} ` })).ok).toBe(true)
    expect(validateQuickActionDraft(draft({ label: `${atLimit}\u{1F642}` }))).toEqual({
      ok: false,
      issues: [{ field: 'label', reason: 'too-long' }],
    })
  })

  it('rejects text that holds only whitespace', () => {
    expect(validateQuickActionDraft(draft({ text: ' \n\t' }))).toEqual({
      ok: false,
      issues: [{ field: 'text', reason: 'blank' }],
    })
  })

  it('measures the text limit in code points without trimming', () => {
    const atLimit = '\u{1F642}'.repeat(QUICK_ACTION_TEXT_MAX_CODE_POINTS)
    expect(validateQuickActionDraft(draft({ text: atLimit })).ok).toBe(true)
    expect(validateQuickActionDraft(draft({ text: `${atLimit}\u{1F642}` }))).toEqual({
      ok: false,
      issues: [{ field: 'text', reason: 'too-long' }],
    })
  })

  it('rejects text carrying a DSH reserved reference placeholder', () => {
    expect(validateQuickActionDraft(draft({ text: 'quote \u{FFFC} here' }))).toEqual({
      ok: false,
      issues: [{ field: 'text', reason: 'reserved-placeholder' }],
    })
  })

  it('rejects an icon that is not made of emoji', () => {
    expect(validateQuickActionDraft(draft({ icon: 'A' }))).toEqual({
      ok: false,
      issues: [{ field: 'icon', reason: 'not-emoji' }],
    })
  })

  it('rejects an icon longer than four emoji clusters', () => {
    expect(validateQuickActionDraft(draft({ icon: '\u{1F642}'.repeat(4) })).ok).toBe(true)
    expect(validateQuickActionDraft(draft({ icon: '\u{1F642}'.repeat(5) }))).toEqual({
      ok: false,
      issues: [{ field: 'icon', reason: 'too-long' }],
    })
  })

  it('reports every failing field in declaration order', () => {
    expect(validateQuickActionDraft({ label: '', text: '', icon: 'A', confirm: true })).toEqual({
      ok: false,
      issues: [
        { field: 'label', reason: 'blank' },
        { field: 'text', reason: 'blank' },
        { field: 'icon', reason: 'not-emoji' },
      ],
    })
  })
})
