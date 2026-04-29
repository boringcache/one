# ADR 0001: CLI Plan Owned Action Contract

Status: accepted launch-readiness decision
Date: 2026-04-22

## Context

`boringcache/one` is the maintained GitHub Action surface. It installs/selects the CLI, accepts workflow inputs, starts local proxies, wires `actions/cache` compatibility where needed, and emits action outputs.

The local sweep found the good path already exists:

- Docker and native adapter modes call `boringcache <adapter> --dry-run --json`.
- Archive mode calls `boringcache run --dry-run --json`.
- Registry proxy startup uses the maintained `cache-registry` command.
- Split restore/save tokens are first-class, with `BORINGCACHE_API_TOKEN` retained as a legacy fallback.
- The local sweep found one maintained Docker path: CLI-planned BuildKit registry-cache refs through Docker/BuildKit mode.

The remaining risk is drift: the action can accidentally become a second planner for `.boringcache.toml`, Docker refs, tag suffixes, or Rails policy.

## Decision

The action must remain an orchestrator around CLI-owned plans.

It may:

- validate action inputs;
- select/install a CLI version;
- choose read-only versus save-capable execution from available tokens;
- collect GitHub Actions provider metadata;
- accept explicit low-cardinality `metadata-hints` from workflow authors;
- invoke the CLI dry-run plan;
- start the CLI proxy with replayable metadata hints from that plan;
- materialize CLI-planned adapter setup files, directories, and environment variables;
- publish concise outputs for workflow steps.

Shared proxy metadata defaults belong in `.boringcache.toml` and should arrive
through the CLI dry-run plan. Action-level `metadata-hints` are the workflow
override path when a job needs to add or replace labels, but validation,
normalization, ordering, and capping belong to the CLI plan.

Implementation note, 2026-04-29: proxy-backed modes start `cache-registry` and
build deferred post-save verification specs from the same CLI dry-run
`proxy.host`, `proxy.no_platform`, and `proxy.no_git` fields. Turbo, Nx, and
sccache environment wiring uses the CLI-planned `env_vars`, with the action only
rewriting the bound port after startup, applying explicit workflow token/team
overrides where those are action inputs, and setting lifecycle-only values such
as `SCCACHE_IDLE_TIMEOUT`. Docker and BuildKit consume CLI-planned
`oci_cache.cache_from_refs` and `oci_cache.cache_to` as complete BuildKit specs;
the action must not append registry-cache options in TypeScript. Archive preset
cache env also comes from the CLI dry-run `env_vars`.

It must not:

- reimplement `.boringcache.toml` semantics;
- derive Docker immutable run refs independently from the CLI;
- recreate adapter setup templates or default path rules for Bazel, Gradle, or Maven;
- guess Rails publish, restore, or stale-promotion policy;
- create a second Docker adoption path apart from the CLI plan;
- revive `@boringcache/action-core` as a maintained dependency.

## Token Boundary

Use `BORINGCACHE_RESTORE_TOKEN` for restore-capable paths and `BORINGCACHE_SAVE_TOKEN` for save-capable trusted paths.

`BORINGCACHE_API_TOKEN` remains a compatibility fallback only. New examples and launch copy should not lead with it.

When only a restore token exists, proxy-backed modes may run read-only. The action should say that clearly instead of failing late during save/export.

## Docker Boundary

The maintained Docker UX is the outer BuildKit registry cache path:

- the CLI plans `--cache-from` and `--cache-to`;
- the action starts `cache-registry`;
- BuildKit talks OCI registry protocol to the local proxy;
- Rails owns publish and tag pointer truth.

The action should keep Docker support on this path. CLI releases must not become
Docker cache inputs.

## Cross-Platform Boundary

The action should pass through runner platform and CI metadata to the CLI plan. It should not treat Windows, macOS, Linux, x86, and arm64 archives as safely interchangeable unless the CLI plan/config says the entry is portable.

Where the action uses `actions/cache` compatibility, cross-OS behavior is opt-in and inherits the upstream tar/zstd constraints documented by `actions/cache`.

For Docker alias promotion, GitHub Actions run-start time is a contract field for Rails ordering, not just a proxy label. When `GITHUB_ACTIONS=true` and `BORINGCACHE_CI_RUN_STARTED_AT` is absent, the action generates one ISO timestamp, passes it to the CLI dry-run environment, and leaves the same value in `process.env` so the CLI proxy process can detect the same run context. The replayable proxy metadata hints keep `ci_run_started_at` high in the capped list for diagnostics, but the CLI save request owns the first-class fields sent to Rails.

## Performance Guardrails

- Prefer one CLI dry-run per mode/step.
- Avoid resolving many raw archive entries with one CLI subprocess per entry.
- Cache a parsed plan inside the step rather than re-running the CLI for restore and save halves when the plan is unchanged.
- Keep generated `dist` bundles in sync with source changes before release.
- Keep metadata hints capped and replayable; do not stuff unbounded CI context into proxy arguments.
- When the action accepts explicit `metadata-hints`, pass them into the CLI dry-run plan so the CLI can prioritize user-facing grouping labels such as `project`, `benchmark`, `phase`, and `tool` ahead of per-run diagnostic labels when the replayable proxy hint cap is tight.

## Legacy Surfaces

`@boringcache/action-core` is retired. Do not add new behavior there.

`setup-boringcache` may remain compatibility bootstrap copy, but launch docs should lead with `boringcache/one@v1` plus the current CLI defaults.

Do not add an advanced or compatibility Docker path unless a named customer migration is documented and time-boxed in a later ADR.

## Benchmark Evidence Gate

Any public action performance claim must name the action ref, CLI version/ref, web deploy SHA when Rails is involved, benchmark repo/ref, workflow run URL, cache mode, cold/warm/stale classification, and diagnostics artifact. External cache docs and blogs explain market pain, but they do not prove BoringCache speed.

For Docker mode, the required diagnostics include immutable run ref, import aliases, promotion aliases, `cache_session_summary`, BuildKit import/export timings where available, OCI blob counts/bytes, upload-requested versus already-present blobs, and cache-root publish/promotion status.

## Open Work

- Add or keep action artifacts that record action ref, CLI version, cache mode, OCI hydration mode, immutable run ref, import aliases, promotion aliases, and promotion status.
- Add released action-path evidence that `ci_run_started_at` or its successor reaches Rails ordering fields when alias promotion is active.
- Reduce per-entry dry-run subprocesses in archive compatibility planning.
- Keep `v1` action tag movement tied to signed release commits/tags.
- Delete or archive retired action-core only after an explicit migration gate confirms no release path or docs still depend on it.
