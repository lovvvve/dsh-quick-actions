#!/bin/sh
# Run the ungated GUI suite against the DSH the user keeps running, without restarting it
# (ticket 32). The profile's `patchReload: live` lets an install reach the running server,
# and since DSH 0.1.7 the plugin's stored state is a volatile field of its profile-patch row
# (spec 22), so nothing here needs a boot of its own.
#
# Usage, from the repository root:
#   DSH_GUI_ENTRY='http://127.0.0.1:3080/?token=…' sh tests/gui/live-round.sh [playwright args]
# The entry URL is the one `dsh web` printed; it stays in the environment, never on disk here.
# `DSH_QA_TARBALLS` should name a directory outside the worktree, so the user's profile never
# points into a checkout that may be deleted.
#
# The profile is borrowed: its four files are fingerprinted first, the patch is backed up byte
# for byte, and on exit the plugin is uninstalled, the patch put back and the fingerprint
# checked. Nothing is submitted to a model — the send round has its own driver and needs the
# user's permission.
set -u

. tests/gui/boot.sh
. tests/gui/install.sh

if [ -z "${DSH_GUI_ENTRY:-}" ] || ! external_channel; then
  echo "pass the running server's entry URL as DSH_GUI_ENTRY; this round never boots one" >&2
  exit 1
fi

installed=0

cleanup() {
  status=$?
  if [ "$installed" -eq 1 ]; then
    qa_uninstall || status=1
  fi
  node tests/gui/seed-scale.mjs --restore 2>/dev/null || true
  qa_profile_verify || { echo '!! the profile files did not come back byte-identical' >&2; status=1; }
  exit "$status"
}
trap cleanup EXIT INT TERM

qa_profile_snapshot || exit 1
node tests/gui/seed-scale.mjs --backup || exit 1
qa_pack || exit 1
qa_install || exit 1
installed=1

echo '=== waiting for the running server to load the plugin ==='
pnpm exec playwright test channel.spec.ts --project=desktop || exit 1

echo '=== ungated suite ==='
if [ "$#" -gt 0 ]; then
  pnpm exec playwright test "$@"
else
  pnpm exec playwright test surface.spec.ts manager.spec.ts stacking.spec.ts validation.spec.ts conflict.spec.ts
fi
