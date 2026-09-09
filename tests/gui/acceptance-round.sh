#!/bin/sh
# Drive spec section 13.4's acceptance steps on the live GUI for ticket 21, when the user asks
# the agent to run them: boot the installed profile, walk steps 2-5 and 8 (and the page refresh
# of step 6), restart for step 6, uninstall / reinstall with a restart each for step 7.
#
# Usage, from the repository root:
#   sh tests/gui/acceptance-round.sh walk       # boot + steps 2-5, 8, refresh
#   sh tests/gui/acceptance-round.sh persist    # restart, uninstall, reinstall (steps 6-7)
#   sh tests/gui/acceptance-round.sh            # both
#
# Requires the plugin installed in the web profile and the tarballs already packed
# (`reinstall-round.sh` does both). Nothing here spends a model turn. The profile is left
# RUNNING on exit so the user can look at the result; `close-window.sh` stops it. The Settings
# namespace is not restored here either — the acceptance state is what the user inspects.
set -u

. tests/gui/boot.sh
. tests/gui/install.sh

SHOTS=${DSH_QA_SHOTS:-.scratch/dsh-composer-quick-actions/verification/acceptance-21}
mkdir -p "$SHOTS"
mode=${1:-all}

phase() {
  DSH_GUI_ENTRY=$(entry_url) DSH_QA_ACCEPTANCE="$1" DSH_QA_SHOTS="$SHOTS" \
    pnpm exec playwright test acceptance.spec.ts --project=desktop
}

if [ "$mode" = walk ] || [ "$mode" = all ]; then
  echo '=== step 1: boot on the installed tarball ==='
  boot || exit 1
  echo '=== steps 2-5, 8 and the page refresh of step 6 ==='
  phase walk || exit 1
fi

if [ "$mode" = persist ] || [ "$mode" = all ]; then
  echo '=== step 6: restart DSH ==='
  boot || exit 1
  phase restarted || exit 1

  echo '=== step 7: uninstall and restart ==='
  stop_ours
  qa_uninstall || exit 1
  boot || { echo '!! the plugin is left UNINSTALLED' >&2; exit 1; }
  phase gone || { echo '!! the plugin is left UNINSTALLED' >&2; exit 1; }

  echo '=== step 7: reinstall and restart ==='
  stop_ours
  qa_install || exit 1
  boot || exit 1
  phase back || exit 1
fi

echo '=== the profile stays up for the user ==='
