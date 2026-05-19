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

The action also keeps the versioned hosted-tool-cache path for its `mise`
bootstrap internal. When `setup: mise` installs Bazel or another runtime, the
workflow sees stable home paths (`~/.local/bin` and mise shims), while the
requested Bazel/toolchain versions stay explicit build inputs.

This stabilizes action-owned paths on the GitHub Actions runner. Docker
containers and local laptops still have their own `PATH`, compiler discovery,
and toolchain identity, so cross-environment cache sharing depends on your Bazel
toolchain configuration being intentionally portable.

BoringCache's CLI Bazel adapter also writes deterministic host-env defaults into
the generated Bazel setup: strict action env, a stable `PATH` for action and
repository-rule keys, and resolved local C/C++ toolchain env where the runner has
standard tools. That keeps BoringCache and GitHub runner setup paths out of
Bazel cache identity while leaving source, flags, platform, and explicit
toolchain choices as real inputs.

The same adapter defaults apply when you use the CLI directly with
`boringcache bazel` or `boringcache run --proxy ... -- bazel ...`. They stabilize
the environment around the Bazel process that BoringCache launches; they do not
rewrite a nested environment inside `docker run` unless Bazel itself is launched
through BoringCache inside that container.

Bazel still owns the rest of the build identity. If your rules need non-standard
host tools, pin those inputs in your project or CI `.bazelrc` with
`bazelrc-lines`, for example by setting explicit `--repo_env` values or by using
a repository-defined toolchain. The first run after changing those lines seeds a
new Bazel key space; subsequent runs should reuse it.

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
