#!/bin/sh
# Drive the two halves of restart.spec.ts with a profile boot in between, which is the
# only way to prove spec 13.2's "重启后恢复" from the GUI: choose a layout, restart the
# harness, and check the Client comes back on the stored one.
#
# Usage, from the repository root:  sh tests/gui/restart-round.sh
# Requires the plugin installed in the web profile. The profile this round boots is
# stopped on exit, and the user's profile patch is restored byte for byte.
#
# The round only writes through the GUI, but every layout switch has DSH write this
# plugin's whole row into the profile patch — switching back to `ribbon` puts the layout
# back, not the file. Before ticket 34 this round took no backup, and the row it left
# behind became every later round's idea of the user's own patch.
set -u

. tests/gui/boot.sh

cleanup() {
  status=$?
  node tests/gui/seed-scale.mjs --restore 2>/dev/null || true
  stop_ours
  exit "$status"
}
trap cleanup EXIT INT TERM

half() {
  DSH_GUI_ENTRY=$(entry_url) DSH_QA_RESTART="$1" \
    pnpm exec playwright test restart.spec.ts --project=desktop
}

stop_ours
node tests/gui/seed-scale.mjs --backup || exit 1

echo '=== choose the layout ==='
boot || exit 1
half store || exit 1

echo '=== restart the harness, then check what came back ==='
boot || exit 1
half restore
