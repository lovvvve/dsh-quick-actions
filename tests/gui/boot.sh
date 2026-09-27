#!/bin/sh
# Shared profile control for the GUI verification rounds. Sourced, never executed:
#   . tests/gui/boot.sh   (from the repository root)
#
# CLAUDE.md keeps GUI verification on a single channel — the DSH the user already runs —
# so this never touches a server it did not start. It boots one only when the channel is
# free, records its process group, and stops exactly that group.
#
# Provides: DSH_GUI_URL, DSH_QA_RUNTIME, LOG, entry_url, boot, stop_ours.
#
# External channel (ticket 32): when `DSH_GUI_ENTRY` already names a token-bearing entry URL
# and the channel answers, the round uses that server as is — `boot` starts nothing and
# `stop_ours` stops nothing. That is how a round runs against the DSH the user keeps open
# (with `patchReload: live`, installs and seeds reach it without a restart). Rounds that
# must restart the profile still need the channel free and a server of their own.

DSH_GUI_URL=${DSH_GUI_URL:-http://127.0.0.1:3080}
export DSH_GUI_URL
DSH_HOME=${DSH_HOME:-$HOME/.dsh}
export DSH_HOME
# The runtime a round boots and installs with. DSH's `latest` dist-tag still names the
# 0.1.5 line this plugin no longer supports (spec 22.6), so the default is `next`.
DSH_QA_RUNTIME=${DSH_QA_RUNTIME:-@deepseek-ai/dsh@next}
export DSH_QA_RUNTIME
LOG=.playwright/dsh-web.log
PIDFILE=.playwright/dsh-web.pid
mkdir -p .playwright

channel_answers() {
  [ "$(curl -s -o /dev/null -w '%{http_code}' --max-time 2 "$DSH_GUI_URL/")" != "000" ]
}

# The launcher runs through npx and the process that holds the socket is a grandchild, so
# signalling one pid leaves the port bound: the profile is started in its own session and
# stopped by process group. The group leader records its *own* pid, because `setsid` forks
# when its caller is already a group leader and `$!` would then name a process that exits
# immediately — which silently turned this into a no-op.
stop_ours() {
  [ -f "$PIDFILE" ] || return 0
  group=$(cat "$PIDFILE")
  kill -TERM -"$group" 2>/dev/null || kill -TERM "$group" 2>/dev/null || true
  for _ in $(seq 1 30); do
    channel_answers || break
    sleep 1
  done
  rm -f "$PIDFILE"
}

entry_url() {
  if external_channel; then
    printf '%s\n' "$DSH_GUI_ENTRY"
    return 0
  fi
  grep -o "$DSH_GUI_URL/?token=[^ )]*" "$LOG" | tail -1
}

# True when the round was handed the entry of a server it must not own.
external_channel() {
  [ -n "${DSH_GUI_ENTRY:-}" ] && [ ! -f "$PIDFILE" ] && channel_answers
}

boot() {
  if external_channel; then
    echo "using the running server behind DSH_GUI_ENTRY; nothing is booted"
    return 0
  fi
  stop_ours
  if channel_answers; then
    echo "$DSH_GUI_URL is served by a process this round did not start." >&2
    echo "GUI verification runs on that one channel, so stop that server yourself first," >&2
    echo "or point DSH_GUI_URL at a port this round may own." >&2
    return 1
  fi

  : > "$LOG"
  # No `dsh --patch` overlay: DSH 0.1.7 refuses form writes to an entry an overlay overrides,
  # so rounds that stage author presets declare them in the profile patch (seed-presets.mjs).
  setsid sh -c "echo \$\$ > '$PIDFILE'; exec npx --yes $DSH_QA_RUNTIME web --no-open" >>"$LOG" 2>&1 &

  for _ in $(seq 1 90); do
    if grep -q "dsh web: http" "$LOG" 2>/dev/null; then
      # The url is printed before the app can serve its first client load, and a cold
      # first mount is what otherwise makes the first test of a boot need a retry.
      sleep 8
      [ -n "$(entry_url)" ] && return 0
      echo "the entry url in $LOG does not match $DSH_GUI_URL" >&2
      return 1
    fi
    sleep 1
  done
  echo "server never printed its entry url; see $LOG" >&2
  return 1
}
