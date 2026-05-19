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

`boringcache/one` keeps its own CLI install path stable for Bazel workflows: the
versioned hosted-tool-cache directory is not added to `PATH`; the workflow sees
`~/.boringcache/bin` instead. That prevents BoringCache CLI releases from
changing Bazel action or repository-rule keys just because the action installed a
new CLI version.

Bazel still owns the rest of the build identity. If your rules discover
compilers or other host tools from the environment, pin those inputs in your
project or CI `.bazelrc` with `bazelrc-lines`, for example by setting explicit
`--action_env` and `--repo_env` values or by using a repository-defined
toolchain. The first run after changing those lines seeds a new Bazel key space;
subsequent runs should reuse it.

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
