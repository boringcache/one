# Repository Boundary

`boringcache/one` owns the standalone maintained GitHub Action runtime surface:

- action inputs, outputs, defaults, and validation;
- mode orchestration for archive, Docker, BuildKit, Bazel, Go, Gradle, Turbo, and Rust sccache flows;
- bundled action helpers under `lib/core`;
- generated `dist` bundles required by GitHub Actions;
- action E2E workflows and release tag movement.

The CLI owns cache protocol behavior, registry proxy semantics, local adapters, CI run-context detection for proxy save requests, and release binaries. The action may derive GitHub provider metadata, seed `BORINGCACHE_CI_*` environment values, and invoke the CLI, but it should not reimplement Rails API policy, Docker ref planning, or proxy protocol rules.

The CLI also owns generated cache scope. Default, trusted-branch, PR, base,
platform, and no-git fallback ordering must come from CLI planning or CLI
restore/check behavior across archive, proxy adapters, and Docker/BuildKit.
The action may expose GitHub event metadata and set
`BORINGCACHE_SAVE_ON_PULL_REQUEST=1` when `save-on-pull-request` is explicitly
enabled, plus process-local `BORINGCACHE_RESTORE_PR_CACHE=1` for matching CLI
restore subprocesses, but it must not keep a parallel branch/default/PR suffix
planner.

The action owns the user-facing `metadata-hints` input, but the CLI owns hint validation, prioritization, normalization, and replayable proxy argument shape. The action should pass low-cardinality workflow labels into the CLI dry-run request and then forward the returned `proxy.metadata_hints`; it should not keep a second sanitizer or merge path. Repo-configured proxy metadata from `.boringcache.toml` should flow through the same CLI dry-run plan by default; action inputs are the override path, not a replacement config system.

Rails owns workspace, token, storage, publish, restore, session, billing, and API truth. Action changes that need a new API contract should update the web ADR/comprehension path and the CLI request path in the same rollout.

The retired `@boringcache/action-core` package is not part of the maintained action path. Do not add it as a dependency or route new behavior through a separate npm release. New runtime behavior should land here, in CLI, or in Rails.

ADR note: [docs/adr/0001-cli-plan-owned-action-contract.md](../adr/0001-cli-plan-owned-action-contract.md) is the current launch-readiness boundary. It keeps `.boringcache.toml`, Docker ref derivation, and adapter planning owned by the CLI, with the action acting as GitHub Actions orchestration around CLI dry-run JSON.

Bazel, Gradle, and Maven on-disk tool setup is also CLI-planned. The action may materialize files, directories, and environment variables from `adapter.setup`, but `.bazelrc`, Gradle init/properties, Maven extensions/build-cache XML content, and default path resolution should stay in the CLI plan instead of being recreated in TypeScript.

`mode: bazel` means Bazel remote-cache setup. It should not silently add archive
caches for Bazel output roots or disk-cache directories. Use explicit archive
`entries` or a CLI-resolved opt-in cache profile when a workflow should restore
local Bazel state alongside the remote cache.

The action must not expose the versioned BoringCache CLI hosted-tool-cache
directory to Bazel. Bazel action and repository-rule keys can include environment
state such as `PATH`, and a BoringCache release should not invalidate a user's
Bazel cache. `ensureBoringCache` should copy the selected CLI to the stable
`~/.boringcache/bin` workflow path and add only that directory to `PATH`.

Turbo, Nx, and sccache proxy environment wiring is CLI-planned too. The action may rewrite the planned local proxy port after startup, apply explicit GitHub Actions token/team overrides for Turbo/Nx, and set action-lifecycle values such as `SCCACHE_IDLE_TIMEOUT`, but it should otherwise export the CLI dry-run `env_vars` instead of carrying a second adapter plan in TypeScript.

