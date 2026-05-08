# Outputs

Common outputs:

- `cache-hit`: archive or mode-specific hit.
- `runtime-cache-hit`: mise runtime cache restored.
- `diagnostics-level`: effective diagnostics level.
- `resolved-mode`: effective mode.
- `resolved-tools`: detected or configured tools.
- `workspace`: resolved workspace.
- `cache-tag`: resolved cache tag or prefix.
- `runtime-cache-tag`: resolved runtime cache tag.
- `resolved-entries`: resolved archive entries.
- `resolved-tags`: exact tags used for verification and follow-up checks.
- `proxy-port`: resolved proxy port for proxy-backed modes.
- `proxy-log-path`: proxy log path.

Docker and BuildKit outputs:

- `registry-ref`
- `cache-from`
- `cache-to`
- `docker-cache-run-ref`
- `docker-cache-from-refs`
- `docker-cache-requested-from-refs`
- `docker-cache-unreadable-from-refs`
- `docker-cache-import-ready`
- `docker-cache-promotion-refs`
- `docker-ci-provider`
- `docker-ci-run-id`
- `docker-ci-run-attempt`
- `docker-ci-ref-type`
- `docker-ci-ref-name`
- `docker-ci-run-started-at`
- `cache-dir`
- `save-cache-dir`
- `image-id`
- `digest`
- `buildx-name`
- `buildx-platforms`

Rust and sccache outputs:

- `rust-version`
- `cargo-tag`
- `cargo-git-tag`
- `target-tag`
- `cargo-bin-tag`
- `sccache-tag`
- `sccache-hit`

Node/Turbo outputs:

- `package-manager`
- `package-manager-cache-dir`

Maven outputs:

- `maven-extensions-path`
- `maven-build-cache-config-path`
- `maven-local-repo`
