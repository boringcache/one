# Repository Boundary

`boringcache/one` owns the standalone maintained GitHub Action product surface:

- action inputs, outputs, defaults, and validation;
- mode orchestration for archive, Docker, BuildKit, Bazel, Go, Gradle, Turbo, and Rust sccache flows;
- bundled action helpers under `lib/core`;
- generated `dist` bundles required by GitHub Actions;
- action E2E workflows and release tag movement.

The CLI owns cache protocol behavior, registry proxy semantics, local adapters, CI run-context detection for proxy save requests, and release binaries. The action may derive GitHub provider metadata, seed `BORINGCACHE_CI_*` environment values, and invoke the CLI, but it should not reimplement Rails API policy, Docker ref planning, or proxy protocol rules.

The action owns the user-facing `metadata-hints` input, but the CLI owns hint validation, prioritization, normalization, and replayable proxy argument shape. The action should pass low-cardinality workflow labels into the CLI dry-run request and then forward the returned `proxy.metadata_hints`; it should not keep a second sanitizer or merge path. Repo-configured proxy metadata from `.boringcache.toml` should flow through the same CLI dry-run plan by default; action inputs are the override path, not a replacement config system.

Rails owns workspace, token, storage, publish, restore, session, billing, and API truth. Action changes that need a new API contract should update the web ADR/comprehension path and the CLI request path in the same rollout.

The retired `@boringcache/action-core` package is not part of the maintained action path. Do not add it as a dependency or route new behavior through a separate npm release. New product behavior should land here, in CLI, or in Rails.

ADR note: [docs/adr/0001-cli-plan-owned-action-contract.md](../adr/0001-cli-plan-owned-action-contract.md) is the current launch-readiness boundary. It keeps `.boringcache.toml`, Docker ref derivation, and adapter planning owned by the CLI, with the action acting as GitHub Actions orchestration around CLI dry-run JSON.

Bazel, Gradle, and Maven on-disk tool setup is also CLI-planned. The action may materialize files, directories, and environment variables from `adapter.setup`, but `.bazelrc`, Gradle init/properties, Maven extensions/build-cache XML content, and default path resolution should stay in the CLI plan instead of being recreated in TypeScript.

Turbo, Nx, and sccache proxy environment wiring is CLI-planned too. The action may rewrite the planned local proxy port after startup, apply explicit GitHub Actions token/team overrides for Turbo/Nx, and set action-lifecycle values such as `SCCACHE_IDLE_TIMEOUT`, but it should otherwise export the CLI dry-run `env_vars` instead of carrying a second adapter plan in TypeScript.

Adapter proxy tag shape comes from the CLI dry-run plan, which merges `.boringcache.toml` defaults with explicit action inputs. The action must start `cache-registry` and build deferred post-save verification specs from the same `proxy.no_platform` and `proxy.no_git` values; do not re-derive suffixing in TypeScript or hardcode portable proxy tags in one path only.

The action must check the CLI dry-run `schema_version` before using adapter or OCI planning, and must check `adapter.setup.schema_version` before replaying setup files, directories, or env vars. Unsupported versions should fail with an explicit update/pin message instead of partially applying a setup plan whose file modes or fields may have changed.

Docker and BuildKit registry modes must consume the complete CLI-planned OCI import/export specs. If the CLI dry-run returns multiple `oci_cache.cache_from_refs` such as PR, branch, default, and stable fallback refs, the action should pass each one as its own `--cache-from` or `--import-cache` flag instead of rebuilding, narrowing, or appending fields such as `registry.insecure=true` in TypeScript.

The action owns the runtime readiness check for those planned Docker and BuildKit imports. Proxy startup is not complete merely because `/_boringcache/status` says `phase=ready`; the action must also prove which planned OCI refs are readable through the started proxy, filter actual build arguments to the readable set, and expose both the requested and used ref sets through action outputs. If none of the planned refs are readable, the action should continue without registry imports and report a cold-seed notice. If only some refs are readable, keep a warning because the warm fallback set is degraded. Downstream workflows should not implement their own competing manifest-readability gate.

Rust cache-hit detection must use structured CLI results instead of parsing human restore logs. Archive subcache restore uses `boringcache check --json` before restore to decide the action output, and proxy sccache preflight keeps the strict `--require-server-signature` check while still reading structured JSON.

Rust archive cache identity comes from the CLI plan. The action does not expose Rust-specific exact-tag override inputs such as `cargo-tag`, `cargo-git-tag`, `cargo-bin-tag`, `target-tag`, or `sccache-tag`; use `.boringcache.toml`, generic archive entries, `cache-tag`, or CLI-owned tag suffixing instead of mutating resolved Rust entries in TypeScript.

Docker and BuildKit registry modes must also forward CLI-planned `oci_cache.promotion_ref_tags` to `cache-registry` as real `--oci-alias-promotion-ref` arguments. The `docker_alias_promotion_refs` metadata hint is diagnostic only; it does not cause the proxy to bind branch, PR, default, or stable OCI aliases after an immutable run-ref export.

Pull request runs are restore-only by default. A PR-scoped Docker or BuildKit ref such as `/cache:pr-3208` may legitimately be missing, because the action does not publish it unless `save-on-pull-request` is explicitly enabled. That miss should be handled by the CLI-planned branch/default/stable fallback imports. If PR saving is enabled, the normal derived promotion target is the PR alias; the action should not turn a missing PR alias into branch/default write permission.

Docker support should stay on the BuildKit registry-cache path through CLI-planned `--cache-from` and `--cache-to` refs. Do not add a second Docker adoption path without a named migration ADR.

Preset cache environment exports are a CLI dry-run contract. The action should export `plan.envVars` for Bundler, Node package managers, uv, Go, Composer, and similar cache entries, not recompute those paths locally. Runtime bootstrap such as mise and Corepack stays action-side.

Benchmark evidence for launch copy should come from action artifacts that name the action ref, CLI version/ref, cache mode, immutable run refs, alias promotion status, and `cache_session_summary` diagnostics.

Verification is action orchestration, not Rails policy. Normal restores inherit strict server-signature verification from the action environment, but post-save `verify` checks must honor `verify-require-server-signature`; when that input is false, the action clears the inherited strict env only for the `boringcache check` subprocess. Post-save verification may accept structured `pending`/`uploading` check results only for tags marked `saveExpected`, so valid contention does not wait on tag visibility while true misses and restore-time verification remain strict.

`trusted-workspace-signing-key-fingerprint` is action input plumbing for the CLI trust boundary. The action exports `BORINGCACHE_TRUSTED_WORKSPACE_KEY_FINGERPRINT`; the CLI verifies the returned workspace signing key and server signature payload.

Archive restore should happen before mise tool probes or installs. Tool discovery can execute language binaries in the project directory, and those binaries must not get a chance to populate archive cache targets before `boringcache restore` sees them.

Release alignment note: the current action release candidate is `v1.12.78` and the default CLI install version is `v1.12.57`. Keep `action.yml`, `lib/utils.ts`, restore tests, generated `dist/**`, and package version changes together for future CLI default bumps, and do not treat the bump as public until it is signed, tagged, and `one@v1` is moved.
