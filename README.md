# boringcache/one

`boringcache/one` is GitHub lifecycle for the same CLI-owned BoringCache plan
used locally and on any runner. It installs the CLI, restores and saves named
archive profiles, and orchestrates Docker, BuildKit, Bazel, Go, Gradle, Maven,
Turbo, Nx, C/C++ `ccache`, Rust `sccache`, and Xcode compilation-cache modes
without inventing a second cache interface.

## Quick start

Run `boringcache onboard` in the repository first. It writes the shared cache
plan that local builds, any CI runner, Docker, and this Action reuse:

```toml
workspace = "my-org/my-project"

[entries.dependencies]
tag = "dependencies"
path = "node_modules"

[profiles.ci]
entries = ["dependencies"]
```

Commit `.boringcache.toml`, then refer to the same profile in CI:

```yaml
- uses: boringcache/one@6b7033721b37075b2138fd0c769bf088e0836ce6 # v1.14.0
  with:
    trust-policy: auto
    setup: none
    mode: archive
    cache-profiles: ci
  env:
    BORINGCACHE_RESTORE_TOKEN: ${{ secrets.BORINGCACHE_RESTORE_TOKEN }}
    BORINGCACHE_SAVE_TOKEN: ${{ github.event_name != 'pull_request' && secrets.BORINGCACHE_SAVE_TOKEN || '' }}
```

The matching local command is `boringcache run --profile ci -- npm ci`. The
Action accepts only the profile selector; workspace, entries, tags, paths,
exclusions, and scope stay in the committed plan.

`trust-policy` is the one lifecycle control. `auto` restores on pull requests
and publishes from trusted jobs when `BORINGCACHE_SAVE_TOKEN` is available.
An isolated trusted candidate job uses `trust-policy: stage` with
`BORINGCACHE_STAGE_TOKEN`; a later trusted Docker or BuildKit build imports its
exact `cache-candidates` output without adding another export.

Archive entries are opaque tar round trips. GNU tar creates a canonical stream
whose SHA-256 is the cache identity; zstd is only its transport encoding. On
restore, BoringCache verifies the decoded tar and invokes GNU tar or
libarchive/bsdtar for safe-root extraction. Tar owns member types, modes, links,
and sparse representation; BoringCache does not verify files a second time. See
[archive profiles](docs/cache-inputs.md) for the exact ownership contract.

Docker mode:

```yaml
- uses: boringcache/one@6b7033721b37075b2138fd0c769bf088e0836ce6 # v1.14.0
  with:
    trust-policy: auto
    setup: none
    mode: docker
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

Xcode mode on any macOS runner:

```yaml
- uses: boringcache/one@6b7033721b37075b2138fd0c769bf088e0836ce6 # v1.14.0
  with:
    trust-policy: auto
    setup: none
    mode: xcode

- run: >-
    xcodebuild -workspace App.xcworkspace -scheme App
    -derivedDataPath "$BORINGCACHE_XCODE_DERIVED_DATA_PATH" build
```

The Action installs the signed, checksummed universal CAS adapter, starts the
credential-free local bridge, and exports Xcode's cache settings. See
[Xcode mode](docs/modes/xcode.md) for path-cohort semantics and evidence.

## Inputs

Start with the [interface ownership guide](docs/interface.md). The exact
shipped input and output reference is [`action.yml`](action.yml); the grouped
inventory is contract-checked against it.

## Updates

The examples pin the reviewed `v1.14.0` distribution commit. A full commit SHA
is immutable; `v1` and ordinary semver tags are update channels and may move.
Update the SHA deliberately after reviewing a newer release and keep the
version comment for Dependabot and human readers.
