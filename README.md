# boringcache/one

`boringcache/one` is the maintained GitHub Action entrypoint for BoringCache.
It installs the BoringCache CLI, restores and saves archive entries, and sets up
supported cache modes such as Docker, BuildKit, Bazel, Go, Gradle, Maven,
Turbo, Nx, and Rust `sccache`.

## Quick start

```yaml
- uses: boringcache/one@b55458ec8a4165e3fd70b1a1645f518a2095ed02 # v1.13.99
  with:
    workspace: my-org/my-project
    entries: |
      deps:node_modules
      build:dist
  env:
    BORINGCACHE_RESTORE_TOKEN: ${{ secrets.BORINGCACHE_RESTORE_TOKEN }}
    BORINGCACHE_SAVE_TOKEN: ${{ github.event_name != 'pull_request' && secrets.BORINGCACHE_SAVE_TOKEN || '' }}
```

Archive entries preserve regular files, directories, symlinks, hard links, and
sparse files. Unsupported kernel objects or destination names and metadata that
cannot be represented safely fail explicitly rather than being silently
dropped. See [archive entries and cache inputs](docs/cache-inputs.md) for
literal exclusions, cross-OS archives, and external-symlink policy.

Docker mode:

```yaml
- uses: boringcache/one@b55458ec8a4165e3fd70b1a1645f518a2095ed02 # v1.13.99
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

The examples pin the reviewed `v1.13.99` distribution commit. A full commit SHA
is immutable; `v1` and ordinary semver tags are update channels and may move.
Update the SHA deliberately after reviewing a newer release and keep the
version comment for Dependabot and human readers.
