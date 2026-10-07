<picture>
  <source media="(prefers-color-scheme: dark)" srcset=".github/images/boringcache-dark.svg">
  <img src=".github/images/boringcache-light.svg" width="240" alt="BoringCache">
</picture>

# BoringCache for GitHub Actions

Share build cache and immutable build outputs between GitHub Actions, local
development, and other CI systems.

`boringcache/one` connects your workflow to BoringCache so compatible builds can
reuse dependency downloads, compiler results, task outputs, and Docker layers.
The Action installs the CLI, restores available cache, and publishes from
trusted jobs using the same `.boringcache.toml` configuration as local builds.
Use it on GitHub-hosted or self-hosted runners after checkout and toolchain setup.

## What you can reuse and keep

| Your build needs | What BoringCache provides |
|---|---|
| Dependency downloads and directory caches | Restore and save the directories selected by an archive profile. |
| Compiler and task results | Connect supported tools such as Cargo, sccache, Bazel, Gradle, Nx, and Turborepo to shared cache. Your build tools decide which results can be reused. |
| Docker builds | Reuse layers, with optional package and compiler caches for instructions that need to run again. |
| Binaries, reports, and release packages | Upload immutable Artifacts, choose retention, and pass an exact Artifact ID to another job or download it with the CLI. |

Matching cache content is stored once within a workspace. Related builds can
reuse data already uploaded instead of transferring and storing another full
copy. A replacement runner or another CI system can retrieve cache from the
same workspace.

See [recorded builds](https://boringcache.com/demo) for cache hits, misses, and
transfers, and [benchmarks](https://boringcache.com/benchmarks) for measured build
times and storage comparisons.

BoringCache also includes a [private container Registry](https://boringcache.com/registry)
for images you push and pull with Docker or an OCI client. Cache, Artifacts, and
Registry include managed storage; see [plans and allowances](https://boringcache.com/pricing).

## First run

Run `boringcache onboard` in the repository first, commit `.boringcache.toml`,
and approve the repository-to-Workspace binding once through **Connect CI**.
On a standard GitHub-hosted runner, grant the job OIDC permission and select the
profile. The Action starts and renews the short-lived Machine connection for the
job, so the workflow does not need a BoringCache token:

```yaml
permissions:
  contents: read
  id-token: write

steps:
  - uses: boringcache/one@43cf123ff3236d37e070ee79610189714f2c2c2d # v1.40.1
    with:
      trust-policy: auto
      mode: archive
      cache-profiles: ci
```

The signed job identity and Workspace policy decide whether that job can
publish. Pull requests remain restore-only; trusted branch and tag jobs may
publish when Workspace policy permits it. On BoringBuild, the same Action step
uses the runner-provided Machine connection instead; that connection takes
precedence and does not require a BoringCache token.

If workload identity is unavailable, configure explicitly scoped credentials:

```yaml
- uses: boringcache/one@43cf123ff3236d37e070ee79610189714f2c2c2d # v1.40.1
  with:
    trust-policy: auto
    mode: archive
    cache-profiles: ci
  env:
    BORINGCACHE_RESTORE_TOKEN: ${{ secrets.BORINGCACHE_RESTORE_TOKEN }}
    BORINGCACHE_SAVE_TOKEN: ${{ github.event_name != 'pull_request' && secrets.BORINGCACHE_SAVE_TOKEN || '' }}
```

The same profile works locally with
`boringcache run --profile ci -- COMMAND`. Workspace, paths, and cache names
stay in `.boringcache.toml`, so the workflow only chooses what to run.

With scoped credentials, `trust-policy: auto` restores on pull requests and
publishes only when the job has `BORINGCACHE_SAVE_TOKEN`. Isolated archive
candidate jobs use `BORINGCACHE_STAGE_TOKEN` and expose their exact
`cache-candidates` output. Every job on that path that reads cache needs
`BORINGCACHE_RESTORE_TOKEN`.

## Supported modes

The `mode` input in [action.yml](action.yml) lists the modes supported by this
version. Choose a CLI and Action release that both include your mode. Each
adapter mode matches the CLI command with the same name and reads its cache
tag from `[adapters.<mode>]` in `.boringcache.toml`; the Action has no tag input.
See the [adapter guides](https://boringcache.com/docs/adapters) for tool setup
and requirements.

A Cargo plan that commits `[adapters.cargo].command` runs it in one Action step.
A plan without one restores in the Action step and publishes in the post step,
so one step covers every Cargo command in the job. A failed step skips the post step and
publishes nothing. `save-always: true` publishes the state the job reached,
including after a failed Cargo build; Cargo's own fingerprints decide what a
later run rebuilds.

Docker and BuildKit modes invoke the command committed under the matching
adapter in `.boringcache.toml`. Buildx, buildctl, builder, image, and cache-ref
configuration stay in the CLI plan. Use `boringcache docker -- ...` or
`boringcache buildkit -- ...` directly when the command varies per workflow.

`mode: gha` exposes BoringCache's Actions-compatible service, but transparent
provider-action routing requires a CI runner integration that installs that
service before the job without changing existing cache or artifact action
steps. A `mode: gha` setup step on a standard GitHub-hosted runner does not
redirect later provider actions; they remain GitHub-backed. Use
`boringcache onboard` plus an archive `cache-profiles` setup, or the native
`boringcache artifact` commands, when BoringCache must own those bytes on a
standard GitHub-hosted runner. BoringCache does not import objects already
stored by GitHub.

Use `mode: artifact` with `artifact-command: push` or `pull` to transfer
immutable build outputs. See [Artifacts](https://boringcache.com/docs/artifacts)
for upload and download examples.

## Guides and reference

- [Set up BoringCache in GitHub Actions](https://boringcache.com/docs/github-actions)
- [Choose an adapter](https://boringcache.com/docs/adapters)
- [Check every shipped input and output](action.yml)
- [Review release history](CHANGELOG.md)

## Updates

The examples pin the current verified Action to its immutable distribution
commit. A full commit SHA is immutable; `v1` follows the latest verified
release. Update the SHA deliberately after reviewing a newer release and keep
the version comment for Dependabot and human readers.

The Action package version and installed CLI version are independent. Action
metadata declares the default CLI; `cli-version` is an explicit override, not
a value inferred from the Action version.
