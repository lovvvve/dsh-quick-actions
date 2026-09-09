#!/bin/sh
# Drive the two halves of restart.spec.ts with a profile boot in between, which is the
# only way to prove spec 13.2's "重启后恢复" from the GUI: choose a layout, restart the
# harness, and check the Client comes back on the stored one.
#
# Usage, from the repository root:  sh tests/gui/restart-round.sh
# Requires: the plugin installed in the web profile, and DSH_HOME set (default ~/.dsh).
set -u

DSH_HOME=${DSH_HOME:-$HOME/.dsh}
export DSH_HOME
LOG=.playwright/dsh-web.log
mkdir -p .playwright

boot() {
  pkill -f "dsh@latest web" 2>/dev/null
  pkill -f "_npx/.*dsh.* web" 2>/dev/null
  for _ in $(seq 1 30); do
    if [ "$(curl -s -o /dev/null -w '%{http_code}' --max-time 2 http://127.0.0.1:3080/)" = "000" ]; then break; fi
    sleep 1
  done
  : > "$LOG"
  nohup npx --yes @deepseek-ai/dsh@latest web --no-open >>"$LOG" 2>&1 &
  for _ in $(seq 1 90); do
    if grep -q "dsh web: http" "$LOG" 2>/dev/null; then
      # The url is printed before the app is ready to serve its first client load, and a
      # cold first mount is what makes the first test of a boot need a retry.
      sleep 8
      return 0
    fi
    sleep 1
  done
  echo "server never printed its entry url; see $LOG" >&2
  return 1
}

half() {
  DSH_GUI_ENTRY=$(grep -o 'http://127.0.0.1:3080/?token=[^ )]*' "$LOG" | tail -1) \
  DSH_QA_RESTART="$1" \
    pnpm exec playwright test restart.spec.ts --project=desktop
}

echo '=== choose the layout ==='
boot || exit 1
half store || exit 1

echo '=== restart the harness, then check what came back ==='
boot || exit 1
half restore
