# Rust sccache mode

Use `mode: rust-sccache` for Rust toolchain setup, Cargo archive caches, and
optional sccache support.

```yaml
- uses: boringcache/one@v1
  with:
    mode: rust-sccache
    workspace: my-org/my-project
    sccache: true
    sccache-mode: proxy
  env:
    BORINGCACHE_RESTORE_TOKEN: ${{ secrets.BORINGCACHE_RESTORE_TOKEN }}
    BORINGCACHE_SAVE_TOKEN: ${{ secrets.BORINGCACHE_SAVE_TOKEN }}
```

Rust toolchain inputs:

- `rust-version` or `toolchain`: Rust version/channel.
- `targets`: comma-separated target triples.
- `components`: comma-separated Rust components.
- `profile`: rustup profile, default `minimal`.

Cargo archive inputs:

- `cache-cargo`: cache cargo registry and git directories, default `true`.
- `cache-cargo-bin`: cache cargo bin directory, default `false`.
- `cache-target`: cache target directory, default `true`.

sccache inputs:

- `sccache`: enable sccache.
- `sccache-version`: version to install if missing, default `0.14.0`.
- `sccache-cache-size`: local cache size, default `5G`.
- `sccache-mode`: `local` or `proxy`, default `local`.

Outputs:

- `rust-version`
- `cargo-tag`
- `cargo-git-tag`
- `target-tag`
- `cargo-bin-tag`
- `sccache-tag`
- `sccache-hit`
