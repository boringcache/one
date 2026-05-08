# rails preset

`preset: rails` adds Rails-oriented archive defaults and tool detection.

```yaml
- uses: boringcache/one@v1
  with:
    preset: rails
    workspace: my-org/my-project
  env:
    BORINGCACHE_RESTORE_TOKEN: ${{ secrets.BORINGCACHE_RESTORE_TOKEN }}
    BORINGCACHE_SAVE_TOKEN: ${{ secrets.BORINGCACHE_SAVE_TOKEN }}
```

Add `entries` when the workflow needs extra project-specific directories.
