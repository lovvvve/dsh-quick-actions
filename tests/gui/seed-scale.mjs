// Seed the plugin's Settings namespace with a given number of actions, then let the
// profile boot into it. Spec 13.2's scale rows (0, 1, 6, 25, 50 and the 53-action passive
// overflow) arise from stored state, so this writes that state instead of driving the
// management overlay 50 times. Presets are hidden when the target is below three, and
// custom actions make up the rest.
//
//   node tests/gui/seed-scale.mjs <count>    seed a row (backs the namespace up once)
//   node tests/gui/seed-scale.mjs --restore  put the user's own namespace back
//
// The user's file is only ever touched through `settings-namespace.mjs`, which owns the
// backup, the atomic write and the comment-preserving edit.
import { randomUUID } from 'node:crypto'
import { restoreNamespace, seedNamespace } from './settings-namespace.mjs'

const PRESETS = ['approve', 'continue', 'summarize', 'explain', 'compact-context']

function seed(target) {
  const shown = PRESETS.slice(0, Math.min(target, PRESETS.length))
  const hidden = PRESETS.slice(shown.length)
  const customs = Array.from({ length: Math.max(0, target - shown.length) }, (_, index) => ({
    id: randomUUID(),
    number: index + 1,
  }))

  seedNamespace({
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
  console.log(
    `seeded ${target} actions: ${shown.length} presets shown, ${hidden.length} hidden, ${customs.length} custom`,
  )
}

const argument = process.argv[2]
if (argument === '--restore') restoreNamespace()
else {
  const target = Number(argument)
  if (!Number.isInteger(target) || target < 0) throw new Error('pass an action count, or --restore')
  seed(target)
}
