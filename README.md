# boringcache/one

`boringcache/one` is the maintained GitHub Action entrypoint for BoringCache.
It installs the BoringCache CLI, restores and saves archive entries, and sets up
supported cache modes such as Docker, BuildKit, Bazel, Go, Gradle, Maven,
Turbo, Nx, and Rust `sccache`.

## Quick start

```yaml
- uses: boringcache/one@v1
  with:
    workspace: my-org/my-project
    entries: deps:node_modules,build:dist
  env:
    BORINGCACHE_RESTORE_TOKEN: ${{ secrets.BORINGCACHE_RESTORE_TOKEN }}
    BORINGCACHE_SAVE_TOKEN: ${{ secrets.BORINGCACHE_SAVE_TOKEN }}
```

Docker mode:

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

## Inputs

The shipped input and output contract is in [`action.yml`](action.yml).

## Updates

Use the latest `v1` tag for the current stable action. Pin a full semver tag
when a workflow needs an immutable action version.
