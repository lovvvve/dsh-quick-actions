#!/bin/sh
# Close the install window: stop the profile this session booted, uninstall the plugin the
# way the README's "卸载" step describes, and check that the two profile files `dsh plugin`
# maintains came back exactly as they were found.
#
# Usage, from the repository root:  sh tests/gui/close-window.sh
#
# The Settings namespace is deliberately *not* removed here — that is the README's separate
# manual-cleanup step, and `reinstall-round.sh` restores the user's own namespace itself. If
# a round left a seeded namespace behind, restore it before running this.
set -u

. tests/gui/boot.sh
. tests/gui/install.sh

stop_ours
qa_uninstall || exit 1
qa_profile_verify || exit 1
echo 'the window is closed and the profile is byte-identical to how it was found'
