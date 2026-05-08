# Migrating from actions/cache

For a direct migration, keep `path`, `key`, and `restore-keys`:

```yaml
- uses: boringcache/one@v1
  with:
    path: |
      ~/.npm
      node_modules
    key: npm-${{ runner.os }}-${{ hashFiles('package-lock.json') }}
    restore-keys: |
      npm-${{ runner.os }}-
  env:
    BORINGCACHE_RESTORE_TOKEN: ${{ secrets.BORINGCACHE_RESTORE_TOKEN }}
    BORINGCACHE_SAVE_TOKEN: ${{ secrets.BORINGCACHE_SAVE_TOKEN }}
```

For a BoringCache-native archive shape, use `workspace` and `entries`:

```yaml
- uses: boringcache/one@v1
  with:
    workspace: my-org/my-project
    entries: npm-cache:~/.npm,node:node_modules
```

Use `cache-profiles` when the repo already defines named cache groups in
`.boringcache.toml`.

Compatibility notes:

- `enableCrossOsArchive: true` maps to platform-independent archive tags.
- `restore-keys` are supported only with `path`/`key` compatibility inputs.
- If `entries` or `cache-profiles` are provided, they take precedence over
  `path`/`key`.
