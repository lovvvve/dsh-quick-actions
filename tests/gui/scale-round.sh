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
# Requires the plugin installed in the web profile. The user's own Settings namespace is
# backed up before the first row and restored on exit, however the round ends, and the
# profile this round boots is stopped on exit too.
set -u

if [ "$#" -ne 0 ] && [ "$#" -ne 2 ]; then
  echo "usage: sh tests/gui/scale-round.sh [<count> <over-cap flag>]" >&2
  exit 2
fi

. tests/gui/boot.sh

cleanup() {
  status=$?
  node tests/gui/seed-scale.mjs --restore 2>/dev/null || true
  stop_ours
  exit "$status"
}
trap cleanup EXIT INT TERM

run_row() {
  echo "=== scale row: $1 actions (over-cap=$2) ==="
  # Seed with the profile down: the Host rewrites settings.yaml as it runs, and a
  # concurrent write would race the seed.
  stop_ours
  node tests/gui/seed-scale.mjs "$1" || return 1
  boot || return 1
  DSH_GUI_ENTRY=$(entry_url) DSH_QA_EXPECTED="$1" DSH_QA_OVERCAP="$2" \
    pnpm exec playwright test scale.spec.ts --project=desktop
}

if [ "$#" -eq 2 ]; then
  run_row "$1" "$2"
else
  run_row 0 0 && run_row 1 0 && run_row 6 0 && run_row 25 0 && run_row 50 0 && run_row 53 1
fi
