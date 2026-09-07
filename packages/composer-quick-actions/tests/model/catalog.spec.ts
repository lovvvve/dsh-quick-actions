import { describe, expect, it } from 'vitest'
import { QUICK_ACTION_CATALOG_LIMIT, buildPresetCatalog, type PresetCatalog } from '../../src/model/index.js'
import { presetConfig as config } from './support.js'

function built(input: { builtins?: readonly unknown[]; configured?: readonly unknown[] }): PresetCatalog {
  const result = buildPresetCatalog({ builtins: input.builtins ?? [], configured: input.configured ?? [] })
  if (!result.ok) throw new Error(`catalog rejected: ${JSON.stringify(result.issues)}`)
  return result.catalog
}

describe('Preset Catalog assembly', () => {
  it('keeps built-in declaration order ahead of Host config declaration order', () => {
    const catalog = built({ builtins: [config('a'), config('b')], configured: [config('c')] })
    expect(catalog.presets.map((preset) => preset.id)).toEqual(['a', 'b', 'c'])
  })

  it('writes the send discriminant and the confirm default onto every preset', () => {
    const catalog = built({ builtins: [config('a')] })
    expect(catalog.presets[0]).toEqual({ id: 'a', kind: 'send', label: 'a', text: 'text for a', confirm: true })
  })

  it('keeps a Command Send Action preset that declares confirm false', () => {
    const catalog = built({ builtins: [config('a', { text: '/compact', confirm: false })] })
    expect(catalog.presets[0]).toMatchObject({ text: '/compact', confirm: false })
  })

  it('accepts an author who spells out the send discriminant', () => {
    expect(built({ builtins: [config('a', { kind: 'send' })] }).presets[0]?.kind).toBe('send')
  })

  it('fails the whole config when a preset declares a kind this release cannot run', () => {
    const result = buildPresetCatalog({ builtins: [], configured: [config('a', { kind: 'insert' })] })
    expect(result).toEqual({
      ok: false,
      issues: [
        { scope: 'preset', source: 'config', index: 0, id: 'a', field: 'kind', reason: 'unsupported' },
      ],
    })
  })

  it('fails the whole config on a duplicate Preset Action ID across sources', () => {
    const result = buildPresetCatalog({ builtins: [config('a')], configured: [config('a')] })
    expect(result).toEqual({
      ok: false,
      issues: [{ scope: 'preset', source: 'config', index: 0, id: 'a', field: 'id', reason: 'duplicate' }],
    })
  })

  it('reports the failing field of an invalid preset with its source and index', () => {
    const result = buildPresetCatalog({
      builtins: [config('a'), config('b', { text: '  ' })],
      configured: [config('c', { icon: 'A' })],
    })
    expect(result).toEqual({
      ok: false,
      issues: [
        { scope: 'preset', source: 'builtin', index: 1, id: 'b', field: 'text', reason: 'blank' },
        { scope: 'preset', source: 'config', index: 0, id: 'c', field: 'icon', reason: 'not-emoji' },
      ],
    })
  })

  it('refuses a declared icon that is empty rather than quietly dropping it', () => {
    const result = buildPresetCatalog({ builtins: [config('a', { icon: '' })], configured: [] })
    expect(result).toEqual({
      ok: false,
      issues: [{ scope: 'preset', source: 'builtin', index: 0, id: 'a', field: 'icon', reason: 'blank' }],
    })
  })

  it('reports a missing id without inventing one', () => {
    const result = buildPresetCatalog({ builtins: [{ label: 'x', text: 'y' }], configured: [] })
    expect(result).toEqual({
      ok: false,
      issues: [{ scope: 'preset', source: 'builtin', index: 0, id: undefined, field: 'id', reason: 'missing' }],
    })
  })

  it('accepts a catalog at the hard threshold and fails one entry above it', () => {
    const entries = Array.from({ length: QUICK_ACTION_CATALOG_LIMIT }, (_unused, index) => config(`p${index}`))
    expect(built({ builtins: entries }).presets).toHaveLength(QUICK_ACTION_CATALOG_LIMIT)

    const result = buildPresetCatalog({ builtins: entries, configured: [config('overflow')] })
    expect(result).toEqual({
      ok: false,
      issues: [
        { scope: 'catalog', reason: 'too-many', count: QUICK_ACTION_CATALOG_LIMIT + 1, limit: QUICK_ACTION_CATALOG_LIMIT },
      ],
    })
  })
})

describe('Preset Catalog revision', () => {
  it('is stable for the same catalog', () => {
    const input = { builtins: [config('a')], configured: [config('b', { icon: '\u{1F642}' })] }
    expect(built(input).revision).toBe(built(input).revision)
  })

  it.each([
    ['a changed label', config('a', { label: 'other' })],
    ['a changed text', config('a', { text: 'other' })],
    ['a changed icon', config('a', { icon: '\u{1F642}' })],
    ['a changed confirm', config('a', { confirm: false })],
    ['a changed id', config('z')],
  ])('changes for %s', (_name, changed) => {
    expect(built({ builtins: [changed] }).revision).not.toBe(built({ builtins: [config('a')] }).revision)
  })

  it('changes when only the declaration order changes', () => {
    const first = built({ builtins: [config('a'), config('b')] }).revision
    const second = built({ builtins: [config('b'), config('a')] }).revision
    expect(first).not.toBe(second)
  })
})
