#!/usr/bin/env bash

set -euo pipefail

release_tag="${1:-}"
if [[ -n "$release_tag" && ! "$release_tag" =~ ^v[0-9]+\.[0-9]+\.[0-9]+$ ]]; then
  echo "Release tag must look like vX.Y.Z, got $release_tag" >&2
  exit 1
fi

default_version="$(awk '
  $1 == "cli-version:" { in_cli = 1 }
  in_cli == 1 && $1 == "default:" {
    value = $2
    gsub(/\047|"/, "", value)
    print value
    exit
  }
' action.yml)"

if [[ ! "$default_version" =~ ^v[0-9]+\.[0-9]+\.[0-9]+$ ]]; then
  echo "action.yml cli-version default must look like vX.Y.Z, got ${default_version:-<missing>}" >&2
  exit 1
fi

test -f README.md
test -f LICENSE
test -s dist/restore/index.js
test -s dist/save/index.js
test -s dist/utils.js

for source_path in docs examples scripts lib tests package.json package-lock.json tsconfig.json jest.config.js node_modules; do
  if [[ -e "$source_path" ]]; then
    echo "$source_path belongs in the private monorepo gha source, not the public distribution repo." >&2
    exit 1
  fi
done

find dist -name '*.js' -print0 | xargs -0 -n1 node --check

DEFAULT_VERSION="$default_version" node <<'NODE'
const fs = require('node:fs')

const version = process.env.DEFAULT_VERSION
const escapedVersion = version.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
const fallback = new RegExp(
  `getInput\\((['"])cli-version\\1\\)\\s*\\|\\|\\s*(['"])${escapedVersion}\\2`,
)

for (const path of ['dist/utils.js', 'dist/restore/index.js', 'dist/save/index.js']) {
  const source = fs.readFileSync(path, 'utf8')
  if (!fallback.test(source)) {
    throw new Error(`${path} does not contain the cli-version fallback ${version}`)
  }
}
NODE
