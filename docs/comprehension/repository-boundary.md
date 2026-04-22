# Repository Boundary

`boringcache/one` owns the standalone maintained GitHub Action product surface:

- action inputs, outputs, defaults, and validation;
- mode orchestration for archive, Docker, BuildKit, Bazel, Gradle, Turbo, and Rust sccache flows;
- bundled action helpers under `lib/core`;
- generated `dist` bundles required by GitHub Actions;
- action E2E workflows and release tag movement.

The CLI owns cache protocol behavior, registry proxy semantics, local adapters, CI run-context detection for proxy save requests, and release binaries. The action may derive GitHub provider metadata, seed `BORINGCACHE_CI_*` environment values, and invoke the CLI, but it should not reimplement Rails API policy, Docker ref planning, or proxy protocol rules.

Rails owns workspace, token, storage, publish, restore, session, billing, and API truth. Action changes that need a new API contract should update the web ADR/comprehension path and the CLI request path in the same rollout.

The retired `@boringcache/action-core` package is not part of the maintained action path. Do not add it as a dependency or route new behavior through a separate npm release. New product behavior should land here, in CLI, or in Rails.

ADR note: [docs/adr/0001-cli-plan-owned-action-contract.md](../adr/0001-cli-plan-owned-action-contract.md) is the current launch-readiness boundary. It keeps `.boringcache.toml`, Docker ref derivation, and adapter planning owned by the CLI, with the action acting as GitHub Actions orchestration around CLI dry-run JSON.

Docker and BuildKit registry modes must consume the complete CLI-planned OCI import list. If the CLI dry-run returns multiple `oci_cache.cache_from_refs` such as PR, branch, default, and stable fallback refs, the action should pass each one as its own `--cache-from` or `--import-cache` flag instead of rebuilding or narrowing that list.

Docker and BuildKit registry modes must also forward CLI-planned `oci_cache.promotion_ref_tags` to `cache-registry` as real `--oci-alias-promotion-ref` arguments. The `docker_alias_promotion_refs` metadata hint is diagnostic only; it does not cause the proxy to bind branch, PR, default, or stable OCI aliases after an immutable run-ref export.

Pull request runs are restore-only by default. A PR-scoped Docker or BuildKit ref such as `/cache:pr-3208` may legitimately be missing, because the action does not publish it unless `save-on-pull-request` is explicitly enabled. That miss should be handled by the CLI-planned branch/default/stable fallback imports. If PR saving is enabled, the normal derived promotion target is the PR alias; the action should not turn a missing PR alias into branch/default write permission.

The old Dockerfile-internal helper surface is removed before launch. The action should not reintroduce `docker-internal-cache`, `docker-helper-path`, helper build args, helper outputs, or helper-writing code as a documented or discoverable product path. Docker support should stay on the outer BuildKit registry-cache path through CLI-planned `--cache-from` and `--cache-to` refs.

Benchmark evidence for launch copy should come from action artifacts that name the action ref, CLI version/ref, cache mode, immutable run refs, alias promotion status, and `cache_session_summary` diagnostics.

Release alignment note: `boringcache/one` `v1.12.62` updates the default CLI install version to `v1.12.44` so `one@v1` can exercise the receipt-strict publish, live session-summary, and provider-neutral CI ordering fixes released in the CLI. Keep `action.yml`, `lib/utils.ts`, restore tests, generated `dist/**`, and package version changes together for future CLI default bumps.
