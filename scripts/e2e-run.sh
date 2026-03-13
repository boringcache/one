#!/usr/bin/env bash
set -euo pipefail

phase="${1:-}"
case_id="${2:-}"
workdir="${3:-}"

if [[ -z "$phase" || -z "$case_id" || -z "$workdir" ]]; then
  echo "usage: $0 <seed|verify> <case-id> <workdir>" >&2
  exit 1
fi

run_archive_compat_node() {
  pushd "$workdir" >/dev/null
  export npm_config_cache="$workdir/.npm-cache"
  if [[ "$phase" == "seed" ]]; then
    npm install --ignore-scripts
  fi
  node -e "const isNumber = require('is-number'); if (!isNumber(42)) { throw new Error('expected dependency to load'); } console.log('archive-compat-node-ok');"
  popd >/dev/null
}

run_node_pnpm() {
  pushd "$workdir" >/dev/null
  pnpm config set store-dir .pnpm-store
  if [[ "$phase" == "seed" ]]; then
    pnpm install --ignore-scripts
  fi
  pnpm exec node -e "const isOdd = require('is-odd'); if (!isOdd(3)) { throw new Error('expected pnpm dependency to load'); } console.log('node-pnpm-ok');"
  popd >/dev/null
}

run_node_yarn() {
  pushd "$workdir" >/dev/null
  yarn config set cache-folder .yarn-cache
  if [[ "$phase" == "seed" ]]; then
    yarn install --ignore-scripts
  fi
  yarn node -e "const isEven = require('is-even'); if (!isEven(4)) { throw new Error('expected yarn dependency to load'); } console.log('node-yarn-ok');"
  popd >/dev/null
}

run_ruby() {
  pushd "$workdir" >/dev/null
  export BUNDLE_PATH="$workdir/vendor/bundle"
  if [[ "$phase" == "seed" ]]; then
    bundle install --jobs 4 --retry 3
  fi
  bundle exec rake
  popd >/dev/null
}

run_rails_preset() {
  pushd "$workdir" >/dev/null
  export BUNDLE_PATH="$workdir/vendor/bundle"
  export npm_config_cache="$workdir/.npm-cache"
  if [[ "$phase" == "seed" ]]; then
    bundle install --jobs 4 --retry 3
    npm install --ignore-scripts
  fi
  bundle exec rake
  node -e "const isNumber = require('is-number'); if (!isNumber(42)) { throw new Error('expected node dependency to load'); } console.log('rails-preset-node-ok');"
  popd >/dev/null
}

run_python() {
  pushd "$workdir" >/dev/null
  if [[ "$phase" == "seed" ]]; then
    python -m venv .venv
    source .venv/bin/activate
    python -m pip install --upgrade pip
    python -m pip install -r requirements.txt
  else
    source .venv/bin/activate
  fi
  python app.py | grep "python-e2e-ok"
  popd >/dev/null
}

run_go() {
  pushd "$workdir" >/dev/null
  export GOMODCACHE="$workdir/.cache/gomod"
  export GOCACHE="$workdir/.cache/gobuild"
  mkdir -p "$GOMODCACHE" "$GOCACHE"
  if [[ "$phase" == "seed" ]]; then
    go mod tidy
  fi
  go test ./...
  go run . | grep "go-e2e-ok"
  popd >/dev/null
}

run_java_maven() {
  pushd "$workdir" >/dev/null
  export MAVEN_OPTS="-Dmaven.repo.local=$workdir/.m2/repository"
  mvn -B test
  java -cp target/classes com.example.App | grep "java-maven-e2e-ok"
  popd >/dev/null
}

run_elixir() {
  pushd "$workdir" >/dev/null
  export MIX_HOME="$workdir/.mix"
  export HEX_HOME="$workdir/.hex"
  if [[ "$phase" == "seed" ]]; then
    mix local.hex --force
    mix local.rebar --force
    mix deps.get
  fi
  mix test
  popd >/dev/null
}

run_docker() {
  local image_ref="${E2E_IMAGE_REF:?E2E_IMAGE_REF is required for docker mode}"
  docker run --rm "$image_ref" | grep "docker-mode-ok"
}

run_buildkit() {
  local buildkit_output="${E2E_BUILDKIT_OUTPUT:?E2E_BUILDKIT_OUTPUT is required for buildkit mode}"
  test -s "$buildkit_output"
}

run_bazel() {
  pushd "$workdir" >/dev/null
  bazel build //:hello
  ./bazel-bin/hello | grep "bazel-mode-ok"
  grep -- "--remote_cache=http://127.0.0.1:" "$HOME/.bazelrc"
  popd >/dev/null
}

run_gradle() {
  local gradle_home="${E2E_GRADLE_HOME:?E2E_GRADLE_HOME is required for gradle mode}"
  pushd "$workdir" >/dev/null
  gradle --no-daemon --gradle-user-home "$gradle_home" test
  test -f "$gradle_home/init.d/boringcache-cache.gradle"
  popd >/dev/null
}

run_rust_sccache() {
  pushd "$workdir" >/dev/null
  if [[ "$phase" == "verify" ]]; then
    cargo clean
  fi
  cargo build --release
  local stats
  stats="$(sccache --show-stats || true)"
  printf '%s\n' "$stats"
  if [[ "$phase" == "verify" ]]; then
    local hits
    hits="$(printf '%s\n' "$stats" | awk '/Cache hits/ { gsub(/[^0-9]/, "", $NF); print $NF; exit }')"
    if [[ -z "$hits" || "$hits" -eq 0 ]]; then
      echo "expected remote sccache hits during verify phase" >&2
      exit 1
    fi
  fi
  popd >/dev/null
}

run_turbo_proxy() {
  pushd "$workdir" >/dev/null
  export npm_config_cache="$workdir/.npm-cache"
  if [[ "$phase" == "seed" ]]; then
    npm install --ignore-scripts
  fi
  local turbo_log="$workdir/turbo-${phase}.log"
  npx turbo run build --output-logs=full | tee "$turbo_log"
  test -f "$workdir/packages/app/dist/output.txt"
  if [[ "$phase" == "verify" ]]; then
    grep -E -i "cache hit|cached" "$turbo_log"
  fi
  popd >/dev/null
}

case "$case_id" in
  archive-compat-node) run_archive_compat_node ;;
  node-pnpm) run_node_pnpm ;;
  node-yarn) run_node_yarn ;;
  ruby) run_ruby ;;
  rails-preset) run_rails_preset ;;
  python) run_python ;;
  go) run_go ;;
  java-maven|maven) run_java_maven ;;
  elixir) run_elixir ;;
  docker) run_docker ;;
  buildkit) run_buildkit ;;
  bazel) run_bazel ;;
  gradle) run_gradle ;;
  rust-sccache) run_rust_sccache ;;
  turbo-proxy) run_turbo_proxy ;;
  *)
    echo "unknown case: $case_id" >&2
    exit 1
    ;;
esac
