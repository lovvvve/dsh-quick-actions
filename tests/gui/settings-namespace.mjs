// Read and write this plugin's namespace inside the user's live `<DSH_HOME>/settings.yaml`,
// which is what the seeded GUI rounds do to stage stored state before a profile boots.
//
// The file belongs to the user, so three rules hold and this module is the only place they
// are implemented: the namespace is backed up before the first write and restored on
// request; edits go through `yaml`'s document API, which leaves every other namespace and
// its comments byte-identical (a hand-rolled line splice mis-ends the block on a column-0
// comment and orphans the rest); and writes are temp-file-plus-rename, so a crash cannot
// leave a truncated settings file behind.
import { existsSync, mkdirSync, readFileSync, renameSync, rmSync, writeFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { dirname, join } from 'node:path'
import { Document, parseDocument } from 'yaml'

export const NAMESPACE = 'composer-quick-actions'
const BACKUP = '.playwright/settings-namespace-backup.yaml'

export const settingsPath = join(process.env.DSH_HOME ?? join(homedir(), '.dsh'), 'settings.yaml')

function load() {
  return parseDocument(readFileSync(settingsPath, 'utf8'))
}

function writeAtomically(text) {
  const next = `${settingsPath}.${process.pid}.next`
  writeFileSync(next, text)
  renameSync(next, settingsPath)
}

/**
 * The backup holds the namespace *node*, not its JSON: a node keeps the comments written
 * inside the block, and `toJSON()` drops them — which would silently eat a user's own note.
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

export function seedNamespace(value) {
  const doc = load()
  backupOnce(doc)
  doc.set(NAMESPACE, value)
  writeAtomically(doc.toString())
}

export function restoreNamespace() {
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
