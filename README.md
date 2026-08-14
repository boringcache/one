# boringcache/one

**One Action for every BoringCache mode.**

`boringcache/one` brings the cache you configured locally into GitHub Actions.
Pick archive, Docker, BuildKit, or a native tool adapter; the Action installs
the CLI, prepares the runner, restores available work, and publishes new cache
from trusted jobs.

## First run

Run `boringcache onboard` in the repository first. Commit `.boringcache.toml`,
then select its archive profile in CI:

```yaml
- uses: boringcache/one@71fdb67f0aa0afc1c4ac616c8c57d0d535f15bd9 # v1.19.2
  with:
    trust-policy: auto
    setup: none
    mode: archive
    cache-profiles: ci
  env:
    BORINGCACHE_RESTORE_TOKEN: ${{ secrets.BORINGCACHE_RESTORE_TOKEN }}
    BORINGCACHE_SAVE_TOKEN: ${{ github.event_name != 'pull_request' && secrets.BORINGCACHE_SAVE_TOKEN || '' }}
```

The same profile works locally with
`boringcache run --profile ci -- COMMAND`. Workspace, paths, and cache names
stay in `.boringcache.toml`, so the workflow only chooses what to run.

`trust-policy: auto` restores on pull requests and publishes only when the job
has `BORINGCACHE_SAVE_TOKEN`. Isolated candidate jobs use
`BORINGCACHE_STAGE_TOKEN`; trusted publishing jobs receive their exact
`cache-candidates` output. Every job that reads cache needs
`BORINGCACHE_RESTORE_TOKEN`.

## Supported modes

The released modes are `archive`, `docker`, `buildkit`, `bazel`, `cargo`,
`ccache`, `go`, `gradle`, `gha`, `maven`, `nix`, `nx`, `sccache`, `turbo`, and
`xcode`. Each non-archive mode matches the CLI command with the same name.

Use `mode: gha` when existing cache-enabled actions should keep their keys,
paths, restore keys, and archive behavior. Use `boringcache onboard` plus an
archive `cache-profiles` setup when you want the same named cache entries in
local builds and other CI systems. BoringCache does not import objects already
stored by GitHub.

## Guides and reference

- [Set up BoringCache in GitHub Actions](https://boringcache.com/docs/github-actions)
- [Choose an adapter](https://boringcache.com/docs/adapters)
- [Check every shipped input and output](action.yml)

## Updates

The examples pin Action `v1.19.2` to its immutable distribution commit. A full commit SHA
is immutable; `v1` and ordinary semver tags are update channels and may move.
Update the SHA deliberately after reviewing a newer release and keep the
version comment for Dependabot and human readers.

The Action package version and installed CLI version are independent. Action
`v1.19.2` installs CLI `v1.19.2` by default; `cli-version` is an explicit
override, not a value inferred from the Action version.
