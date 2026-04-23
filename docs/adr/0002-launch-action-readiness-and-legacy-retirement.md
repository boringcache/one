# ADR 0002: Launch Action Readiness And Legacy Retirement

Status: accepted launch-readiness review
Date: 2026-04-23

## Context

ADR 0001 keeps `boringcache/one` as orchestration around CLI-owned plans. This
review records the launch state after the sweep for legacy helper paths,
contract drift, version alignment, and performance risks.

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
- restore the old Dockerfile-internal helper path;
- route new behavior through retired `@boringcache/action-core`.

## Docker Helper Retirement

The old Dockerfile-internal helper surface stays removed. Launch docs and
action metadata must not expose:

- `docker-internal-cache`;
- `docker-helper-path`;
- helper build args;
- helper outputs;
- generated helper binaries or unmanaged-helper warnings.

If a pre-launch workflow has BoringCache hooks inside its Dockerfile, the
supported migration is to remove them and use `mode: docker` or
`boringcache docker`.

## Contract Alignment

The action should pass all CLI-planned OCI import refs and promotion refs
through to BuildKit/proxy arguments. Metadata hints remain diagnostics; they do
not replace first-class CLI plan fields or Rails ordering fields.

Restore-only PR behavior is expected. Missing PR-scoped Docker refs should
fall back to CLI-planned branch/default/stable imports. The action should not
turn a missing PR cache into branch/default write permission.

`BORINGCACHE_API_TOKEN` remains a compatibility fallback. New examples should
lead with `BORINGCACHE_RESTORE_TOKEN` and `BORINGCACHE_SAVE_TOKEN`.

The action now exposes first-class `metadata-hints` input for proxy-backed
modes. This is the user-facing path for low-cardinality grouping labels such as
`project=web`, `phase=seed`, `tool=bazel`, or `benchmark=grpc-bazel`. Keep
those labels stable and replayable; do not use commit SHAs or run ids there.

## Release Alignment

CLI default bumps must keep these files together:

- `action.yml`;
- `lib/utils.ts`;
- restore tests;
- generated `dist/**`;
- `package.json` and `package-lock.json`.

The current local release-alignment change moves the action package from
`1.12.64` to `1.12.65` and the default CLI from `v1.12.46` to `v1.12.47`.
That is the right shape, but it still needs the usual signed commit/tag and
`one@v1` movement before public docs can treat it as released.

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
