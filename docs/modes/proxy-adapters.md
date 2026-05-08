# Proxy adapter modes

The action can set up supported remote-cache adapters through `mode`:

- `go`
- `gradle`
- `maven`
- `nx-proxy`
- `rust-sccache`
- `turbo-proxy`

Example:

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

Proxy modes can also restore explicit archive `entries` in the same step when
the workflow has local directories to cache.

Shared proxy inputs:

- `proxy-port`: explicit proxy port for modes that use it.
- `read-only`: run without writes where supported.
- `proxy-no-git`: disable git scoping.
- `proxy-no-platform`: disable platform scoping.
- `metadata-hints`: low-cardinality session labels.

See the mode-specific pages for adapter-specific inputs.
