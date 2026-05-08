# Nx proxy mode

Use `mode: nx-proxy` to start a local Nx self-hosted remote-cache proxy:

```yaml
- uses: boringcache/one@v1
  with:
    mode: nx-proxy
    workspace: my-org/my-project
    cache-tag: nx-main
  env:
    BORINGCACHE_RESTORE_TOKEN: ${{ secrets.BORINGCACHE_RESTORE_TOKEN }}
    BORINGCACHE_SAVE_TOKEN: ${{ secrets.BORINGCACHE_SAVE_TOKEN }}
```

Nx inputs:

- `nx-access-token`: Nx self-hosted remote cache access token. Defaults to the proxy-internal token.
- `nx-port`: preferred local proxy port, default `4228`.

Shared proxy inputs:

- `read-only`
- `proxy-no-git`
- `proxy-no-platform`
- `metadata-hints`

Add archive `entries` when the workflow also has package-manager or dependency
directories to cache.
