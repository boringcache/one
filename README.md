<picture>
  <source media="(prefers-color-scheme: dark)" srcset=".github/images/boringcache-dark.svg">
  <img src=".github/images/boringcache-light.svg" width="240" alt="BoringCache">
</picture>

# BoringCache for GitHub Actions

One Action for shared build cache across Docker builds and native build tools.

Uses the same BoringCache plan as your local builds.

`boringcache/one` brings BoringCache into GitHub Actions. Pick archive, Docker,
BuildKit, or a native tool adapter; the Action installs the CLI, prepares the
runner, restores available work, and publishes from trusted jobs.

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
  - uses: boringcache/one@f0fb9b2d926a32b10c543e92093ba00c5a291b79 # v1.33.0
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

If workload identity is unavailable, use explicitly scoped credentials as a
fallback:

```yaml
- uses: boringcache/one@f0fb9b2d926a32b10c543e92093ba00c5a291b79 # v1.33.0
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

The released modes are `archive`, `artifact`, `docker`, `buildkit`, `bazel`, `cargo`,
`ccache`, `go`, `gradle`, `gha`, `maven`, `nix`, `nx`, `sccache`, `turbo`, and
`xcode`. Each non-archive mode matches the CLI command with the same name.

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
