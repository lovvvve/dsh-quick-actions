#!/bin/sh
# Drive the four phases of presets.spec.ts: a preset joining the catalog, leaving it,
# coming back updated, and being replaced by a new ID because its behaviour signature
# changed (spec 5.1/5.3, spec 13.2's preset round-trip row).
#
# Each phase declares its catalog the way an integrator would — `presets` on this plugin's
# row of the profile's own `cordis.patch.yml` (seed-presets.mjs) — and then boots, so a
# round that owns the channel re-validates the catalog on every profile start. On the
# external channel (DSH_GUI_ENTRY) `boot` starts nothing and the edit reaches the running
# profile as a live update instead (spec 22.3: `presets` is live). What carries across the
# phases is the stored state on the same row, which is exactly what the round trip is about.
# (Before ticket 34 each phase was a `dsh --patch` overlay; DSH 0.1.7 refuses form writes to
# an entry an overlay overrides, so every GUI write the phases make would fail.)
#
# Usage, from the repository root:  sh tests/gui/presets-round.sh
# Requires the plugin installed in the web profile. Nothing is sent, and the user's profile
# patch is restored byte for byte on exit.
set -u

. tests/gui/boot.sh

A=.playwright/preset-probe.yml
A_UPDATED=.playwright/preset-probe-updated.yml
B=.playwright/preset-probe-v2.yml

cleanup() {
  status=$?
  node tests/gui/seed-scale.mjs --restore 2>/dev/null || true
  stop_ours
  rm -f "$A" "$A_UPDATED" "$B"
  exit "$status"
}
trap cleanup EXIT INT TERM

cat > "$A" <<'YAML'
# One extra Preset Quick Action. Used only by tests/gui/presets-round.sh.
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
- id: qa-preset-probe
  label: 预置往返验证已改名
  text: 这条预置的文案在同一个 ID 上被升级更新。
  icon: 🔁
  confirm: true
YAML

cat > "$B" <<'YAML'
# A changed confirmation policy, which spec 5.1 requires to arrive under a new ID.
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
node tests/gui/seed-presets.mjs "$A" || exit 1
boot || exit 1
phase stage || exit 1

echo '=== the probe preset leaves the catalog ==='
node tests/gui/seed-presets.mjs --clear || exit 1
boot || exit 1
phase tombstone || exit 1

echo '=== the probe preset comes back, relabelled ==='
node tests/gui/seed-presets.mjs "$A_UPDATED" || exit 1
boot || exit 1
phase restore || exit 1

echo '=== the probe preset is replaced by a new ID ==='
node tests/gui/seed-presets.mjs "$B" || exit 1
boot || exit 1
phase signature
