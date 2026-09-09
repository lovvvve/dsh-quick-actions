#!/bin/sh
# Install and uninstall the plugin in the user's own web profile, following the feature
# package README's local-tarball flow step for step. Sourced, never executed:
#   . tests/gui/install.sh   (from the repository root)
#
# This is the install window itself, scripted — the same procedure the earlier rounds ran by
# hand — so that the reinstall round can close and reopen it mid-round, and so the evidence
# is reproducible rather than a transcript.
#
# The user's profile is treated as borrowed: `qa_profile_snapshot` fingerprints the two
# files `dsh plugin` maintains before anything is touched, and `qa_profile_verify` is how
# the round proves they came back byte-identical.
#
# Provides: qa_pack, qa_install, qa_uninstall, qa_profile_snapshot, qa_profile_verify.

QA_TARBALLS=.playwright/tarballs
QA_BUNDLE_NAME=dsh-composer-quick-actions-bundle
QA_PROFILE=${DSH_HOME:-$HOME/.dsh}/profiles/web
QA_FINGERPRINT=.playwright/profile-fingerprint.txt
# The desktop shim would exec an older globally installed `dsh`, so the runtime is always
# named explicitly (round 1's PATH trap).
QA_DSH="npx --yes @deepseek-ai/dsh@latest"

# Absolute, both of them: `dsh plugin` forwards to pnpm running *in the profile directory*,
# so a path relative to this repository resolves under `<DSH_HOME>/profiles/web` and fails
# with ENOENT. The README says "绝对路径" for the override for the same reason.
qa_feature_tarball() {
  ls "$(pwd)/$QA_TARBALLS"/dsh-composer-quick-actions-[0-9]*.tgz 2>/dev/null | head -1
}

qa_bundle_tarball() {
  ls "$(pwd)/$QA_TARBALLS"/$QA_BUNDLE_NAME-[0-9]*.tgz 2>/dev/null | head -1
}

# README step 1. The feature package declares `prepack`, so its tarball is always built
# from the current source; the bundle has no build.
qa_pack() {
  mkdir -p "$QA_TARBALLS"
  rm -f "$QA_TARBALLS"/*.tgz
  pnpm --filter dsh-composer-quick-actions pack --pack-destination "$QA_TARBALLS" || return 1
  pnpm --filter $QA_BUNDLE_NAME pack --pack-destination "$QA_TARBALLS" || return 1
  ls -l "$QA_TARBALLS"
}

# Applies to one command and nothing else: this profile's lockfile holds third-party plugin
# versions inside pnpm's default 24h window, and `minimumReleaseAgeExclude` does not work
# for scoped packages (pnpm 11.7.0, recorded in the ticket 18 evidence). No policy of the
# user's is changed. Both `add` and `remove` need it — the removal verifies the lockfile it
# is about to rewrite, and that verification is what the window trips.
QA_RELEASE_AGE=--config.minimumReleaseAge=0

# README steps 2 and 3.
qa_install() {
  feature=$(qa_feature_tarball)
  bundle=$(qa_bundle_tarball)
  if [ -z "$feature" ] || [ -z "$bundle" ]; then
    echo "no tarballs in $QA_TARBALLS; run qa_pack first" >&2
    return 1
  fi
  node tests/gui/profile-override.mjs --add "$feature" || return 1
  $QA_DSH plugin --profile web add "$bundle" $QA_RELEASE_AGE || return 1
  # The row is contributed by the bundle layer and takes effect on the next profile boot.
  $QA_DSH --profile web --dump-config | grep -A1 'id: composer-quick-actions'
}

# README "卸载". The Settings namespace is deliberately left alone — that is what makes a
# reinstall restore the user's actions, and it is the claim the reinstall round checks.
qa_uninstall() {
  $QA_DSH plugin --profile web remove $QA_BUNDLE_NAME $QA_RELEASE_AGE || return 1
  node tests/gui/profile-override.mjs --restore
}

qa_profile_snapshot() {
  mkdir -p .playwright
  ( cd "$QA_PROFILE" && sha256sum package.json pnpm-workspace.yaml ) > "$QA_FINGERPRINT" || return 1
  echo "fingerprinted the profile files in $QA_FINGERPRINT"
}

qa_profile_verify() {
  # Absolute before the subshell changes directory: `sha256sum -c` reads the list itself.
  fingerprint=$(pwd)/$QA_FINGERPRINT
  [ -f "$fingerprint" ] || { echo "no fingerprint to verify against" >&2; return 1; }
  ( cd "$QA_PROFILE" && sha256sum -c "$fingerprint" )
}