Adapter diagnostics belong in the CLI when they are part of the local adapter UX: proxy status, session summaries, OCI body-plane counters, and `boringcache sccache`'s best-effort `sccache --show-stats` summary should work on a laptop, generic CI runner, or container. The action may still consume native tool diagnostics when it owns split restore/save lifecycle or GitHub outputs. Current example: `mode: rust-sccache` starts and stops the `sccache` server across action phases, so the action reads `sccache --show-stats` to decide whether to save/verify and to emit concise workflow notices. That parser must not become a second source for adapter env, tag, or proxy setup. If another adapter needs workflow-facing cache stats, add a CLI structured diagnostics surface first unless the action alone owns the lifecycle being measured.

Adapter proxy tag shape comes from the CLI dry-run plan, which merges `.boringcache.toml` defaults with explicit action inputs. The action must start `cache-registry` and build deferred post-save verification specs from the same `proxy.no_platform` and `proxy.no_git` values; do not re-derive suffixing in TypeScript or hardcode portable proxy tags in one path only.

The action must check the CLI dry-run `schema_version` before using adapter or OCI planning, and must check `adapter.setup.schema_version` before replaying setup files, directories, or env vars. Unsupported versions should fail with an explicit update/pin message instead of partially applying a setup plan whose file modes or fields may have changed.

Docker and BuildKit registry modes must consume the complete CLI-planned OCI import/export specs. If the CLI dry-run returns multiple `oci_cache.cache_from_refs` such as PR, branch, and default refs, the action should pass each one as its own `--cache-from` or `--import-cache` flag instead of rebuilding, narrowing, or appending fields such as `registry.insecure=true` in TypeScript.

The action owns the runtime readiness check for those planned Docker and BuildKit imports. Proxy startup is not complete merely because `/_boringcache/status` says `phase=ready`; the action must also prove which planned OCI refs are readable through the started proxy, filter actual build arguments to the readable set, and expose both the requested and used ref sets through action outputs. It may proceed as soon as the first planned ref is readable instead of waiting for every earlier miss to time out. If none of the planned refs are readable, the action should continue without registry imports and report a cold-seed notice. If only some refs are readable, keep a warning because the warm import set is degraded. Workflows that truly require a warm OCI import, such as rolling benchmark lanes, should set `require-oci-import-ready: true`; that turns missing planned import refs, no-readable states, and partial-readable states into setup failures. Downstream workflows should not implement their own competing manifest-readability gate.

Rust cache-hit detection must use structured CLI results instead of parsing human restore logs. Archive subcache restore uses `boringcache check --json` before restore to decide the action output, and proxy sccache preflight keeps the strict `--require-server-signature` check while still reading structured JSON. A normal `boringcache restore` miss exits successfully unless `--fail-on-cache-miss` is set, so action `cache-hit` and `restore-keys` compatibility must never be inferred from restore exit code alone. If a preflight `check --json` call fails or returns no parseable JSON, the action treats that probe as a miss and continues with the normal restore path for non-fatal restores; `--fail-on-cache-miss` still fails when no structured hit is found.

Rust archive cache identity comes from the CLI plan. The action does not expose Rust-specific exact-tag override inputs such as `cargo-tag`, `cargo-git-tag`, `cargo-bin-tag`, `target-tag`, or `sccache-tag`; use `.boringcache.toml`, generic archive entries, `cache-tag`, or CLI-owned tag suffixing instead of mutating resolved Rust entries in TypeScript.

Rust cache hygiene follows the same split. CLI-planned Rust cache entries and the `sccache` adapter own cache-behavior env such as `CARGO_INCREMENTAL=0` and `SCCACHE_DIR`. The action may set Cargo home/path/color and local `SCCACHE_CACHE_SIZE` because those are GitHub Actions runtime ergonomics or local sccache tuning, not adapter cache identity.

Docker and BuildKit registry modes must also forward CLI-planned `oci_cache.promotion_ref_tags` to `cache-registry` as real `--oci-alias-promotion-ref` arguments and verify those OCI refs through the local registry proxy before post-step shutdown. Do not verify raw promotion refs with `boringcache check`; names like `default` are registry ref aliases inside the proxy namespace, not public cache-entry tags. The `docker_alias_promotion_refs` metadata hint is diagnostic only; it does not cause the proxy to bind branch, PR, or default OCI aliases after an immutable run-ref export.

