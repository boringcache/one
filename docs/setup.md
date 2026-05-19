# Setup and CLI install

`boringcache/one` can install the BoringCache CLI and, by default, install
project tools with `mise`.

## CLI installation

The action installs the CLI version from `cli-version`.

```yaml
- uses: boringcache/one@v1
  with:
    cli-version: v1.12.68
```

The downloaded binary is cached internally under the GitHub runner tool cache,
then exposed to the workflow through `~/.boringcache/bin/boringcache`. That
stable PATH entry keeps action releases from changing build-tool cache keys that
inspect `PATH`, while preserving the normal `boringcache` command for later
steps.

When `setup: mise` installs missing runtimes, the action keeps the versioned
mise tool-cache path internal too. It exposes `mise` from `~/.local/bin` and
runtime shims from mise's stable shims directory; the selected runtime versions
remain part of the workflow's build identity.

Set `cli-version: skip` only when a previous step has already installed a
compatible `boringcache` binary.

Use `cli-platform` for compatibility or diagnostic cases where automatic
platform detection is not enough:

```yaml
- uses: boringcache/one@v1
  with:
    setup: none
    cli-platform: linux-musl-amd64
```

## Runtime setup

`setup` controls runtime/tool installation:

- `mise`: default. Detects tools from `mise.toml`, `.tool-versions`, and common version files.
- `external`: the workflow installs runtimes elsewhere; `tools` and runtime caching are ignored.
- `none`: skip runtime setup.

```yaml
- uses: boringcache/one@v1
  with:
    setup: mise
    tools: |
      ruby@3.3
      node@22
```

## Runtime cache

When `setup: mise`, `cache-runtime: true` restores and saves the mise installs
cache. The runtime cache tag is derived from the cache tag prefix and detected
tool versions unless `runtime-cache-tag` is set.

```yaml
- uses: boringcache/one@v1
  with:
    setup: mise
    cache-runtime: true
    tool-version-scope: patch
```

`tool-version-scope` can be `patch`, `minor`, or `major`.

## Working directory

`working-directory` controls tool detection, relative paths, and repo config
lookup:

```yaml
- uses: boringcache/one@v1
  with:
    working-directory: apps/web
```
