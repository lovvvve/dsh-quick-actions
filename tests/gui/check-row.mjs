// Assert that the user's live profile patch holds exactly one row for this plugin and that
// the row still carries all five user-state fields. The reinstall round runs it after
// `dsh plugin remove` — the removal must leave the row and its stored state in place — and
// after the reinstall, where the bundle's row picks that config back up by id without a
// duplicate appearing (ticket 34, source evidence in research/dsh-0.1.7-settings-host.md).
//
//   node tests/gui/check-row.mjs   exit 0 when the row is single and whole, 1 otherwise
import { inspectRows } from './settings-namespace.mjs'

const { rows, stateFields } = inspectRows()
console.log(`${rows} row(s) for composer-quick-actions; state fields set: ${stateFields.join(', ') || 'none'}`)
if (rows !== 1 || stateFields.length !== 5) process.exit(1)
