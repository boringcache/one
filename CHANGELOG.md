# Changelog

All notable changes to BoringCache One are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]


## [1.32.0] - 2026-09-22

### Changed

- Install BoringCache CLI `v1.32.0` by default.

### Fixed

- Use the approved Machine connection workspace through CLI plans for archive and adapter modes. Reject older brokered plans that still select a repository workspace; static credentials retain repository configuration.

## [1.31.0] - 2026-09-18

### Added

- `cli-version: runner` installs whichever BoringCache CLI the runner image
  preinstalled and fails when it has none. It is for workflows that only run on
  runners that carry the CLI.
- `save` selects the post-step publication policy: `on-success` (default),
  `always`, or `never`. `save-always: true` remains a supported alias for
  `always`; when both are set the stricter one wins.
- `mode: cargo` reports each phase separately through new outputs:
  `restore-duration-seconds`, `restore-transferred-bytes`,
  `publish-duration-seconds`,
  `publish-transferred-bytes`, `publish-logical-bytes`, and
  `snapshot-duration-seconds`. A slow step is now attributable without reading
  timestamps. A CLI that predates the accounting leaves them unset.
- Export one BoringCache run start timestamp during the main step so CLI
  sessions and the post step share an explicit wall-clock origin. A timestamp
  already supplied by the workflow remains unchanged.

### Changed

- Download stable CLI binaries, checksums, and the Xcode companion from
  `artifacts.boringcache.com` first, with the exact GitHub release as a
  same-version fallback.
- Look in the runner's own tool cache before making any network call, and
  verify a hit against the `boringcache.sha256` digest the image recorded
  beside the binary instead of downloading `SHA256SUMS` again. An image with no
  sidecar is verified against `SHA256SUMS` as before.
- Do not save the CLI to the Actions cache after a restore that failed in the
  same job. Reserving a key through a cache service that is already refusing
  calls cannot succeed and hides the original fault.
- Run `mode: cargo` as a job lifecycle when the repo plan commits no
  `[adapters.cargo].command`: the main step restores the Cargo caches and
  exports the CLI-planned environment, the job's own Cargo steps run, and the
  post step publishes. One step then covers every Cargo command in the job. A
  plan that commits a command keeps the released single-step behavior. Requires
  a CLI with `boringcache cargo --phase`.
- `save-always: true` now publishes the Cargo state a job lifecycle reached,
  including after a failed Cargo build. The earlier wrapped-command lifecycle never
  published after its own command failed. Without `save-always`, a failed step
  still skips the post step and publishes nothing.
- Report Cargo compiler-cache results from `sccache --show-stats` in the post
  step, the same source `mode: sccache` uses, instead of a CLI native-tool
  evidence file. `fail-on-cache-error` still fails the post step on sccache read
  errors, timeouts, and writable-mode write errors. It does not cover the
  proxy's own counters, which the post step cannot read.
- Refuse a second `mode: cargo` step in one job. The lifecycle owns a single
  sccache daemon and proxy, so a second step would take over the daemon and
  strand the first step's proxy.
- Install BoringCache CLI `v1.31.0` by default.

### Fixed

- Save the cache after a failed workflow step when `save: always` or
  `save-always` is set. The post condition read an input value that is not
  available to it, so it behaved as if the default `save: on-success` applied
  and published nothing.
- Restore `gradle-home` for Gradle mode and export the effective
  `GRADLE_USER_HOME` so later Gradle steps use the generated init script.
- Finish proxy cleanup in Linux container jobs when the exited proxy remains
  as an unreaped zombie process.
- Verify the installed macOS CLI code signature and apply a local ad hoc
  signature when macOS rejects the release artifact's embedded signature.

## [1.30.4] - 2026-09-11

### Changed

- Install BoringCache CLI `v1.30.4` by default.

## [1.30.3] - 2026-09-10

### Fixed

- Align the Action's BuildKit smoke and end-to-end test defaults with the
  managed `v0.33.0-bc.2` image.

## [1.30.2] - 2026-09-10

### Changed

- Install BoringCache CLI `v1.30.2` by default, including archive download and
  extraction repairs, Cargo target reuse, and the updated managed BuildKit.
- Use the shared BoringCache logo in the README and a layers icon for the
  Action badge. Describe the Action's shared build cache in Marketplace metadata.

### Fixed

- Include bounded, redacted proxy logs when post-save fails and verbose
  diagnostics are enabled.

## [1.30.1] - 2026-09-09

### Added

- Upload and download immutable build outputs with `mode: artifact` and
  `artifact-command: push|pull`. Return artifact IDs and content digests, and
  resolve names only within the exact workflow run and attempt.

