// Declare, or drop, author presets on this plugin's row of the user's live profile patch —
// the profile-level `cordis.patch.yml` entry an integrator writes to extend the catalog
// (spec 5.1, 22.3). The presets and host-config rounds used to stage this through a
// `dsh --patch` overlay instead, which no longer works on DSH 0.1.7 (ticket 34): overlays
// are "read for precedence but are not write targets", so every GUI write those rounds make
// is refused, and a round on the external channel cannot pass an overlay at all.
//
//   node tests/gui/seed-presets.mjs <file.yml>   declare the YAML list of presets in the file
//   node tests/gui/seed-presets.mjs --clear      drop the row's presets
//
// Nothing here restores: the round's exit runs the same byte-for-byte restore every seeded
// round does (`seed-scale.mjs --restore`), because both go through the one backup that
// `settings-namespace.mjs` takes before its first write.
import { readFileSync } from 'node:fs'
import { parse } from 'yaml'
import { seedPresets } from './settings-namespace.mjs'

const argument = process.argv[2]
if (argument === '--clear') {
  seedPresets(undefined)
  console.log('dropped the declared presets')
} else if (argument !== undefined) {
  const presets = parse(readFileSync(argument, 'utf8'))
  if (!Array.isArray(presets)) throw new Error(`${argument} must hold a YAML list of presets`)
  seedPresets(presets)
  console.log(`declared ${presets.length} preset(s) from ${argument}`)
} else {
  throw new Error('pass a YAML file of presets, or --clear')
}
