# boringcache/one

`boringcache/one` is GitHub lifecycle for the same CLI-owned BoringCache plan
used locally and on any runner. It installs the CLI, restores and saves named
archive profiles, and orchestrates Docker, BuildKit, Bazel, Cargo, Go, Gradle,
Maven, Turbo, Nx, C/C++ `ccache`, Rust `sccache`, and Xcode compilation-cache
modes without inventing a second cache interface.

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
- uses: boringcache/one@09e053620cda4d3472f26a3ddd181144a108e2c2 # v1.16.8
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

Archive handling is built into the CLI on every supported platform. BoringCache
verifies archives before restore and preserves modification times needed for
build freshness; no system tar installation is required. See
[archive mode](https://boringcache.com/docs#cli-run) for the customer-facing
ownership contract.

### Cargo mode

The reviewed `v1.16.8` Action runs one complete repo-owned Cargo command inside
the CLI's target,
dependency, and sccache lifecycle. It provisions the audited sccache version
before execution. Keep the command beside the cache plan:

```toml
[adapters.cargo]
tag = "rust-compiler"
profiles = ["cargo"]
command = ["cargo", "build", "--release"]
```

Select `mode: cargo` in one Action step with the reviewed `v1.16.8`
distribution SHA used by the examples in this README. The Action invokes
`boringcache cargo` synchronously; it does not reconstruct target restore,
source-freshness, compiler-cache, or save policy in workflow YAML.

Repeated Cargo Action uses preserve populated local Cargo state and let the CLI
decide restore and save reuse. Multi-phase jobs that would mutate and publish
the target after every phase should use one combined Cargo invocation or the
job-wide `sccache` mode described in the Cargo mode guide.

`save-always: true` cannot publish an incomplete Cargo target when the embedded
command fails; Cargo publication happens synchronously only after success.

Docker mode:

```yaml
- uses: boringcache/one@09e053620cda4d3472f26a3ddd181144a108e2c2 # v1.16.8
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

Managed BuildKit setup needs host-level container privileges. It runs normally
on GitHub-hosted runners. On a self-hosted runner, the Action fails closed
unless `BORINGCACHE_EPHEMERAL_PRIVILEGED_RUNNER=1` is set; use that attestation
only for a single-tenant runner that is destroyed after the job.

Xcode mode on any macOS runner:

```yaml
- uses: boringcache/one@09e053620cda4d3472f26a3ddd181144a108e2c2 # v1.16.8
  with:
    trust-policy: auto
    setup: none
    mode: xcode
  env:
    BORINGCACHE_RESTORE_TOKEN: ${{ secrets.BORINGCACHE_RESTORE_TOKEN }}
    BORINGCACHE_SAVE_TOKEN: ${{ github.event_name != 'pull_request' && secrets.BORINGCACHE_SAVE_TOKEN || '' }}

- run: >-
    xcodebuild -workspace App.xcworkspace -scheme App
    -derivedDataPath "$BORINGCACHE_XCODE_DERIVED_DATA_PATH" build
```

The Action installs the checksum-verified universal CAS adapter covered by the
release's Sigstore bundle, starts the credential-free local bridge, and exports
Xcode's cache settings. See
[the Xcode guide](https://github.com/boringcache/cli/blob/main/docs/tool-guides.md#xcode)
for path-cohort semantics and setup.

## Inputs

Start with the [GitHub Actions guide](https://boringcache.com/docs#action). The
exact shipped input and output reference is [`action.yml`](action.yml); the
grouped inventory is contract-checked against it.

## Updates

The examples pin the reviewed `v1.16.8` distribution commit. A full commit SHA
is immutable; `v1` and ordinary semver tags are update channels and may move.
Update the SHA deliberately after reviewing a newer release and keep the
version comment for Dependabot and human readers.

The Action package version and installed CLI version are independent. This
reviewed Action installs CLI `v1.16.5` by default; `cli-version` is an explicit
override, not a value inferred from the Action version.
