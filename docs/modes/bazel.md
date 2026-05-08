# Bazel mode

Use `mode: bazel` to wire Bazel to the BoringCache remote cache:

```yaml
- uses: boringcache/one@v1
  with:
    mode: bazel
    workspace: my-org/my-project
    cache-tag: bazel-main
  env:
    BORINGCACHE_RESTORE_TOKEN: ${{ secrets.BORINGCACHE_RESTORE_TOKEN }}
    BORINGCACHE_SAVE_TOKEN: ${{ secrets.BORINGCACHE_SAVE_TOKEN }}
```

Add `bazelrc-lines` when the workflow needs extra Bazel config lines appended
after the remote-cache block.

Inputs:

- `bazel-version`: sets `USE_BAZEL_VERSION` when provided or detected through mise.
- `bazelrc-lines`: newline-separated extra `.bazelrc` lines.
- `proxy-port`: explicit proxy port.
- `read-only`: run without cache writes where supported.
- `proxy-no-git` / `proxy-no-platform`: disable proxy scoping.
- `metadata-hints`: proxy session labels.

## Hybrid local-state archives

If the workflow also restores local Bazel state, list those paths as explicit
archive entries:

```yaml
- uses: boringcache/one@v1
  with:
    mode: bazel
    workspace: my-org/my-project
    cache-tag: grpc-bazel-remote-cache-main
    entries: |
      bazel-install:/tmp/boringcache-bazel-root/install
      bazel-cache:/tmp/boringcache-bazel-root/cache
      bazel-action-cache:/tmp/boringcache-bazel-root/output-base/action_cache
      bazel-disk-cache:/tmp/boringcache-bazel-root/disk-cache
  env:
    BORINGCACHE_RESTORE_TOKEN: ${{ secrets.BORINGCACHE_RESTORE_TOKEN }}
    BORINGCACHE_SAVE_TOKEN: ${{ secrets.BORINGCACHE_SAVE_TOKEN }}
```

Keep the local-state archive entries visible in YAML so the workflow shows both
cache surfaces it is using.
