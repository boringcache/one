# Repository Boundary

`boringcache/one` owns the standalone maintained GitHub Action product surface:

- action inputs, outputs, defaults, and validation;
- mode orchestration for archive, Docker, BuildKit, Bazel, Gradle, Turbo, and Rust sccache flows;
- bundled action helpers under `lib/core`;
- generated `dist` bundles required by GitHub Actions;
- action E2E workflows and release tag movement.

The CLI owns cache protocol behavior, registry proxy semantics, local adapters, and release binaries. The action may derive provider metadata and invoke the CLI, but it should not reimplement Rails API policy or proxy protocol rules.

Rails owns workspace, token, storage, publish, restore, session, billing, and API truth. Action changes that need a new API contract should update the web ADR/comprehension path and the CLI request path in the same rollout.

The retired `@boringcache/action-core` package is not part of the maintained action path. Do not add it as a dependency or route new behavior through a separate npm release. New product behavior should land here, in CLI, or in Rails.
