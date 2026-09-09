// Seed the plugin's Settings namespace with a given number of actions, then let the
// profile boot into it. Spec 13.2's scale rows (0, 1, 6, 25, 50 and the 53-action passive
// overflow) arise from stored state, so this writes that state instead of driving the
// management overlay 50 times. Presets are hidden when the target is below three, and
// custom actions make up the rest.
//
//   node tests/gui/seed-scale.mjs <count>    seed a row (backs the namespace up once)
//   node tests/gui/seed-scale.mjs --restore  put the user's own namespace back
//
// The file is the user's live `<DSH_HOME>/settings.yaml`, so: the namespace is backed up
// before the first row and restored on exit; edits go through `yaml`'s document API, which
// leaves every other namespace and its comments byte-identical (a hand-rolled line splice
// mis-ends the block on a column-0 comment and orphans the rest); and the write is
// temp-file-plus-rename, so a crash cannot leave a truncated settings file behind.
import { existsSync, readFileSync, renameSync, rmSync, writeFileSync, mkdirSync } from 'node:fs'
import { homedir } from 'node:os'
import { dirname, join } from 'node:path'
import { randomUUID } from 'node:crypto'
import { Document, parseDocument } from 'yaml'

const NAMESPACE = 'composer-quick-actions'
const PRESETS = ['summarize-thread', 'explain-last-change', 'compact-context']
const BACKUP = '.playwright/settings-namespace-backup.yaml'

const settingsPath = join(process.env.DSH_HOME ?? join(homedir(), '.dsh'), 'settings.yaml')

function writeAtomically(text) {
  const next = `${settingsPath}.${process.pid}.next`
  writeFileSync(next, text)
  renameSync(next, settingsPath)
}

function load() {
  return parseDocument(readFileSync(settingsPath, 'utf8'))
}

function restore() {
  if (!existsSync(BACKUP)) throw new Error(`no backup at ${BACKUP}; nothing to restore`)
  const saved = parseDocument(readFileSync(BACKUP, 'utf8'))
  const doc = load()
  const node = saved.get(NAMESPACE, true)
  if (node === undefined) doc.delete(NAMESPACE)
  else doc.set(NAMESPACE, node)
  writeAtomically(doc.toString())
  rmSync(BACKUP)
  console.log(node === undefined ? 'removed the namespace (it did not exist before)' : 'restored the original namespace')
}

/**
 * The backup is a YAML fragment holding the namespace *node*, not its JSON: a node keeps
 * the comments written inside the block, and `toJSON()` drops them — which would silently
 * eat a user's own note on restore.
 */
function backupOnce(doc) {
  if (existsSync(BACKUP)) return
  mkdirSync(dirname(BACKUP), { recursive: true })
  const fragment = new Document({})
  const node = doc.get(NAMESPACE, true)
  if (node !== undefined) fragment.set(NAMESPACE, node)
  writeFileSync(BACKUP, fragment.toString())
  console.log(node === undefined ? `noted the namespace was absent in ${BACKUP}` : `backed the namespace up to ${BACKUP}`)
}

function seed(target) {
  const doc = load()
  backupOnce(doc)

  const shown = PRESETS.slice(0, Math.min(target, PRESETS.length))
  const hidden = PRESETS.slice(shown.length)
  const customs = Array.from({ length: Math.max(0, target - shown.length) }, (_, index) => ({
    id: randomUUID(),
    number: index + 1,
  }))

  doc.set(NAMESPACE, {
    schemaVersion: 1,
    layout: 'ribbon',
    userActionsById: Object.fromEntries(customs.map(custom => [custom.id, {
      kind: 'send',
      label: `规模动作 ${custom.number}`,
      text: `规模验证文本 ${custom.number}`,
      confirm: false,
      enabled: true,
    }])),
    // An explicit empty list, not an absent one: a missing order is re-derived from the
    // catalog by normalization, which would quietly turn the 0-action row into a different
    // test than the one it claims to be.
    actionOrder: [
      ...shown.map(id => ({ source: 'preset', id })),
      ...customs.map(custom => ({ source: 'custom', id: custom.id })),
    ],
    presetStateById: Object.fromEntries(hidden.map(id => [id, { hidden: true }])),
  })
  writeAtomically(doc.toString())
  console.log(
    `seeded ${target} actions: ${shown.length} presets shown, ${hidden.length} hidden, ${customs.length} custom`,
  )
}

const argument = process.argv[2]
if (argument === '--restore') restore()
else {
  const target = Number(argument)
  if (!Number.isInteger(target) || target < 0) throw new Error('pass an action count, or --restore')
  seed(target)
}
