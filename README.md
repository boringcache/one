# boringcache/one

`boringcache/one` is the maintained GitHub Action entrypoint for BoringCache.
It installs the BoringCache CLI, restores and saves archive entries, and sets up
supported cache modes such as Docker, BuildKit, Bazel, Go, Gradle, Maven,
Turbo, Nx, and Rust `sccache`.

## Quick start

```yaml
- uses: boringcache/one@58df2c0d6884ecd5e430feeeaf7e477656864771 # v1.13.102
  with:
    workspace: my-org/my-project
    entries: |
      deps:node_modules
      build:dist
  env:
    BORINGCACHE_RESTORE_TOKEN: ${{ secrets.BORINGCACHE_RESTORE_TOKEN }}
    BORINGCACHE_SAVE_TOKEN: ${{ github.event_name != 'pull_request' && secrets.BORINGCACHE_SAVE_TOKEN || '' }}
```

Archive entries are opaque tar round trips. GNU tar creates a canonical stream
whose SHA-256 is the cache identity; zstd is only its transport encoding. On
restore, BoringCache verifies the decoded tar and invokes GNU tar or
libarchive/bsdtar for safe-root extraction. Tar owns member types, modes, links,
and sparse representation; BoringCache does not verify files a second time. See
[archive entries and cache inputs](docs/cache-inputs.md) for exclusions and
platform scoping.

Docker mode:

```yaml
- uses: boringcache/one@58df2c0d6884ecd5e430feeeaf7e477656864771 # v1.13.102
  with:
    mode: docker
    workspace: my-org/my-project
    image: ghcr.io/${{ github.repository }}
    tags: latest,${{ github.sha }}
  env:
    BORINGCACHE_RESTORE_TOKEN: ${{ secrets.BORINGCACHE_RESTORE_TOKEN }}
    BORINGCACHE_SAVE_TOKEN: ${{ github.event_name != 'pull_request' && secrets.BORINGCACHE_SAVE_TOKEN || '' }}
```

Managed BuildKit and multi-platform QEMU setup need host-level container
privileges. They run normally on GitHub-hosted runners. On a self-hosted runner,
the Action fails closed unless `BORINGCACHE_EPHEMERAL_PRIVILEGED_RUNNER=1` is
set; use that attestation only for a single-tenant runner that is destroyed
after the job.

## Inputs

The shipped input and output contract is in [`action.yml`](action.yml).

## Updates

The examples pin the reviewed `v1.13.102` distribution commit. A full commit SHA
is immutable; `v1` and ordinary semver tags are update channels and may move.
Update the SHA deliberately after reviewing a newer release and keep the
version comment for Dependabot and human readers.
