// Add or take back the one hand edit the feature package's local-tarball install flow asks
// for: a pnpm `overrides` entry in the web profile's own pnpm config, pointing at the
// feature-package tarball by absolute path (README "本地 / 离线安装", step 2).
//
//   node tests/gui/profile-override.mjs --add <feature tarball>
//   node tests/gui/profile-override.mjs --restore
//
// The file belongs to the user's DSH, so it is copied byte-for-byte before the first edit
// and restored from that copy — not re-serialized, which is what lets the round assert the
// profile came back byte-identical. The edit itself goes through `yaml`'s document API so
// every other key and comment in the file survives, and it is written temp-file-plus-rename
// so a crash cannot truncate a file DSH needs to boot.
import { copyFileSync, existsSync, mkdirSync, readFileSync, renameSync, rmSync, writeFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { dirname, isAbsolute, join, resolve } from 'node:path'
import { parseDocument } from 'yaml'

const PACKAGE = 'dsh-quick-actions'
const BACKUP = '.playwright/profile-pnpm-workspace-backup.yaml'

const profilePnpm = join(process.env.DSH_HOME ?? join(homedir(), '.dsh'), 'profiles', 'web', 'pnpm-workspace.yaml')

function writeAtomically(text) {
  const next = `${profilePnpm}.${process.pid}.next`
  writeFileSync(next, text)
  renameSync(next, profilePnpm)
}

function add(tarball) {
  const absolute = isAbsolute(tarball) ? tarball : resolve(tarball)
  if (!existsSync(absolute)) throw new Error(`no tarball at ${absolute}`)
  if (!existsSync(BACKUP)) {
    mkdirSync(dirname(BACKUP), { recursive: true })
    copyFileSync(profilePnpm, BACKUP)
    console.log(`copied the profile pnpm config to ${BACKUP}`)
  }
  const doc = parseDocument(readFileSync(profilePnpm, 'utf8'))
  doc.setIn(['overrides', PACKAGE], `file:${absolute}`)
  writeAtomically(doc.toString())
  console.log(`overrides.${PACKAGE} -> file:${absolute}`)
}

function restore() {
  if (!existsSync(BACKUP)) throw new Error(`no backup at ${BACKUP}; nothing to restore`)
  // A buffer, not a decoded string: the claim this round makes about the user's profile is
  // byte identity, so the restore must not go through a text round trip.
  writeAtomically(readFileSync(BACKUP))
  rmSync(BACKUP)
  console.log('restored the profile pnpm config from the backup')
}

const [flag, value] = process.argv.slice(2)
if (flag === '--add') {
  if (value === undefined) throw new Error('pass the feature package tarball to --add')
  add(value)
} else if (flag === '--restore') {
  restore()
} else {
  throw new Error('usage: profile-override.mjs --add <feature tarball> | --restore')
}
