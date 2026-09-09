#!/bin/sh
# Drive the four phases of presets.spec.ts: a preset joining the catalog, leaving it,
# coming back updated, and being replaced by a new ID because its behaviour signature
# changed (spec 5.1/5.3, spec 13.2's preset round-trip row).
#
# Host config changes take effect on a profile restart, so each phase is its own boot with
# its own `dsh --patch` overlay — the same position a profile-level `cordis.patch.yml`
# entry would occupy, without editing the user's own file. What carries across the boots is
# the stored state in the user's Settings, which is exactly what the round trip is about.
#
# Usage, from the repository root:  sh tests/gui/presets-round.sh
# Requires the plugin installed in the web profile. Nothing is sent, and the user's own
# Settings namespace is restored on exit.
set -u

. tests/gui/boot.sh

A=.playwright/preset-probe.patch.yml
A_UPDATED=.playwright/preset-probe-updated.patch.yml
B=.playwright/preset-probe-v2.patch.yml

cleanup() {
  status=$?
  node tests/gui/seed-scale.mjs --restore 2>/dev/null || true
  stop_ours
  rm -f "$A" "$A_UPDATED" "$B"
  exit "$status"
}
trap cleanup EXIT INT TERM

cat > "$A" <<'YAML'
# One extra Preset Quick Action, declared the way an integrator would in the profile's own
# patch layer. Used only by tests/gui/presets-round.sh.
- id: composer-quick-actions
  config:
    presets:
      - id: qa-preset-probe
        label: 预置往返验证
        text: 这条预置用于验证升级与降级的完整往返。
        icon: 🔁
        confirm: true
YAML

cat > "$A_UPDATED" <<'YAML'
# The same Preset Action ID with an updated label and text: what a package upgrade may
# change (spec 5.1). `confirm` is unchanged, because it is half of the signature that ID
# may never change.
- id: composer-quick-actions
  config:
    presets:
      - id: qa-preset-probe
        label: 预置往返验证已改名
        text: 这条预置的文案在同一个 ID 上被升级更新。
        icon: 🔁
        confirm: true
YAML

cat > "$B" <<'YAML'
# A changed confirmation policy, which spec 5.1 requires to arrive under a new ID.
- id: composer-quick-actions
  config:
    presets:
      - id: qa-preset-probe-v2
        label: 预置往返验证第二代
        text: 这条预置换了 ID，因为它的确认策略变了。
        icon: 🔁
        confirm: false
YAML

phase() {
  DSH_GUI_ENTRY=$(entry_url) DSH_QA_PRESETS="$1" \
    pnpm exec playwright test presets.spec.ts --project=desktop
}

stop_ours
# The packaged catalog with nothing hidden and no custom actions: the phases count
# actions, so they start from a namespace whose contents are known.
node tests/gui/seed-scale.mjs 3 || exit 1

echo '=== the probe preset joins the catalog ==='
DSH_BOOT_PATCH=$A boot || exit 1
phase stage || exit 1

echo '=== the probe preset leaves the catalog ==='
boot || exit 1
phase tombstone || exit 1

echo '=== the probe preset comes back, relabelled ==='
DSH_BOOT_PATCH=$A_UPDATED boot || exit 1
phase restore || exit 1

echo '=== the probe preset is replaced by a new ID ==='
DSH_BOOT_PATCH=$B boot || exit 1
phase signature
