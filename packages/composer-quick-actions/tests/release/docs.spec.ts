/**
 * The readmes as a contract.
 *
 * Two kinds of regression are worth a test here. The first is a gap: spec 12
 * enumerates what a reader must be able to find, and a readme that quietly
 * loses the Settings paths or the uninstall path leaves a user with no way to
 * undo an install. The second is a revival: several decisions in this effort
 * were closed by overriding an earlier answer (spec 16 and 17), and the closed
 * vocabulary is exactly what a future edit is most likely to write back in.
 *
 * The assertions are anchored on content, not on headings, so the documents can
 * be reorganized freely as long as they still say these things. Version-bearing
 * needles are composed from the manifest, so a version bump fails here and names
 * the documents that still carry the old one.
 */
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { featureDir, manifest, releasedVersion } from './support.js'

const version = releasedVersion()

/**
 * The declared DSH floor and the bare version inside it, both taken from the
 * manifest so a floor bump fails here and names the readmes that still carry the
 * old one. The floor range is what the readmes must print as the peer
 * requirement; the bare version is what they must print as the baseline the
 * release was verified against.
 */
const dshFloorRange = manifest(featureDir).peerDependencies?.['@deepseek-ai/dsh-client-ui-conversation']
if (dshFloorRange === undefined) throw new Error('the manifest declares no DSH peer floor')
const dshFloor = dshFloorRange.replace(/^[>=^~\s]+/, '')

/** Quote a literal for use inside a `RegExp` source. */
function escapeRegExp(literal: string): string {
  return literal.replace(/[.*+?^${}()|[\]\\]/g, String.raw`\$&`)
}

// Ticket 28 folded the second package back in, so the two readmes of the one package are
// the whole documented surface.
const docs = {
  'feature README.md': readFileSync(join(featureDir, 'README.md'), 'utf8'),
  'feature README.en.md': readFileSync(join(featureDir, 'README.en.md'), 'utf8'),
}

const featureDocs = ['feature README.md', 'feature README.en.md'] as const

/**
 * What every reader must be able to find in the feature readme, whichever
 * language they read (spec 12). Each entry is the substance, not the phrasing.
 */
const REQUIRED_IN_FEATURE_DOCS: readonly (readonly [string, readonly string[]])[] = [
  ['the install command', ['dsh plugin --profile web add']],
  ['the uninstall command', ['dsh plugin --profile web remove']],
  ['the local tarball flow', ['pnpm pack']],
  ['both Settings namespaces', ['composer-quick-actions-catalog']],
  ['the Settings file path', ['settings.yaml']],
  ['the preset authorization channel', ['Config.presets']],
  ['all three layouts', ['ribbon', 'bar', 'launcher']],
  ['the send action loading path', ['setDraft', 'submit']],
  ['the action limit', ['50']],
  ['the dev build and watch commands', ['pnpm build', 'pnpm watch:client']],
  ['the GUI HMR prerequisite', ['HMR']],
  ['the future insert-action effort', ['insertText']],
  ['the peer floor as declared', [dshFloorRange]],
  ['the full manual cleanup path', ['pnpm-workspace.yaml']],
]

/**
 * Vocabulary that named a decision this effort reversed, plus the two claims the
 * spec forbids making at all: a fabricated first supported DSH release, and any
 * instruction to edit an Agent preset.
 */
const FORBIDDEN_EVERYWHERE: readonly (readonly [string, readonly string[]])[] = [
  ['a capability matrix (spec 16.1 removed capability detection)', ['能力矩阵', 'capability matrix']],
  ['Compatibility-Suppressed actions (spec 16.1)', ['兼容性抑制', 'Compatibility-Suppressed']],
  ['a fabricated minimum DSH version (spec 12)', ['最低 DSH 版本', 'minimum DSH version', 'dsh-v0.1.3-alpha.1']],
  ['an instruction to edit an Agent preset (spec 12)', ['Agent preset', 'Agent 预设']],
  ['an instruction to edit installed node_modules (spec 12)', ['修改 node_modules', 'edit node_modules']],
]

describe('feature readme coverage', () => {
  for (const [subject, needles] of REQUIRED_IN_FEATURE_DOCS) {
    for (const doc of featureDocs) {
      it(`${doc} documents ${subject}`, () => {
        for (const needle of needles) expect(docs[doc]).toContain(needle)
      })
    }
  }

  it('gives the verified baseline its own compatibility row in both languages', () => {
    // The peer floor prints the baseline version as a substring of its own
    // range, so a bare `toContain(dshFloor)` cannot tell the two rows apart and
    // passes even with the baseline row deleted. Anchor on the row itself: its
    // label and the version have to share one table line.
    const row = (label: string) =>
      new RegExp(String.raw`^\|\s*` + label + String.raw`\s*\|[^|\n]*` + escapeRegExp(dshFloor), 'm')
    expect(docs['feature README.md']).toMatch(row('验证基线'))
    expect(docs['feature README.en.md']).toMatch(row('Verified baseline'))
  })

  it('documents upgrade and downgrade in both languages', () => {
    expect(docs['feature README.md']).toContain('升级')
    expect(docs['feature README.md']).toContain('降级')
    expect(docs['feature README.en.md']).toMatch(/upgrade/i)
    expect(docs['feature README.en.md']).toMatch(/downgrade/i)
  })

  it('states in both languages that the first release ships only the send action', () => {
    expect(docs['feature README.md']).toContain('不提供插入动作')
    expect(docs['feature README.en.md']).toMatch(/no insert action/i)
  })

  it('gives the Command Send Action its own explanation in both languages', () => {
    expect(docs['feature README.md']).toContain('命令发送动作')
    expect(docs['feature README.en.md']).toContain('Command Send Action')
  })

  it('warns in both languages that the confirmation panel shows no native candidate menu', () => {
    expect(docs['feature README.md']).toContain('候选菜单')
    expect(docs['feature README.en.md']).toMatch(/candidate menu/i)
  })
})

describe('every readme carries the released version it names', () => {
  for (const doc of Object.keys(docs) as (keyof typeof docs)[]) {
    it(`${doc} names the tarball of the current version only`, () => {
      const mentioned = [...docs[doc].matchAll(/dsh-quick-actions-(\d[^.\s]*(?:\.[^.\s]*)*)\.tgz/g)]
        .map((match) => match[1] as string)
      expect([...new Set(mentioned)]).toStrictEqual([version])
    })
  }
})

describe('closed decisions stay closed', () => {
  for (const [subject, needles] of FORBIDDEN_EVERYWHERE) {
    for (const doc of Object.keys(docs) as (keyof typeof docs)[]) {
      it(`${doc} does not revive ${subject}`, () => {
        for (const needle of needles) expect(docs[doc]).not.toContain(needle)
      })
    }
  }
})
