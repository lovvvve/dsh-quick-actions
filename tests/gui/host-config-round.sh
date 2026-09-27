#!/bin/sh
# Prove a Host `Config.presets` change reaches the Client (spec section 13.2). The extra
# preset is declared on this plugin's row of the profile's own `cordis.patch.yml`
# (seed-presets.mjs) — exactly where an integrator's profile-level preset lands — and the
# row is restored byte for byte on exit. Before ticket 34 this was a `dsh --patch` overlay,
# which a round on the external channel (DSH_GUI_ENTRY) cannot pass.
#
# Usage, from the repository root:  sh tests/gui/host-config-round.sh
# Requires the plugin installed in the web profile. Nothing is sent, and the user's profile
# patch is restored byte for byte on exit.
set -u

. tests/gui/boot.sh

PRESETS=.playwright/extra-presets.yml

cleanup() {
  status=$?
  node tests/gui/seed-scale.mjs --restore 2>/dev/null || true
  stop_ours
  rm -f "$PRESETS"
  exit "$status"
}
trap cleanup EXIT INT TERM

cat > "$PRESETS" <<'YAML'
# One extra Preset Quick Action. Used only by tests/gui/host-config-round.sh.
- id: host-config-probe
  label: 主机配置验证
  text: 这条预置来自 Host composition 的 Config.presets。
  icon: 🧪
YAML

stop_ours
# Start from the packaged catalog so the declared entry is the fourth action.
node tests/gui/seed-scale.mjs 3 || exit 1
node tests/gui/seed-presets.mjs "$PRESETS" || exit 1
boot || exit 1

DSH_GUI_ENTRY=$(entry_url) DSH_QA_HOST_CONFIG=1 \
  pnpm exec playwright test host-config.spec.ts --project=desktop
