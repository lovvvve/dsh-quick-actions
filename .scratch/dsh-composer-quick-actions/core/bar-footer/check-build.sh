#!/bin/sh
# Readiness regression for a source tree with the footer patch applied.
# Does not install dependencies, launch DSH, or touch a running profile.
set -eu
if [ "$#" -ne 1 ]; then
  printf 'Usage: sh check-build.sh /absolute/path/to/dsh-source\n' >&2
  exit 2
fi
cd "$1"
node ./node_modules/typescript/bin/tsc -b packages/api/job-controller/tsconfig.client.json
node ./node_modules/typescript/bin/tsc -b packages/client/ui-conversation/tsconfig.json
printf 'PASS: minimal Remote consumer and full conversation type build\n'
