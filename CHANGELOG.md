# Changelog

All notable changes to BoringCache One are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]


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

[Unreleased]: https://github.com/boringcache/one/compare/v1.20.2...HEAD
[1.20.2]: https://github.com/boringcache/one/compare/v1.20.1...v1.20.2
[1.20.1]: https://github.com/boringcache/one/compare/v1.20.0...v1.20.1
[1.20.0]: https://github.com/boringcache/one/compare/v1.19.7...v1.20.0
[1.19.7]: https://github.com/boringcache/one/releases/tag/v1.19.7
