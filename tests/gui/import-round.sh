#!/bin/sh
# Prove DSH 0.1.7's one-shot legacy import lands in this plugin at the GUI (spec 22.7,
# ticket 34): a `<DSH_HOME>/settings.yaml` section written by the 0.1.5-line plugin becomes
# this entry's Config — five top-level fields on the profile patch row — on the first boot,
# the file is renamed to `settings.yaml.imported`, and the Client shows the stored layout
# and Custom Quick Action.
#
# A home imports once, and the user's has already spent it, so this round always runs on a
# fresh, throwaway DSH_HOME. It still boots on the one GUI channel, so the channel must be
# free (CLAUDE.md: one channel, never a second server).
#
# Usage, from the repository root:
#   DSH_QA_IMPORT_SESSIONS=<a sessions workspace dir, e.g. ~/.dsh/sessions/--tmp-->
#     [DSH_QA_IMPORT_HOME=<a path that does not exist yet>] [DSH_QA_TARBALLS=<dir>]
#     sh tests/gui/import-round.sh
#
# The Resident Composer only mounts in a session with history, and a fresh home has none, so
# DSH_QA_IMPORT_SESSIONS names a workspace directory of sessions to copy in. Nothing is sent.
# The throwaway home is removed when the round passes and kept (its path printed) when not.
set -u

if [ -z "${DSH_QA_IMPORT_SESSIONS:-}" ] || [ ! -d "$DSH_QA_IMPORT_SESSIONS" ]; then
  echo 'set DSH_QA_IMPORT_SESSIONS to a sessions workspace directory to copy in' >&2
  exit 1
fi
if [ -n "${DSH_QA_IMPORT_HOME:-}" ]; then
  if [ -e "$DSH_QA_IMPORT_HOME" ]; then
    echo "$DSH_QA_IMPORT_HOME exists; the round only runs on a home it creates itself" >&2
    exit 1
  fi
  mkdir -p "$DSH_QA_IMPORT_HOME" || exit 1
  IMPORT_HOME=$DSH_QA_IMPORT_HOME
else
  IMPORT_HOME=$(mktemp -d) || exit 1
fi
# Everything below — boot, install, the patch helpers — reads DSH_HOME, so it is set before
# the shared scripts are sourced.
DSH_HOME=$IMPORT_HOME
export DSH_HOME

. tests/gui/boot.sh
. tests/gui/install.sh

cleanup() {
  status=$?
  stop_ours
  if [ "$status" -eq 0 ]; then
    rm -rf "$IMPORT_HOME"
  else
    echo "!! the throwaway home is kept for inspection: $IMPORT_HOME" >&2
  fi
  exit "$status"
}
trap cleanup EXIT INT TERM

# The 0.1.5-line document: one section per plugin, named after the entry id, holding the
# five user-state fields at its top level (spec 4.2) — the shape the import matches key by key.
cat > "$DSH_HOME/settings.yaml" <<'YAML'
composer-quick-actions:
  schemaVersion: 1
  layout: bar
  userActionsById:
    7d3f2a4e-9c1b-4e8a-b5d6-0f1e2d3c4b5a:
      kind: send
      label: 导入验证
      text: 这条自定义动作来自旧版 settings.yaml 的一次性导入。
      confirm: false
      enabled: true
  actionOrder:
    - source: custom
      id: 7d3f2a4e-9c1b-4e8a-b5d6-0f1e2d3c4b5a
  presetStateById: {}
YAML

mkdir -p "$DSH_HOME/sessions"
cp -a "$DSH_QA_IMPORT_SESSIONS" "$DSH_HOME/sessions/" || exit 1

stop_ours
[ -n "$(qa_tarball)" ] || qa_pack || exit 1
qa_install || exit 1
boot || exit 1

# The import runs once every entry has settled, which can trail the entry url.
for _ in $(seq 1 60); do
  [ -f "$DSH_HOME/settings.yaml.imported" ] && break
  sleep 1
done
[ -f "$DSH_HOME/settings.yaml.imported" ] || { echo 'settings.yaml was never imported' >&2; exit 1; }
[ ! -e "$DSH_HOME/settings.yaml" ] || { echo 'settings.yaml is still in place after the import' >&2; exit 1; }
node tests/gui/check-row.mjs || exit 1

DSH_GUI_ENTRY=$(entry_url) DSH_QA_IMPORT=1 \
  pnpm exec playwright test import.spec.ts --project=desktop
