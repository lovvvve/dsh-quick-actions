import { describe, expect, it } from 'vitest'
import {
  containsReservedReferencePlaceholder,
  countCodePoints,
  isBlankQuickActionText,
  isCommandSendActionText,
  scanEmojiClusters,
} from '../../src/model/index.js'

describe('Command Send Action detection', () => {
  it('treats a leading slash as a command', () => {
    expect(isCommandSendActionText('/compact')).toBe(true)
  })

  it('treats whitespace before the slash as a command', () => {
    expect(isCommandSendActionText('  \n\t/compact')).toBe(true)
  })

  it('treats text that does not start with a slash as a plain send action', () => {
    expect(isCommandSendActionText('run /compact now')).toBe(false)
  })
})

describe('Unicode measurement', () => {
  it('counts astral characters as one code point each', () => {
    expect(countCodePoints('\u{1F642}\u{1F642}')).toBe(2)
    expect('\u{1F642}\u{1F642}'.length).toBe(4)
  })

  it('counts a combining sequence by its code points, not its grapheme clusters', () => {
    expect(countCodePoints('e\u{0301}')).toBe(2)
  })
})

describe('blank text', () => {
  it('rejects text made only of ECMAScript trim() whitespace', () => {
    expect(isBlankQuickActionText(' \t\n\r\u{3000}\u{FEFF}')).toBe(true)
  })

  it('accepts text with any non-whitespace character', () => {
    expect(isBlankQuickActionText('  x  ')).toBe(false)
  })
})

describe('reserved reference placeholders', () => {
  it.each(['\u{E100}', '\u{E11D}', '\u{FFFC}'])('rejects text carrying %s', (placeholder) => {
    expect(containsReservedReferencePlaceholder(`ok${placeholder}ok`)).toBe(true)
  })

  it('accepts private-use code points outside the reserved reference range', () => {
    expect(containsReservedReferencePlaceholder('\u{E0FF}\u{E11E}')).toBe(false)
  })
})

describe('emoji cluster scanning', () => {
  it.each([
    ['a single emoji', '\u{1F642}'],
    ['an emoji with a skin tone modifier', '\u{1F44D}\u{1F3FD}'],
    ['a ZWJ family sequence', '\u{1F468}\u{200D}\u{1F469}\u{200D}\u{1F467}'],
    ['a regional indicator flag', '\u{1F1E8}\u{1F1F3}'],
    ['a keycap sequence', '1\u{FE0F}\u{20E3}'],
  ])('counts %s as one emoji cluster', (_name, icon) => {
    expect(scanEmojiClusters(icon)).toEqual({ clusters: 1, emojiOnly: true })
  })

  it('counts each emoji cluster separately', () => {
    expect(scanEmojiClusters('\u{1F642}\u{1F44D}\u{1F1E8}\u{1F1F3}')).toEqual({ clusters: 3, emojiOnly: true })
  })

  it('reports plain letters as not emoji', () => {
    expect(scanEmojiClusters('A')).toEqual({ clusters: 1, emojiOnly: false })
  })

  it('reports a mixed icon as not emoji while still counting its clusters', () => {
    expect(scanEmojiClusters('\u{1F642} ')).toEqual({ clusters: 2, emojiOnly: false })
  })

  it('reports an empty icon as zero clusters', () => {
    expect(scanEmojiClusters('')).toEqual({ clusters: 0, emojiOnly: true })
  })
})
