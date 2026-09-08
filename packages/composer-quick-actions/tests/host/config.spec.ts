import { describe, expect, it } from 'vitest'
import { QUICK_ACTION_CATALOG_LIMIT } from '../../src/model/index.js'
import { readComposerQuickActionsConfig } from '../../src/host/config.js'
import { BUILT_IN_PRESETS } from '../../src/host/presets.js'

describe('Host config loading', () => {
  it('accepts an absent config and yields the built-in catalog', () => {
    const result = readComposerQuickActionsConfig(undefined)
    expect(result.ok).toBe(true)
    expect(result.ok && result.catalog.presets.map((preset) => preset.id)).toEqual(
      BUILT_IN_PRESETS.map((preset) => (preset as { id: string }).id),
    )
  })

  it('appends Config.presets after the built-in manifest', () => {
    const result = readComposerQuickActionsConfig({
      presets: [{ id: 'deploy', label: 'Deploy', text: 'Deploy to staging.' }],
    })
    expect(result.ok && result.catalog.presets.at(-1)).toEqual({
      id: 'deploy',
      kind: 'send',
      label: 'Deploy',
      text: 'Deploy to staging.',
      confirm: true,
    })
  })

  it('keeps a Command Send Action preset that declares confirm false', () => {
    const result = readComposerQuickActionsConfig({
      presets: [{ id: 'compact', label: 'Compact', text: '/compact', confirm: false }],
    })
    expect(result.ok && result.catalog.presets.at(-1)).toMatchObject({ text: '/compact', confirm: false })
  })

  it('fails loudly when a preset declares a kind this release cannot run', () => {
    const result = readComposerQuickActionsConfig({
      presets: [{ id: 'snippet', kind: 'insert', label: 'Snippet', text: 'x' }],
    })
    expect(result.ok).toBe(false)
    expect(!result.ok && result.message).toContain('presets[0]')
    expect(!result.ok && result.message).toContain('kind')
    expect(!result.ok && result.message).toContain('unsupported')
  })

  it('names every rejected preset so the author can fix them all at once', () => {
    const result = readComposerQuickActionsConfig({
      presets: [
        { id: 'ok', label: 'Fine', text: 'fine' },
        { id: 'blank', label: 'Blank', text: '  ' },
        { id: 'ok', label: 'Duplicate', text: 'dup' },
      ],
    })
    expect(!result.ok && result.message).toContain('presets[1]')
    expect(!result.ok && result.message).toContain('presets[2]')
    expect(!result.ok && result.message).toContain('duplicate')
  })

  it('fails when the catalog itself exceeds fifty presets', () => {
    const overflow = QUICK_ACTION_CATALOG_LIMIT + 1 - BUILT_IN_PRESETS.length
    const presets = Array.from({ length: overflow }, (_unused, index) => ({
      id: `p${index}`,
      label: `Preset ${index}`,
      text: `text ${index}`,
    }))
    const result = readComposerQuickActionsConfig({ presets })
    expect(!result.ok && result.message).toContain(String(QUICK_ACTION_CATALOG_LIMIT + 1))
    expect(!result.ok && result.message).toContain(String(QUICK_ACTION_CATALOG_LIMIT))
  })

  it('accepts a catalog that exactly fills the limit alongside the built-in manifest', () => {
    const room = QUICK_ACTION_CATALOG_LIMIT - BUILT_IN_PRESETS.length
    const presets = Array.from({ length: room }, (_unused, index) => ({
      id: `p${index}`,
      label: `Preset ${index}`,
      text: `text ${index}`,
    }))
    const result = readComposerQuickActionsConfig({ presets })
    expect(result.ok && result.catalog.presets).toHaveLength(QUICK_ACTION_CATALOG_LIMIT)
  })

  it('rejects a presets field that is not a list', () => {
    expect(readComposerQuickActionsConfig({ presets: 'nope' }).ok).toBe(false)
  })
})
