/**
 * The dictionary contract of spec 8.4: two shipped languages carrying the same
 * key set, and no composed key able to leak onto a surface.
 *
 * The key *union* is a compile-time type, so a missing entry is already a build
 * error. What is checked here is what the type cannot see: that the two
 * languages agree on the interpolation parameters, that no entry is blank, and
 * that every field issue the shared model can produce from the management form
 * has a sentence of its own rather than falling back to the general one.
 */
import { describe, expect, it } from 'vitest'
import {
  en,
  quickActionIssueKey,
  quickActionsDictionaries,
  quickActionsLocaleKey,
  zh,
} from '../../src/locales/index.js'
import {
  QUICK_ACTION_ICON_MAX_CLUSTERS,
  QUICK_ACTION_LABEL_MAX_CODE_POINTS,
  QUICK_ACTION_TEXT_MAX_CODE_POINTS,
  validateQuickActionDraft,
} from '../../src/model/index.js'
import type { QuickActionDraft } from '../../src/model/index.js'

/** The `{name}` placeholders one entry interpolates. */
function paramsOf(template: string): readonly string[] {
  return [...template.matchAll(/\{(\w+)\}/g)].map((match) => match[1] ?? '').sort()
}

describe('the shipped dictionaries', () => {
  it('registers exactly the two languages spec 8.4 requires', () => {
    expect(Object.keys(quickActionsDictionaries).sort()).toEqual(['en', 'zh'])
  })

  it('carries the same keys in both languages', () => {
    expect(Object.keys(en).sort()).toEqual(Object.keys(zh).sort())
  })

  it('leaves no entry blank', () => {
    for (const [language, dictionary] of Object.entries(quickActionsDictionaries)) {
      for (const [key, value] of Object.entries(dictionary)) {
        expect(value.trim(), `${language}:${key}`).not.toBe('')
      }
    }
  })

  it('interpolates the same parameters in both languages', () => {
    // A translation that dropped `{count}` or `{message}` would silently lose the
    // only part of the sentence that carries the state.
    for (const key of Object.keys(zh) as (keyof typeof zh)[]) {
      expect(paramsOf(en[key]), `en:${key}`).toEqual(paramsOf(zh[key]))
    }
  })
})

describe('composed keys', () => {
  it('passes a shipped key through and falls back for anything else', () => {
    expect(quickActionsLocaleKey('write.conflict', 'write.refused')).toBe('write.conflict')
    expect(quickActionsLocaleKey('write.invented-upstream', 'write.refused')).toBe('write.refused')
  })

  it('names every field issue the management form can produce', () => {
    // Each draft is refused for one specific reason; the dictionary must have a
    // sentence for each, not the general fallback (spec 4.3, 8.3).
    const drafts: readonly QuickActionDraft[] = [
      { label: '', text: 'ok', icon: '', confirm: true },
      { label: 'x'.repeat(QUICK_ACTION_LABEL_MAX_CODE_POINTS + 1), text: 'ok', icon: '', confirm: true },
      { label: 'ok', text: '   ', icon: '', confirm: true },
      { label: 'ok', text: 'x'.repeat(QUICK_ACTION_TEXT_MAX_CODE_POINTS + 1), icon: '', confirm: true },
      { label: 'ok', text: 'holds ￼ a placeholder', icon: '', confirm: true },
      { label: 'ok', text: 'ok', icon: 'ab', confirm: true },
      { label: 'ok', text: 'ok', icon: '🧹'.repeat(QUICK_ACTION_ICON_MAX_CLUSTERS + 1), confirm: true },
    ]

    const named = drafts.flatMap((draft) => {
      const validated = validateQuickActionDraft(draft)
      expect(validated.ok).toBe(false)
      return validated.ok ? [] : validated.issues.map(quickActionIssueKey)
    })

    expect(named).not.toContain('issue.invalid')
    expect(new Set(named).size).toBe(drafts.length)
  })
})
