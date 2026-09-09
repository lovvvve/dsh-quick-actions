// Seed the two fixtures the send-path round needs, then let the profile boot into them.
//
//   node tests/gui/seed-send.mjs            seed the fixtures (backs the namespace up once)
//   node tests/gui/seed-send.mjs --restore  put the user's own namespace back
//
// Both fixtures carry fixed ids so a spec can address them by ref key, and the packaged
// presets are hidden so only these two render: an assertion that counts messages must not
// risk activating `压缩上下文`, whose text is the real `/compact` command.
//
// The normal action's text is deliberately the cheapest useful prompt — every activation
// of it is a real model turn on the user's account.
import { restoreNamespace, seedNamespace } from './settings-namespace.mjs'

export const SEND_FIXTURE = '11111111-1111-4111-8111-111111111111'
export const COMMAND_FIXTURE = '22222222-2222-4222-8222-222222222222'
const PRESETS = ['summarize-thread', 'explain-last-change', 'compact-context']

function seed() {
  seedNamespace({
    schemaVersion: 1,
    layout: 'ribbon',
    userActionsById: {
      [SEND_FIXTURE]: {
        kind: 'send',
        label: '验证发送',
        text: '回复 ok',
        confirm: false,
        enabled: true,
      },
      [COMMAND_FIXTURE]: {
        kind: 'send',
        label: '验证命令',
        // An obviously namespaced unknown command: it exercises the command path and DSH's
        // own adjudication without running anything that would change the conversation.
        text: '/qa-probe-unknown-command',
        confirm: true,
        enabled: true,
      },
    },
    actionOrder: [
      { source: 'custom', id: SEND_FIXTURE },
      { source: 'custom', id: COMMAND_FIXTURE },
    ],
    presetStateById: Object.fromEntries(PRESETS.map(id => [id, { hidden: true }])),
  })
  console.log('seeded the send fixtures: 验证发送 (confirm off), 验证命令 (confirm on), presets hidden')
}

if (process.argv[2] === '--restore') restoreNamespace()
else seed()
