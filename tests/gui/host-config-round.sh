#!/bin/sh
# Prove a Host `Config.presets` change reaches the Client (spec section 13.2). The extra
# preset is declared in a patch overlay passed to `dsh --patch`, which applies after every
# bundle layer — the same position a profile-level `cordis.patch.yml` entry would occupy,
# without editing the user's own file.
#
# Usage, from the repository root:  sh tests/gui/host-config-round.sh
# Requires the plugin installed in the web profile. Nothing is sent, and the user's own
# Settings namespace is restored on exit.
set -u

. tests/gui/boot.sh

OVERLAY=.playwright/extra-presets.patch.yml

cleanup() {
  status=$?
  node tests/gui/seed-scale.mjs --restore 2>/dev/null || true
  stop_ours
  rm -f "$OVERLAY"
  exit "$status"
}
trap cleanup EXIT INT TERM

cat > "$OVERLAY" <<'YAML'
# One extra Preset Quick Action, declared the way an integrator would in the profile's own
# patch layer. Used only by tests/gui/host-config-round.sh.
- id: composer-quick-actions
  config:
    presets:
      - id: host-config-probe
        label: 主机配置验证
        text: 这条预置来自 Host composition 的 Config.presets。
        icon: 🧪
YAML

stop_ours
# Start from the packaged catalog so the overlay's entry is the fourth action.
node tests/gui/seed-scale.mjs 3 || exit 1
DSH_BOOT_PATCH=$OVERLAY boot || exit 1

DSH_GUI_ENTRY=$(entry_url) DSH_QA_HOST_CONFIG=1 \
  pnpm exec playwright test host-config.spec.ts --project=desktop
