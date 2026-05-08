# Go mode

Use `mode: go` for Go cache proxy setup:

```yaml
- uses: boringcache/one@v1
  with:
    mode: go
    workspace: my-org/my-project
    cache-tag: go-main
  env:
    BORINGCACHE_RESTORE_TOKEN: ${{ secrets.BORINGCACHE_RESTORE_TOKEN }}
    BORINGCACHE_SAVE_TOKEN: ${{ secrets.BORINGCACHE_SAVE_TOKEN }}
```

Shared proxy inputs:

- `proxy-port`
- `read-only`
- `proxy-no-git`
- `proxy-no-platform`
- `metadata-hints`

Use `preset: go` when you want archive defaults for Go module/build caches
instead of the native proxy mode.
