# BoringCache One

## What It Does

Primary mise-powered GitHub Action for the BoringCache suite. Archive, Turbo, Docker, BuildKit, Bazel, Gradle, and Rust `sccache` modes now live here.

## Quick Reference

```yaml
- uses: boringcache/one@v1
  with:
    setup: none
    mode: archive
    workspace: my-org/my-project
    entries: deps:node_modules,build:dist
  env:
    BORINGCACHE_RESTORE_TOKEN: ${{ secrets.BORINGCACHE_RESTORE_TOKEN }}
    BORINGCACHE_SAVE_TOKEN: ${{ github.event_name == 'pull_request' && '' || secrets.BORINGCACHE_SAVE_TOKEN }}
```

## Key Features

- **Mise-powered**: Can detect and install runtimes via `mise`
- **Platform-aware**: OS/arch scoping by default (disable with `no-platform: true`)
- **Mode-driven**: Archive, Turbo, Docker, BuildKit, Bazel, Gradle, and Rust `sccache` all route through the same action
- **Compatible modes**: Supports both `entries` format and `actions/cache` format (`path`/`key`/`restore-keys`)

## Inputs

| Input | Description |
|-------|-------------|
| `setup` | Runtime setup owner: `mise`, `external`, or `none` |
| `mode` | Product mode (`archive`, `turbo-proxy`, `docker`, `buildkit`, `bazel`, `gradle`, `rust-sccache`) |
| `preset` | Workflow preset (`none`, `rails`, `node-turbo`) |
| `workspace` | BoringCache workspace (`org/repo`) |
| `entries` | Cache entries (`tag:path,tag2:path2`) |
| `no-platform` | Disable OS/arch suffix for portable caches |
| `fail-on-cache-miss` | Fail if cache not found |
| `force` | Overwrite existing cache on save |
| `save-always` | Save even if job fails |

## Outputs

| Output | Description |
|--------|-------------|
| `cache-hit` | `true` if exact match found |
| `runtime-cache-hit` | `true` if the `mise` runtime cache hit |
| `resolved-mode` | Effective mode used |
| `resolved-tools` | Resolved runtime tools |

## Code Structure

- `lib/restore.ts` - Main phase: restore cache entries
- `lib/save.ts` - Post phase: save cache entries
- `lib/modes.ts` - Mode registry and compatibility-wrapper mapping
- `lib/utils.ts` - Shared utilities (CLI install, exec, cache helpers)

## Build

```bash
npm install && npm run build && npm test
```

---
**See [../AGENTS.md](../AGENTS.md) for shared conventions.**
