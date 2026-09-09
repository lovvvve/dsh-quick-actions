#!/bin/sh
# Run the whole ungated GUI suite — the specs that need nothing but the plugin installed and
# a booted profile — against a profile this round boots, on a known Settings namespace.
#
# The round-gated specs (send, scale, restart, screenshots, lifecycle, host-config, presets,
# reinstall) skip themselves here; each has its own driver. Nothing in this run submits
# anything to a model.
#
# Usage, from the repository root:  sh tests/gui/verify-round.sh [playwright args]
# With no arguments this is `pnpm verify:gui` on a booted profile; arguments are forwarded,
# so a single spec can be re-run the same way (`sh tests/gui/verify-round.sh conflict.spec.ts
# --project=desktop`).
# Requires the plugin installed in the web profile. The user's own Settings namespace is
# restored on exit — including the case where they had none, which is why the suite is not
# simply pointed at whatever namespace happens to be there: `validation.spec.ts` and
# `conflict.spec.ts` write.
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
node tests/gui/seed-scale.mjs 3 || exit 1
boot || exit 1

DSH_GUI_ENTRY=$(entry_url) pnpm exec playwright test "$@"
