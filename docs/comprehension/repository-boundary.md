# Repository Boundary

`boringcache/one` owns the maintained GitHub Action product surface:

- action inputs, outputs, defaults, and validation;
- mode orchestration for archive, Docker, BuildKit, Bazel, Gradle, Turbo, and Rust sccache flows;
- bundled action helpers under `lib/core`;
- generated `dist` bundles required by GitHub Actions;
- action E2E workflows and release tag movement.

The CLI owns cache protocol behavior, registry proxy semantics, local adapters, and release binaries. The action may derive provider metadata and invoke the CLI, but it should not reimplement Rails API policy or proxy protocol rules.

Rails owns workspace, token, storage, publish, restore, session, billing, and API truth. Action changes that need a new API contract should update the web ADR/comprehension path and the CLI request path in the same rollout.

The standalone `@boringcache/action-core` package is legacy compatibility only. New product behavior should land here or in CLI/Rails, not in a separate npm release path.
