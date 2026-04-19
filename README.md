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

Most Docker workflows only need the registry layer cache outputs. The helper options below are for advanced Dockerfiles that already bind-mount a `boringcache` helper inside `RUN` steps.

Keep that helper stable unless you deliberately want the helper binary to be part of the Docker cache key:

```yaml
- uses: boringcache/one@v1
  id: bc
  with:
    mode: docker
    workspace: my-org/my-project
    docker-command: setup
    docker-internal-cache: off
    docker-helper-path: boringcache-bin
  env:
    BORINGCACHE_RESTORE_TOKEN: ${{ secrets.BORINGCACHE_RESTORE_TOKEN }}
    BORINGCACHE_SAVE_TOKEN: ${{ secrets.BORINGCACHE_SAVE_TOKEN }}

- run: |
    docker buildx build \
      --builder "${{ steps.bc.outputs.buildx-name }}" \
      --cache-from "${{ steps.bc.outputs.cache-from }}" \
      --cache-to "${{ steps.bc.outputs.cache-to }}" \
      --build-arg BORINGCACHE_INTERNAL_RESTORE_ENABLED="${{ steps.bc.outputs.docker-internal-restore-enabled }}" \
      --build-arg BORINGCACHE_INTERNAL_SAVE_ENABLED="${{ steps.bc.outputs.docker-internal-save-enabled }}" \
      .
```

`docker-internal-cache: off` is the registry-layer path: `one` disables Dockerfile-internal BoringCache calls and, when `docker-helper-path` is set, writes a stable no-op executable under the Docker context for bind mounts such as `RUN --mount=type=bind,source=boringcache-bin,target=/usr/local/bin/boringcache`. Set `docker-internal-cache: on` only when you intentionally want the real CLI inside the Dockerfile; that makes a CLI binary release a Docker graph input, so the first same-branch run after the binary changes is a reseed. BoringCache maintainers use separate benchmark-only `cli_ref` diagnostics for registry-proxy development; application workflows should use released action and CLI versions.

## What it handles

- archive caching for repeated directories
- `mise`-based tool setup by default
- Docker and BuildKit cache flows
- Bazel, Gradle, Maven, Turbo, and Rust plus `sccache` proxy-backed modes
- repo-config-driven cache profiles after `boringcache onboard`

## Maintainer model

`boringcache/one` owns its GitHub Actions support code directly under `lib/core/`. That code used to ship as the separate `@boringcache/action-core` npm package; keeping it in this repository makes a release of `one` self-contained and avoids a second package version becoming part of the product action's behavior.

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
- `entries` add archive caches, including optional hybrid local-state caches alongside remote modes
- `cache-profiles` resolve repo-defined cache groups from `.boringcache.toml`
- `preset` is for archive-oriented defaults plus tool detection
- `mode` selects the primary adapter when you need Docker or a native remote-cache flow; proxy/build modes stay pure remote unless you also set `entries`
- `setup` defaults to `mise`
- `verify` defaults to `wait` with a 180s timeout so tag visibility is checked automatically after restore/save

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
