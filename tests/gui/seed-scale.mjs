// Seed the plugin's Settings namespace with a given number of actions, then let the
// profile boot into it. Spec 13.2's scale rows (0, 1, 6, 25, 50 and the 53-action passive
// overflow) arise from stored state, so this writes that state instead of driving the
// management overlay 50 times. Presets are hidden when the target is below three, and
// custom actions make up the rest.
//
// Usage: node tests/gui/seed-scale.mjs <count>   (DSH_HOME respected, default ~/.dsh)
import { readFileSync, writeFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'
import { randomUUID } from 'node:crypto'

const presets = ['summarize-thread', 'explain-last-change', 'compact-context']
const target = Number(process.argv[2])
if (!Number.isInteger(target) || target < 0) throw new Error('pass an action count')

const settings = join(process.env.DSH_HOME ?? join(homedir(), '.dsh'), 'settings.yaml')
const lines = readFileSync(settings, 'utf8').split('\n')

// Drop any existing namespace of ours, leaving every other namespace untouched.
const start = lines.findIndex(line => line.startsWith('composer-quick-actions:'))
let kept = lines
if (start >= 0) {
  let end = lines.length
  for (let index = start + 1; index < lines.length; index += 1) {
    const line = lines[index]
    if (line !== '' && !/^\s/.test(line)) {
      end = index
      break
    }
  }
  kept = [...lines.slice(0, start), ...lines.slice(end)]
}
while (kept.length > 0 && kept.at(-1) === '') kept.pop()

const shown = presets.slice(0, Math.min(target, presets.length))
const hidden = presets.slice(shown.length)
const customs = Array.from({ length: Math.max(0, target - shown.length) }, (_, index) => ({
  id: randomUUID(),
  number: index + 1,
}))

const block = ['composer-quick-actions:', '  schemaVersion: 1', '  layout: ribbon']
if (customs.length === 0) block.push('  userActionsById: {}')
else {
  block.push('  userActionsById:')
  for (const custom of customs) {
    block.push(
      `    ${custom.id}:`,
      '      kind: send',
      `      label: 规模动作 ${custom.number}`,
      `      text: 规模验证文本 ${custom.number}`,
      '      confirm: false',
      '      enabled: true',
    )
  }
}

block.push('  actionOrder:')
for (const preset of shown) block.push('    - source: preset', `      id: ${preset}`)
for (const custom of customs) block.push('    - source: custom', `      id: ${custom.id}`)

if (hidden.length === 0) block.push('  presetStateById: {}')
else {
  block.push('  presetStateById:')
  for (const preset of hidden) block.push(`    ${preset}:`, '      hidden: true')
}

writeFileSync(settings, [...kept, ...block, ''].join('\n'))
console.log(
  `seeded ${target} actions: ${shown.length} presets shown, ${hidden.length} hidden, ${customs.length} custom`,
)
