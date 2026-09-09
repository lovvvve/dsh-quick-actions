#!/bin/sh
# Drive the two halves of lifecycle.spec.ts: the `down` half stops the profile mid-test to
# see the Client hold its last snapshot read-only, and the `up` half runs against a profile
# booted again to see authority return with no duplicated registration.
#
# Usage, from the repository root:  sh tests/gui/lifecycle-round.sh
# Requires the plugin installed in the web profile. Nothing is sent, and the user's own
# Settings namespace is restored on exit.
set -u

. tests/gui/boot.sh

cleanup() {
  status=$?
  node tests/gui/seed-send.mjs --restore 2>/dev/null || true
  stop_ours
  exit "$status"
}
trap cleanup EXIT INT TERM

half() {
  DSH_GUI_ENTRY=$(entry_url) DSH_QA_LIFECYCLE="$1" \
    pnpm exec playwright test lifecycle.spec.ts --project=desktop
}

stop_ours
# The send fixtures rather than the packaged catalog: the failed-draft test activates one,
# and no packaged preset should be activated by accident — one of them is the real
# `/compact` command.
node tests/gui/seed-send.mjs || exit 1

echo '=== drop the connection under a live page ==='
boot || exit 1
half down || exit 1

echo '=== bring the profile back ==='
boot || exit 1
half up
