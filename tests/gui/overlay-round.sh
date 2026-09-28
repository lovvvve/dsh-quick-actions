#!/bin/sh
# Prove what a `dsh --patch` overlay carrying this plugin's `config` does (ticket 34): its
# presets reach the Client, the state stored on the profile row is hidden behind the schema
# defaults, and every save is refused. This is the evidence behind the README warning that
# presets belong in the active profile's own patch, never in the home patch or an overlay.
#
# The overlay is a boot argument, so this round needs a server of its own: it refuses the
# external channel, where `boot` starts nothing and the overlay would be silently dropped.
#
# Usage, from the repository root:  sh tests/gui/overlay-round.sh
# Requires the plugin installed in the web profile. Nothing is sent, and the user's profile
# patch is restored byte for byte on exit.
set -u

. tests/gui/boot.sh

if external_channel; then
  echo 'this round boots its own profile with an overlay; free the channel instead of passing DSH_GUI_ENTRY' >&2
  exit 1
fi

OVERLAY=.playwright/overlay-probe.patch.yml

cleanup() {
  status=$?
  node tests/gui/seed-scale.mjs --restore 2>/dev/null || true
  stop_ours
  rm -f "$OVERLAY"
  exit "$status"
}
trap cleanup EXIT INT TERM

cat > "$OVERLAY" <<'YAML'
# One preset shipped the way the README warns against. Used only by tests/gui/overlay-round.sh.
- id: composer-quick-actions
  config:
    presets:
      - id: overlay-probe
        label: overlay 分发验证
        text: 这条预置经 dsh --patch overlay 分发。
YAML

stop_ours
# Five presets and one Custom Quick Action on the profile row: the custom one is what the
# overlay should hide.
node tests/gui/seed-scale.mjs 6 || exit 1
DSH_BOOT_PATCH=$OVERLAY boot || exit 1

DSH_GUI_ENTRY=$(entry_url) DSH_QA_OVERLAY=1 \
  pnpm exec playwright test overlay.spec.ts --project=desktop
