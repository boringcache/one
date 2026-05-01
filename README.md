# boringcache/one

`boringcache/one` is the main GitHub Actions entrypoint for BoringCache.

If you are starting fresh, the preferred path is:

1. install the CLI locally
2. run `boringcache onboard`
3. commit `.boringcache.toml` when it helps
4. use `boringcache/one@v1` in GitHub Actions

That keeps local runs, Docker builds, and GitHub Actions on the same workspace, cache names, and trust model.

If you are migrating an existing workflow and do not want repo config yet, raw `entries` plus `actions/cache` compatibility inputs such as `path`, `key`, and `restore-keys` still work.

## Quick start

```yaml
- uses: boringcache/one@v1
  with:
    workspace: my-org/my-project
    cache-profiles: bundle-install
  env:
    BORINGCACHE_RESTORE_TOKEN: ${{ secrets.BORINGCACHE_RESTORE_TOKEN }}
    BORINGCACHE_SAVE_TOKEN: ${{ secrets.BORINGCACHE_SAVE_TOKEN }}
```

If you do not have repo config yet, start with explicit entries:

```yaml
- uses: boringcache/one@v1
  with:
    workspace: my-org/my-project
    entries: bundler:vendor/bundle,node:node_modules
  env:
    BORINGCACHE_RESTORE_TOKEN: ${{ secrets.BORINGCACHE_RESTORE_TOKEN }}
    BORINGCACHE_SAVE_TOKEN: ${{ secrets.BORINGCACHE_SAVE_TOKEN }}
```

For Docker or native remote-cache flows, set the mode you need and keep the same workspace:

```yaml
- uses: boringcache/one@v1
  with:
    mode: docker
    workspace: my-org/my-project
    image: ghcr.io/${{ github.repository }}
    tags: latest,${{ github.sha }}
  env:
    BORINGCACHE_RESTORE_TOKEN: ${{ secrets.BORINGCACHE_RESTORE_TOKEN }}
    BORINGCACHE_SAVE_TOKEN: ${{ secrets.BORINGCACHE_SAVE_TOKEN }}
```

If you want dashboard sessions and misses grouped by an explicit low-cardinality label, pass `metadata-hints` on the action itself:

```yaml
- uses: boringcache/one@v1
  with:
    mode: bazel
    workspace: my-org/my-project
    cache-tag: bazel-main
    metadata-hints: |
      tool=bazel
      phase=ci
  env:
    BORINGCACHE_RESTORE_TOKEN: ${{ secrets.BORINGCACHE_RESTORE_TOKEN }}
    BORINGCACHE_SAVE_TOKEN: ${{ secrets.BORINGCACHE_SAVE_TOKEN }}
```

Use short stable labels such as `project=web`, `phase=seed`, `phase=warm`, `tool=gradle`, or `benchmark=grpc-bazel`. These hints are replayable proxy arguments, so keep them low-cardinality and avoid commit SHAs, run ids, or other per-run values.

If the repo already defines shared proxy labels in `.boringcache.toml`, `boringcache/one` inherits them through the CLI dry-run plan. Prefer repo config for durable defaults and use the action-level `metadata-hints` input only when a workflow needs an explicit override.

Docker workflows should use `mode: docker` or `mode: buildkit`. The action follows the CLI dry-run plan and passes BuildKit registry cache refs to the build.

For Docker and BuildKit registry caches, the action follows the CLI's ref plan.
Pull request runs are restore-only by default, so a PR-scoped ref such as `/cache:pr-3208` may legitimately 404, especially on the first PR run.
That miss should not make the build cold: the action also forwards the base/default and stable fallback imports, ending with the default `/cache:buildcache` ref.
If a repo deliberately wants PR-scoped Docker cache writes, provide a save-capable token and set `save-on-pull-request: true`; the default derived promotion for a PR is the PR alias, while branch and default aliases remain trusted-branch outputs.

Archive caches use the same trust model through the CLI. Default-branch runs
read/write the default tag, trusted branch runs read branch then default and
write branch, PRs read base/default and save nothing by default, and
`save-on-pull-request: true` makes the PR read/write target isolated to that PR:
the action exports `BORINGCACHE_SAVE_ON_PULL_REQUEST=1` for its post-save phase
and sets `BORINGCACHE_RESTORE_PR_CACHE=1` for CLI restore subprocesses.
If you build explicit tags from refs, slug branch names before passing them to
the action; explicit tags are not silently rewritten.

For Docker and BuildKit setup flows, `boringcache/one` now treats proxy readiness and OCI import readability as one contract.
The setup step waits for the started proxy to be reachable, probes each CLI-planned import ref through the proxy, and exposes both the requested and actually usable import refs.
If some planned refs are unreadable, the action keeps the build path fail-safe:

- `cache-from` / `cache-to` stay the action-owned source of truth for the actual build command.
- `docker-cache-from-refs` reports the readable refs that were actually used.
- `docker-cache-requested-from-refs` reports the full CLI-planned ref set.
- `docker-cache-unreadable-from-refs` reports the refs that were planned but not readable through the started proxy.
- `docker-cache-import-ready` is `true` only when every planned import ref was readable.

If none of the planned refs are readable, the action treats that as a cold seed
and continues without registry imports. If only some refs are readable, it keeps
a warning because the fallback set is degraded.

Workflow authors should consume those outputs instead of polling `/_boringcache/status` or probing `/v2/cache/manifests/*` themselves.

## What it handles

- archive caching for repeated directories
- `mise`-based tool setup by default
- Docker and BuildKit cache flows
- Bazel, Go, Gradle, Maven, Turbo, and Rust plus `sccache` proxy-backed modes
- repo-config-driven cache profiles after `boringcache onboard`

## Maintainer model

`boringcache/one` owns its GitHub Actions support code directly under `lib/core/`. Releases are self-contained: this action does not depend on the retired `@boringcache/action-core` npm package, and maintained behavior should not be split across a second package version.

## Trust model

- every job that should read cache gets `BORINGCACHE_RESTORE_TOKEN`
- only trusted jobs get `BORINGCACHE_SAVE_TOKEN`
- `pull_request` jobs stay restore-only by default; set `save-on-pull-request: true` only when the write scope is intentionally isolated
- missing PR-scoped Docker refs on restore-only PRs are expected cache misses, not a reason to grant write access by themselves
- new workflows should avoid broad `BORINGCACHE_API_TOKEN` use in CI

For bootstrap or setup-only steps that should never publish cache, set:

```yaml
- uses: boringcache/one@v1
  with:
    save-policy: off
```

That keeps the step restore-only by configuration instead of emitting missing-save-token noise in the post step.

## Mental model

- `workspace` is the shared cache boundary
- `entries` add archive caches, including optional hybrid local-state caches alongside remote modes
- `cache-profiles` resolve repo-defined cache groups from `.boringcache.toml`
- `preset` is for archive-oriented defaults plus tool detection
- `mode` selects the primary adapter when you need Docker or a native remote-cache flow; proxy/build modes stay pure remote unless you also set `entries`
- `setup` defaults to `mise`
- `verify` defaults to `none`; set `check` for one-shot tag checks or `wait`/`warn` when you explicitly want polling

In most workflows, set `workspace` and then one of:

- `cache-profiles`
- `entries`
- `preset`
- a mode-specific input such as `image`

`action.yml` is the source of truth for the full input and output surface.

## Learn more

- [GitHub Actions docs](https://boringcache.com/docs#one-action)
- [GitHub Actions auth and trust model](https://boringcache.com/docs#actions-auth)
- [CLI docs](https://github.com/boringcache/cli/tree/main/docs)
