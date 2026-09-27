// Read and write this plugin's stored state inside the user's live web profile patch,
// `<DSH_HOME>/profiles/web/cordis.patch.yml`, which is what the seeded GUI rounds do to
// stage stored state — and, for the rounds that play the preset author, the `presets`
// declared on the same row.
//
// Since DSH 0.1.7 the stored section *is* the plugin's Config (spec 22): it lives on the
// `id: composer-quick-actions` row of the active profile patch, beside every other plugin's
// row the user keeps there. Writing a volatile field of that row is a live update — DSH
// commits it without remounting the plugin and the Client mirror refreshes — so a round
// can seed while the profile runs.
//
// The file belongs to the user, so three rules hold and this module is the only place they
// are implemented: the whole file is backed up byte for byte before the first write and put
// back byte for byte on request; edits go through `yaml`'s document API, which leaves every
// other row and its comments untouched; and writes are temp-file-plus-rename, so a crash
// cannot leave a truncated patch behind.
import { copyFileSync, existsSync, mkdirSync, readFileSync, renameSync, rmSync, writeFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { dirname, join } from 'node:path'
import { parseDocument, YAMLMap, YAMLSeq } from 'yaml'

export const NAMESPACE = 'composer-quick-actions'
const PACKAGE = 'dsh-quick-actions'
/** The five user-state fields (spec 4.2); `presets` on the same row is the author's, written only by `seedPresets`. */
const STATE_FIELDS = ['schemaVersion', 'layout', 'userActionsById', 'actionOrder', 'presetStateById']
const BACKUP = '.playwright/profile-patch-backup.yml'
/** Present when the file did not exist before the first write, so restoring deletes it. */
const ABSENT = '.playwright/profile-patch-absent'

const home = process.env.DSH_HOME ?? join(homedir(), '.dsh')
export const patchPath = join(home, 'profiles', process.env.DSH_QA_PROFILE ?? 'web', 'cordis.patch.yml')

function load() {
  const doc = parseDocument(existsSync(patchPath) ? readFileSync(patchPath, 'utf8') : '[]\n')
  if (doc.contents === null) doc.contents = new YAMLSeq()
  if (!(doc.contents instanceof YAMLSeq)) throw new Error(`${patchPath} is not a YAML sequence of patch rows`)
  return doc
}

function writeAtomically(text) {
  const next = `${patchPath}.${process.pid}.next`
  writeFileSync(next, text, { mode: 0o600 })
  renameSync(next, patchPath)
}

function backupOnce() {
  if (existsSync(BACKUP) || existsSync(ABSENT)) return
  mkdirSync(dirname(BACKUP), { recursive: true })
  if (existsSync(patchPath)) {
    copyFileSync(patchPath, BACKUP)
    console.log(`backed the profile patch up to ${BACKUP}`)
  } else {
    writeFileSync(ABSENT, '')
    console.log(`noted the profile patch was absent in ${ABSENT}`)
  }
}

/** This plugin's row of the patch, if the profile has one. */
function row(doc) {
  return doc.contents.items.find(item => item instanceof YAMLMap && item.get('id') === NAMESPACE)
}

/** The user-state fields the profile patch currently sets for this plugin, or `undefined`. */
export function readNamespace() {
  const found = row(load())?.get('config', true)
  if (!(found instanceof YAMLMap)) return undefined
  const config = found.toJSON()
  const state = Object.fromEntries(STATE_FIELDS.filter(field => field in config).map(field => [field, config[field]]))
  return Object.keys(state).length === 0 ? undefined : state
}

/** This plugin's row's `config` map, creating the row and the map when the profile has neither. */
function rowConfig(doc) {
  let target = row(doc)
  if (target === undefined) {
    target = doc.createNode({ id: NAMESPACE, name: PACKAGE, config: {} })
    doc.contents.items.push(target)
  }
  let config = target.get('config', true)
  if (!(config instanceof YAMLMap)) {
    config = doc.createNode({})
    target.set('config', config)
  }
  return config
}

/** Replace the five user-state fields, keeping the rest of the row — the author's `presets` included. */
export function seedNamespace(value) {
  backupOnce()
  const doc = load()
  const config = rowConfig(doc)
  for (const field of STATE_FIELDS) {
    if (field in value) config.set(field, doc.createNode(value[field]))
    else config.delete(field)
  }
  writeAtomically(doc.toString())
}

/**
 * Declare the author's `presets` on this plugin's row, or drop them with `undefined` —
 * what an integrator does to extend the catalog (spec 5.1, 22.3). The five user-state
 * fields are left exactly as they are, so the stored state a round trip carries survives.
 */
export function seedPresets(presets) {
  backupOnce()
  const doc = load()
  const config = rowConfig(doc)
  if (presets === undefined) config.delete('presets')
  else config.set('presets', doc.createNode(presets))
  writeAtomically(doc.toString())
}

export function restoreNamespace() {
  if (existsSync(ABSENT)) {
    rmSync(patchPath, { force: true })
    rmSync(ABSENT)
    console.log('removed the profile patch (it did not exist before)')
    return
  }
  if (!existsSync(BACKUP)) throw new Error(`no backup at ${BACKUP}; nothing to restore`)
  writeAtomically(readFileSync(BACKUP, 'utf8'))
  rmSync(BACKUP)
  console.log('restored the profile patch byte for byte')
}

/** Take the backup without writing anything, so a round that only lets the GUI write can still put the file back. */
export function backupNamespace() {
  backupOnce()
}
