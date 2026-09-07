# boringcache/one

**One Action for every BoringCache mode.**

`boringcache/one` brings BoringCache into GitHub Actions. Pick archive, Docker,
BuildKit, or a native tool adapter; the Action installs the CLI, prepares the
runner, restores available work, and publishes from trusted jobs.

## First run

Run `boringcache onboard` in the repository first. Commit `.boringcache.toml`,
then select its archive profile in CI. On BoringBuild or another
runner-integrated service, connect the runner to the Workspace once. The Action
uses that short-lived Machine connection automatically, so the workflow does
not need a BoringCache token:

```yaml
- uses: boringcache/one@dd0c732a76a5c8d70090a259c1255823acaf85b8 # v1.20.3
  with:
    trust-policy: auto
    mode: archive
    cache-profiles: ci
```

The signed job identity and Workspace policy decide whether that job can
publish. An approved same-repository collaborator job may publish; a fork or
other untrusted job remains restore-only.

On a standard GitHub-hosted runner, either use the native OIDC flow from the
[GitHub Actions guide](https://boringcache.com/docs/github-actions) or add
explicitly scoped credentials to the Action step:

```yaml
- uses: boringcache/one@dd0c732a76a5c8d70090a259c1255823acaf85b8 # v1.20.3
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

The released modes are `archive`, `docker`, `buildkit`, `bazel`, `cargo`,
`ccache`, `go`, `gradle`, `gha`, `maven`, `nix`, `nx`, `sccache`, `turbo`, and
`xcode`. Each non-archive mode matches the CLI command with the same name.

Cargo publishes target state only after the configured command succeeds. A
failed Cargo build never publishes incomplete target state.

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

## Guides and reference

- [Set up BoringCache in GitHub Actions](https://boringcache.com/docs/github-actions)
- [Choose an adapter](https://boringcache.com/docs/adapters)
- [Check every shipped input and output](action.yml)
- [Review release history](CHANGELOG.md)

## Updates

The examples pin Action `v1.20.3` to its immutable distribution commit. A full commit SHA
is immutable; `v1` and ordinary semver tags are update channels and may move.
Update the SHA deliberately after reviewing a newer release and keep the
version comment for Dependabot and human readers.

The Action package version and installed CLI version are independent. Action
`v1.20.3` installs CLI `v1.20.5` by default; `cli-version` is an explicit
override, not a value inferred from the Action version.
