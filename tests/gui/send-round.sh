#!/bin/sh
# Drive the send-path round against a live DSH: seed the two fixtures, boot the profile,
# run `send.spec.ts`, then put the user's own Settings namespace back.
#
# Usage, from the repository root:  sh tests/gui/send-round.sh
# Requires the plugin installed in the web profile.
#
# These tests submit for real. The normal fixture's text is the cheapest useful prompt and
# each test spends at most one turn, but this round does cost real model usage on the
# account the profile is signed into — it is not an AFK loop to leave running.
set -u

. tests/gui/boot.sh

cleanup() {
  status=$?
  node tests/gui/seed-send.mjs --restore 2>/dev/null || true
  stop_ours
  exit "$status"
}
trap cleanup EXIT INT TERM

# Seed with the profile down: the Host rewrites settings.yaml as it runs.
stop_ours
node tests/gui/seed-send.mjs || exit 1
boot || exit 1

DSH_GUI_ENTRY=$(entry_url) DSH_QA_SEND=1 \
  pnpm exec playwright test send.spec.ts --project=desktop
