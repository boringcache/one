# ADR 0002: Launch Action Readiness And Legacy Retirement

Status: accepted launch-readiness review
Date: 2026-04-23

## Context

ADR 0001 keeps `boringcache/one` as orchestration around CLI-owned plans. This
review records the launch state after the sweep for Docker path drift, contract
drift, version alignment, and performance risks.

The action is the primary CI entry point for launch copy. It must make the
simple path real without becoming a second planner.

## Decision

`boringcache/one` should present one path:

1. install or select the CLI;
2. read action inputs and split restore/save tokens;
3. collect GitHub provider metadata;
4. ask the CLI for the archive, adapter, Docker, or BuildKit dry-run plan;
5. execute that plan and expose concise outputs.

The action must not:

- implement `.boringcache.toml` merge rules;
- derive Docker immutable refs separately from the CLI;
- guess Rails restore, publish, billing, or stale-promotion policy;
- create a second Docker adoption path apart from the CLI plan;
- route new behavior through retired `@boringcache/action-core`.

## Docker Path

Docker workflows use CLI-planned BuildKit registry-cache refs through
`mode: docker`, `mode: buildkit`, or the CLI `boringcache docker` adapter.
Launch docs and action metadata should keep that as the only Docker adoption
path.

## Contract Alignment

The action should pass all CLI-planned OCI import refs and promotion refs
through to BuildKit/proxy arguments. Metadata hints remain diagnostics; they do
not replace first-class CLI plan fields or Rails ordering fields.

For Docker and BuildKit setup flows, the action now owns the runtime truth for
OCI import readiness. The setup step must not return solely on proxy
`phase=ready`; it must also probe the CLI-planned import refs through the
started proxy, surface which refs were requested versus actually readable, and
fail closed in the emitted outputs. The build path should consume:

- `cache-from` / `cache-to` as the actual action-owned build arguments;
- `docker-cache-from-refs` as the readable ref set that was used;
- `docker-cache-requested-from-refs` as the full CLI-planned import set;
- `docker-cache-unreadable-from-refs` as the unreadable subset; and
- `docker-cache-import-ready` as the all-refs-readable signal.

The build can proceed as soon as the first CLI-planned ref is readable.
Earlier misses, especially PR-scoped refs on restore-only PRs, should be
reported as unreadable refs rather than forcing the action to wait the full
readiness budget before using base/default fallback.

When every CLI-planned import ref is unreadable, the action should continue
without registry imports and report a cold-seed notice, not a release-health
warning. Partial readability remains a warning because it means at least one
expected warm ref was usable while another planned ref degraded.

Strict benchmark and deployment lanes can opt into `require-oci-import-ready`.
With that input enabled, missing planned import refs, no-readable states, and
partial-readable OCI import states are setup failures instead of soft
cold-seed/degraded warnings.

Write-capable Docker and BuildKit runs should verify CLI-planned OCI promotion
refs during post-save verification. This catches branch/default alias visibility
problems at the producing run rather than discovering them only when the next
rolling run imports.

Benchmark and product workflows should consume those outputs instead of
re-implementing their own proxy-manifest readiness probes.

Restore-only PR behavior is expected. Missing PR-scoped Docker refs should
fall back to CLI-planned base/default imports. The action should not
turn a missing PR cache into branch/default write permission.

Archive scope follows the same rule. With default PR settings the action runs
restore-only and the CLI reads base/default. With `save-on-pull-request: true`,
the action exports `BORINGCACHE_SAVE_ON_PULL_REQUEST=1` for save intent and
sets `BORINGCACHE_RESTORE_PR_CACHE=1` for the CLI restore subprocess that needs
the matching PR-first read scope. The CLI should not treat the save env name as
a restore read toggle. `restore-keys` remains an actions/cache compatibility
layer and must use structured CLI check output instead of restore exit code to
decide hits.

`BORINGCACHE_API_TOKEN` remains a compatibility fallback. New examples should
lead with `BORINGCACHE_RESTORE_TOKEN` and `BORINGCACHE_SAVE_TOKEN`.

The action now exposes first-class `metadata-hints` input for proxy-backed
modes. This is the user-facing path for low-cardinality grouping labels such as
`project=web`, `phase=seed`, `tool=bazel`, or `benchmark=grpc-bazel`. Keep
those labels stable and replayable; do not use commit SHAs or run ids there.

Post-save verification must respect the `verify-require-server-signature`
input independently of the action's default strict restore environment. The
action exports `BORINGCACHE_REQUIRE_SERVER_SIGNATURE=1` for normal CLI restore
safety, but unsigned verification explicitly runs `boringcache check` with
`BORINGCACHE_REQUIRE_SERVER_SIGNATURE=0` so existence checks do not become
signed-restore checks by accident.

The action also exposes `trusted-workspace-signing-key-fingerprint` as thin CLI
plumbing. When set, the action exports
`BORINGCACHE_TRUSTED_WORKSPACE_KEY_FINGERPRINT`; the CLI owns verification of
the returned workspace key, signature envelope, and cache-entry metadata.

Archive restores run before mise tool probes and installs. This prevents
language tool discovery from populating cache targets first; for example, Go can
create `GOMODCACHE/golang.org` while resolving `GOTOOLCHAIN` if probed inside a
module after `GOMODCACHE` already points at the archive restore path.

Rust `sccache` proxy preflight must run
`boringcache --require-server-signature check --fail-on-miss`. Without
fail-on-miss, a CLI check that prints a miss but exits successfully can make a
cold seed look like an existing-cache zero-hit regression. Without the explicit
server-signature flag, the health check can drift from the official strict
restore contract.

## Release Alignment

CLI default bumps must keep these files together:

- `action.yml`;
- `lib/utils.ts`;
- restore tests;
- generated `dist/**`;
- `package.json` and `package-lock.json`.

The current release line is action package `1.12.87` with default CLI
`v1.12.66`. Cut action releases by tagging the already-green commit SHA; do
not add a release-only commit after CI/E2E has passed. Move `one@v1` only after
the signed semver tag release succeeds.

## Performance Guardrails

- Prefer one CLI dry-run per logical mode/step.
- Cache a parsed plan inside the step where restore/save halves share it.
- Avoid per-entry CLI subprocesses in archive compatibility mode when a repo
  config exists.
- Keep generated `dist` synchronized with source before release.
- Keep metadata hints bounded and replayable.

## Legacy Cleanup

Do not revive `@boringcache/action-core`.

`setup-boringcache` can remain as compatibility bootstrap copy, but launch docs
should lead with `boringcache/one@v1`.

Delete or archive retired action-core only after a separate migration gate
confirms no release path, docs page, or customer workflow still depends on it.

## Open Work

- Add released action-path evidence for provider metadata reaching Rails
  ordering fields.
- Artifact action ref, CLI version, cache mode, immutable refs, import aliases,
  promotion aliases, promotion status, and `cache_session_summary`.
- Reduce archive compatibility planning subprocess count.
- Move `one@v1` only from signed release commits/tags.
