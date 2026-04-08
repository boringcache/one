# boringcache/one

`boringcache/one` is the main GitHub Actions entrypoint for BoringCache.

If you are starting fresh, the preferred path is:

1. install the CLI locally
2. run `boringcache onboard`
3. commit `.boringcache.toml` when it helps
4. use `boringcache/one@v1` in GitHub Actions

That keeps local runs, Dockerfiles, and GitHub Actions on the same workspace, cache names, and trust model.

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

## What it handles

- archive caching for repeated directories
- `mise`-based tool setup by default
- Docker and BuildKit cache flows
- Bazel, Gradle, Maven, Turbo, and Rust plus `sccache` proxy-backed modes
- repo-config-driven cache profiles after `boringcache onboard`

## Trust model

- every job that should read cache gets `BORINGCACHE_RESTORE_TOKEN`
- only trusted jobs get `BORINGCACHE_SAVE_TOKEN`
- `pull_request` jobs stay restore-only by default; set `save-on-pull-request: true` only when the write scope is intentionally isolated
- pull requests can stay restore-only
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
- `entries` add archive caches
- `cache-profiles` resolve repo-defined cache groups from `.boringcache.toml`
- `mode` selects the primary adapter when you need Docker or a native remote-cache flow
- `setup` defaults to `mise`
- `verify` defaults to `wait` with a 180s timeout so tag visibility is checked automatically after restore/save

In most workflows, set `workspace` and then one of:

- `cache-profiles`
- `entries`
- `preset`
- a mode-specific input such as `image`

`action.yml` is the source of truth for the full input and output surface.

## Learn more

- [GitHub Actions docs](https://boringcache.com/docs#github-actions)
- [GitHub Actions auth and trust model](https://boringcache.com/docs#actions-auth)
- [CLI docs](https://github.com/boringcache/cli/tree/main/docs)
