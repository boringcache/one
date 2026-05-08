# Archive entries and cache inputs

Use archive entries for directories and files that should be restored before
the job and saved in the post step.

## Workspace and tags

`workspace` is the BoringCache workspace, usually `namespace/workspace`.

`cache-tag` is a human-readable tag or prefix. Generated archive entries,
runtime caches, and proxy tags derive names from it unless exact overrides are
provided.

```yaml
- uses: boringcache/one@v1
  with:
    workspace: my-org/my-project
    cache-tag: web-ci
```

If `workspace` is omitted, the action tries repo config and CLI defaults.

## Entries

`entries` accepts built-in or repo-defined entry ids, and raw `tag:path` pairs.

```yaml
- uses: boringcache/one@v1
  with:
    workspace: my-org/my-project
    entries: |
      bundler
      node_modules
      build:dist
```

Semantic entries resolve through the CLI plan. Raw pairs are restored and saved
as written, with path resolution handled by the action/CLI flow.

## Cache profiles

`cache-profiles` resolves named profiles from `.boringcache.toml` or
`boringcache.toml`.

```yaml
- uses: boringcache/one@v1
  with:
    workspace: my-org/my-project
    cache-profiles: |
      bundle-install
      frontend
```

When both `cache-profiles` and `entries` are set, profile entries are resolved
first and raw extra entries are appended.

## actions/cache compatibility

Use `path`, `key`, and `restore-keys` when migrating an existing
`actions/cache` workflow without rewriting the cache shape immediately.

```yaml
- uses: boringcache/one@v1
  with:
    path: |
      node_modules
      .next/cache
    key: node-${{ runner.os }}-${{ hashFiles('package-lock.json') }}
    restore-keys: |
      node-${{ runner.os }}-
```

If explicit `entries` or `cache-profiles` are provided with `path`/`key`, the
explicit entries path wins.

## Archive flags

Shared archive flags:

- `no-platform`: disable platform suffixing.
- `enableCrossOsArchive`: compatibility alias that also disables platform suffixing.
- `fail-on-cache-miss`: fail when no cache entry is found.
- `lookup-only`: check for a hit without downloading.
- `force`: save even when the tag already exists.
- `exclude`: comma-separated glob patterns to exclude.
- `allow-external-symlinks`: allow restoring symlinks whose targets escape the restore root.
