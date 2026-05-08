# Archive mode

Use archive mode for explicit directories and files.

```yaml
- uses: boringcache/one@v1
  with:
    mode: archive
    workspace: my-org/my-project
    entries: deps:node_modules,build:dist
  env:
    BORINGCACHE_RESTORE_TOKEN: ${{ secrets.BORINGCACHE_RESTORE_TOKEN }}
    BORINGCACHE_SAVE_TOKEN: ${{ secrets.BORINGCACHE_SAVE_TOKEN }}
```

`entries` accepts comma-separated or newline-separated `tag:path` pairs.

`path`, `key`, and `restore-keys` are also supported for workflows migrating
from `actions/cache` format.
