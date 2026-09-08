#!/bin/sh
# Drive spec 13.2's scale rows against a live DSH: seed stored state, boot the profile,
# assert, repeat. The rows arise from stored state in the field (a package upgrade or a
# Host config change), so they are seeded into <DSH_HOME>/settings.yaml rather than typed
# through the management overlay.
#
# Usage, from the repository root:
#   sh tests/gui/scale-round.sh            # every row: 0 1 6 25 50 53
#   sh tests/gui/scale-round.sh 53 1       # one row: <count> <over-cap flag>
#
# Requires: the plugin installed in the web profile, and DSH_HOME set (default ~/.dsh).
set -u

DSH_HOME=${DSH_HOME:-$HOME/.dsh}
export DSH_HOME
LOG=.playwright/dsh-web.log
mkdir -p .playwright

boot() {
  pkill -f "npm exec @deepseek-ai/dsh@latest web" 2>/dev/null
  sleep 2
  : > "$LOG"
  nohup npx --yes @deepseek-ai/dsh@latest web --no-open >>"$LOG" 2>&1 &
  for _ in $(seq 1 90); do
    if grep -q "dsh web: http" "$LOG" 2>/dev/null; then return 0; fi
    sleep 1
  done
  echo "server never printed its entry url; see $LOG" >&2
  return 1
}

run_row() {
  echo "=== scale row: $1 actions (over-cap=$2) ==="
  node tests/gui/seed-scale.mjs "$1" || return 1
  boot || return 1
  DSH_GUI_ENTRY=$(grep -o 'http://127.0.0.1:3080/?token=[^ )]*' "$LOG" | tail -1) \
  DSH_QA_EXPECTED="$1" DSH_QA_OVERCAP="$2" \
    pnpm exec playwright test scale.spec.ts --project=desktop
}

if [ "$#" -eq 2 ]; then
  run_row "$1" "$2"
else
  run_row 0 0 && run_row 1 0 && run_row 6 0 && run_row 25 0 && run_row 50 0 && run_row 53 1
fi
