#!/bin/sh
# Record or check the visual baselines of spec section 13.3: seed the packaged catalog so
# the shots are of the shipped presets, boot the profile, then run the three layouts across
# every viewport project.
#
# Usage, from the repository root:
#   sh tests/gui/screenshots-round.sh              # compare against the committed baselines
#   sh tests/gui/screenshots-round.sh --update-snapshots
#
# Requires the plugin installed in the web profile. The user's own Settings namespace is
# restored on exit, and no message is ever sent.
set -u

. tests/gui/boot.sh

cleanup() {
  status=$?
  node tests/gui/seed-scale.mjs --restore 2>/dev/null || true
  stop_ours
  exit "$status"
}
trap cleanup EXIT INT TERM

stop_ours
# Three actions is the packaged catalog: three presets shown, no custom actions.
node tests/gui/seed-scale.mjs 3 || exit 1
boot || exit 1

DSH_GUI_ENTRY=$(entry_url) DSH_QA_SCREENSHOTS=1 \
  pnpm exec playwright test screenshots.spec.ts "$@"