Pull request runs are restore-only by default. A PR-scoped Docker or BuildKit ref such as `/cache:pr-3208` may legitimately be missing, because the action does not publish it unless `save-on-pull-request` is explicitly enabled. That miss should be handled by the CLI-planned base/default imports without reading the PR head-branch cache by default. If PR saving is enabled, the normal derived promotion target is the PR alias; the action should not turn a missing PR alias into branch/default write permission. For archive compatibility, `save-on-pull-request` exports `BORINGCACHE_SAVE_ON_PULL_REQUEST=1` for post-save intent and sets `BORINGCACHE_RESTORE_PR_CACHE=1` only for CLI restore subprocesses that need the matching PR-first read scope. The CLI must not infer PR reads from the save-side env name.

Explicit cache tags stay explicit. The CLI sanitizes generated git scope
components, but the action should not silently rewrite user-provided
`cache-tag`, entry names, or mode tags. Workflows that build tags from
`github.ref_name` must slug branch names before passing them to the action;
otherwise refs such as `gt/expose-bc-tuning-knobs` can produce server-invalid
tag names during trusted branch or manual dispatch saves.

Docker support should stay on the BuildKit registry-cache path through CLI-planned `--cache-from` and `--cache-to` refs. Do not add a second Docker adoption path without a named migration ADR.

Preset cache environment exports are a CLI dry-run contract. The action should export `plan.envVars` for Bundler, Node package managers, uv, Go, Composer, and similar cache entries, not recompute those paths locally. Runtime bootstrap such as mise and Corepack stays action-side.

Benchmark evidence for launch copy should come from action artifacts that name the action ref, CLI version/ref, cache mode, immutable run refs, alias promotion status, and `cache_session_summary` diagnostics.

Verification is action orchestration, not Rails policy. Normal restores inherit strict server-signature verification from the action environment, but post-save `verify` checks must honor `verify-require-server-signature`; when that input is false, the action clears the inherited strict env only for the `boringcache check` subprocess. Post-save verification may accept structured `pending`/`uploading` check results only for tags marked `saveExpected`, so valid contention does not wait on tag visibility while true misses and restore-time verification remain strict.

Writer proxies run with CLI `--fail-on-cache-error` by default. The action passes
that flag and treats explicit proxy shutdown failures as action failures, but it
does not decide whether a native remote-cache publish is usable. Rails owns entry
readiness, immutable version truth, and tag pointers; the CLI owns checkpoint
flushes, final stable promotion, and the user-facing shutdown error. The action
only makes those product failures visible in GitHub Actions instead of printing a
misleading graceful-exit line.

CI now has an explicit `Run core action contract tests` gate for proxy readiness,
strict OCI import handling, proxy shutdown failure detection, save verification,
and product-mode wiring. Do not weaken that gate to paper over a benchmark run:
fix the Rails, CLI, or action owner named by the failed contract.

`trusted-workspace-signing-key-fingerprint` is action input plumbing for the CLI trust boundary. The action exports `BORINGCACHE_TRUSTED_WORKSPACE_KEY_FINGERPRINT`; the CLI verifies the returned workspace signing key and server signature payload.

Archive restore should happen before mise tool probes or installs. Tool discovery can execute language binaries in the project directory, and those binaries must not get a chance to populate archive cache targets before `boringcache restore` sees them.

Release alignment note: the current action release line is `v1.12.95` and the default CLI install version is `v1.12.74`. Keep `action.yml`, `lib/utils.ts`, restore tests, generated `dist/**`, and package version changes together for future CLI default bumps. Cut releases by tagging the already-green commit SHA, not by adding a release-only commit after gates pass, and do not treat the bump as public until the signed semver tag release succeeds and `one@v1` is moved.
