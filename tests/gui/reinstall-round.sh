#!/bin/sh
# Drive the three phases of reinstall.spec.ts: mark a configuration, uninstall the plugin,
# reinstall it, and see the configuration come back (spec 13.2's uninstall / reinstall /
# configuration-recovery row).
#
# This round opens and closes the install window itself, so unlike the other rounds it must
# be given a profile that already has the tarballs packed — it packs them — and it leaves
# the plugin installed when it finishes.
#
# Usage, from the repository root:  sh tests/gui/reinstall-round.sh
# Nothing is sent. The user's own Settings namespace is restored on exit, and the profile
# files `dsh plugin` maintains are fingerprinted first and checked at the end.
set -u

. tests/gui/boot.sh
. tests/gui/install.sh

installed=0

cleanup() {
  status=$?
  node tests/gui/seed-scale.mjs --restore 2>/dev/null || true
  stop_ours
  if [ "$installed" -eq 0 ]; then
    echo '!! the plugin is left UNINSTALLED — reinstall it before the next round' >&2
  fi
  exit "$status"
}
trap cleanup EXIT INT TERM

phase() {
  DSH_GUI_ENTRY=$(entry_url) DSH_QA_REINSTALL="$1" \
    pnpm exec playwright test reinstall.spec.ts --project=desktop
}

stop_ours
qa_profile_snapshot || exit 1
qa_pack || exit 1
qa_install || exit 1
installed=1
# A known namespace: the packaged catalog, nothing hidden, no custom actions. What the
# `mark` phase then writes on top of it is this round's own configuration rather than the
# user's, so recovery is asserted against something the round put there.
node tests/gui/seed-scale.mjs 3 || exit 1

echo '=== mark a configuration ==='
boot || exit 1
phase mark || exit 1

echo '=== uninstall ==='
stop_ours
qa_uninstall || exit 1
installed=0
boot || exit 1
phase gone || exit 1

echo '=== reinstall ==='
stop_ours
qa_install || exit 1
installed=1
boot || exit 1
phase back || exit 1

# The window is left open on purpose: the other rounds of this ticket need the plugin
# installed. `tests/gui/close-window.sh` closes it, and that is where the profile
# fingerprint taken at the top of this round gets checked.
echo '=== the plugin is installed and the window is open ==='