### Changed

- Install BoringCache CLI `v1.30.1` by default, including native BuildKit
  configuration and managed-worker CPU controls.
- Report that `mode: gha` configures direct clients and does not redirect
  later official Actions on standard GitHub runners.

## [1.30.0] - 2026-09-09

### Changed

- Install BoringCache CLI `v1.30.0` by default, with managed BuildKit 0.33.0.

## [1.21.0] - 2026-09-08

### Changed

- Install BoringCache CLI `v1.21.0` by default.

### Fixed

- Preserve each archive entry's CLI-planned exclusions during post-step saves.
- Check Cargo target hits using the CLI-resolved archive tag when compiler
  and target caches use different Git or platform scopes.

## [1.20.4] - 2026-09-07

### Added

- Start and renew a Machine connection automatically on GitHub Actions when
  the connected job has `id-token: write` and no explicit scoped credentials.
  Keep ordinary build and test steps, share the session across One steps, and
  close it after post-save.

## [1.20.3] - 2026-09-07

### Changed

- Install BoringCache CLI `v1.20.5` by default.

### Fixed

- Use a runner-provided Machine connection for archive, proxy, and Actions
  cache lifecycles without requiring a static BoringCache token.

## [1.20.2] - 2026-09-04

### Changed

- Install BoringCache CLI `v1.20.3` by default.

## [1.20.1] - 2026-09-03

### Changed

- Install BoringCache CLI `v1.20.2` by default.

### Fixed

- Install the matching checksum-verified Xcode CAS companion automatically for
  `mode: xcode`.
- Bound sccache server startup, verify its runner-local listener independently,
  and fail with recovery guidance instead of leaving the setup step waiting
  indefinitely.

## [1.20.0] - 2026-09-02

### Added

- Publish customer-facing Action release notes from this changelog as part of every release.

### Changed

- Install BoringCache CLI `v1.20.0` by default.
- Reduce the Action to twelve GitHub lifecycle inputs and five workflow-control
  outputs; portable cache behavior and observations stay with the CLI and its
  evidence.
- Run Docker and BuildKit as one synchronous CLI lifecycle from the committed
  repo plan. Workflows use the CLI directly when the command is dynamic.
- Store main/post lifecycle data in one bounded private document while GitHub
  state carries only its opaque id.
- Require archive profiles and native adapters to use separate Action steps so
  each invocation has one primary lifecycle.
- Use the named CLI adapter plan as the workspace source for ordinary adapter
  modes and launch its planned proxy port without an Action-side retry.
- Ask the CLI to fail fast on planned runner prerequisites before starting
  cache infrastructure; the Action does not install a missing helper.

### Removed

- Remove mise, project runtime, package manager, compiler-cache, Maven, and
  other third-party tool installation from the Action. Workflows now use their
  existing wrappers, setup actions, or runner images.
- Remove the associated setup/version inputs and installation-only outputs.
- Remove Action-owned Docker/BuildKit build requests, builders, QEMU, buildctl
  connections, portable verification polling, and observation-only outputs.

## [1.19.7] - 2026-08-28

### Changed

- Install BoringCache CLI `v1.19.6` by default.

[Unreleased]: https://github.com/boringcache/one/compare/v1.32.0...HEAD
[1.32.0]: https://github.com/boringcache/one/compare/v1.31.0...v1.32.0
[1.31.0]: https://github.com/boringcache/one/compare/v1.30.4...v1.31.0
[1.30.4]: https://github.com/boringcache/one/compare/v1.30.3...v1.30.4
[1.30.3]: https://github.com/boringcache/one/compare/v1.30.2...v1.30.3
[1.30.2]: https://github.com/boringcache/one/compare/v1.30.1...v1.30.2
[1.30.1]: https://github.com/boringcache/one/compare/v1.30.0...v1.30.1
[1.30.0]: https://github.com/boringcache/one/compare/v1.21.0...v1.30.0
[1.21.0]: https://github.com/boringcache/one/compare/v1.20.4...v1.21.0
[1.20.4]: https://github.com/boringcache/one/compare/v1.20.3...v1.20.4
[1.20.3]: https://github.com/boringcache/one/compare/v1.20.2...v1.20.3
[1.20.2]: https://github.com/boringcache/one/compare/v1.20.1...v1.20.2
[1.20.1]: https://github.com/boringcache/one/compare/v1.20.0...v1.20.1
[1.20.0]: https://github.com/boringcache/one/compare/v1.19.7...v1.20.0
[1.19.7]: https://github.com/boringcache/one/releases/tag/v1.19.7
