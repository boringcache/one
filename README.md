# boringcache/one

`boringcache/one` is the maintained GitHub Actions entrypoint for BoringCache.

Preferred path:

1. install the CLI locally
2. run `boringcache onboard`
3. commit `.boringcache.toml` when it helps
4. use `boringcache/one@v1` in GitHub Actions

Quick start:

```yaml
- uses: boringcache/one@v1
  with:
    workspace: my-org/my-project
    cache-profiles: bundle-install
  env:
    BORINGCACHE_RESTORE_TOKEN: ${{ secrets.BORINGCACHE_RESTORE_TOKEN }}
    BORINGCACHE_SAVE_TOKEN: ${{ secrets.BORINGCACHE_SAVE_TOKEN }}
```

If you do not have repo config yet, `entries` and `path` / `key` / `restore-keys` compatibility inputs still work while migrating.

Modes: `archive` (default), `docker`, `buildkit`, `bazel`, `gradle`, `maven`, `turbo-proxy`, `rust-sccache`.

Learn more:

- [GitHub Actions docs](https://boringcache.com/docs#github-actions)
- [GitHub Actions auth and trust model](https://boringcache.com/docs#actions-auth)
- [CLI docs](https://github.com/boringcache/cli/tree/main/docs)
