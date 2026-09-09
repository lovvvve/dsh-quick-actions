# Install and uninstall the plugin in the user's own web profile, following the README's
# local-tarball flow step for step. Sourced, never executed:
#   . tests/gui/install.sh   (from the repository root)
#
# This is the install window itself, scripted — the same procedure the earlier rounds ran by
# hand — so that the reinstall round can close and reopen it mid-round, and so the evidence
# is reproducible rather than a transcript.
#
# Since ticket 28 there is ONE package: it carries the bundle patch, both halves and the
# implementation, so a local install is one tarball and one command. The profile `overrides`
# entry the two-package layout needed is gone with it.
#
# The user's profile is treated as borrowed: `qa_profile_snapshot` fingerprints the two
# files `dsh plugin` maintains before anything is touched, and `qa_profile_verify` is how
# the round proves they came back byte-identical.
#
# Provides: qa_pack, qa_install, qa_uninstall, qa_profile_snapshot, qa_profile_verify.

QA_TARBALLS=.playwright/tarballs
QA_PACKAGE=dsh-quick-actions
QA_PROFILE=${DSH_HOME:-$HOME/.dsh}/profiles/web
QA_FINGERPRINT=.playwright/profile-fingerprint.txt
# The desktop shim would exec an older globally installed `dsh`, so the runtime is always
# named explicitly (round 1's PATH trap).
QA_DSH="npx --yes @deepseek-ai/dsh@latest"

# Absolute: `dsh plugin` forwards to pnpm running *in the profile directory*, so a path
# relative to this repository resolves under `<DSH_HOME>/profiles/web` and fails with ENOENT.
qa_tarball() {
  ls "$(pwd)/$QA_TARBALLS"/$QA_PACKAGE-[0-9]*.tgz 2>/dev/null | head -1
}

# README step 1. The package declares `prepack`, so its tarball is always built from the
# current source.
qa_pack() {
  mkdir -p "$QA_TARBALLS"
  rm -f "$QA_TARBALLS"/*.tgz
  pnpm --filter $QA_PACKAGE pack --pack-destination "$QA_TARBALLS" || return 1
  ls -l "$QA_TARBALLS"
}

# Applies to one command and nothing else: this profile's lockfile holds third-party plugin
# versions inside pnpm's release-age window, and those entries are checked on every install
# — including ones that add nothing of ours. No policy of the user's is changed. Both `add`
# and `remove` need it: the removal verifies the lockfile it is about to rewrite.
QA_RELEASE_AGE=--config.minimumReleaseAge=0

# README step 2.
qa_install() {
  tarball=$(qa_tarball)
  if [ -z "$tarball" ]; then
    echo "no tarball in $QA_TARBALLS; run qa_pack first" >&2
    return 1
  fi
  $QA_DSH plugin --profile web add "$tarball" $QA_RELEASE_AGE || return 1
  # The row is contributed by this package's own bundle layer and takes effect on the next
  # profile boot.
  $QA_DSH --profile web --dump-config | grep -A1 'id: composer-quick-actions'
}

# README "卸载". The Settings namespace is deliberately left alone — that is what makes a
# reinstall restore the user's actions, and it is the claim the reinstall round checks.
qa_uninstall() {
  $QA_DSH plugin --profile web remove $QA_PACKAGE $QA_RELEASE_AGE
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
