# Turbo proxy mode

Use `mode: turbo-proxy` to start a local Turbo remote-cache proxy:

```yaml
- uses: boringcache/one@v1
  with:
    mode: turbo-proxy
    workspace: my-org/my-project
    cache-tag: turbo-main
  env:
    BORINGCACHE_RESTORE_TOKEN: ${{ secrets.BORINGCACHE_RESTORE_TOKEN }}
    BORINGCACHE_SAVE_TOKEN: ${{ secrets.BORINGCACHE_SAVE_TOKEN }}
```

Turbo inputs:

- `turbo-api-url`: explicit Turbo remote cache endpoint. When omitted, the action starts a local proxy.
- `turbo-token`: Turbo remote cache token.
- `turbo-team`: Turbo remote cache team slug.
- `turbo-port`: preferred local proxy port, default `4227`.

Outputs:

- `package-manager`
- `package-manager-cache-dir`

Shared proxy inputs:

- `read-only`
- `proxy-no-git`
- `proxy-no-platform`
- `metadata-hints`

Use `preset: node-turbo` when the workflow wants archive defaults for a Node
project that also uses Turbo.
