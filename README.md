# boringcache/one

`boringcache/one` is the maintained GitHub Action entrypoint for BoringCache.
It can install tools with `mise`, restore archive entries, and set up supported
cache modes such as Docker, BuildKit, Bazel, Go, Gradle, Maven, Turbo, Nx, and
Rust `sccache`.

## Quick start

```yaml
- uses: boringcache/one@v1
  with:
    workspace: my-org/my-project
    entries: deps:node_modules,build:dist
  env:
    BORINGCACHE_RESTORE_TOKEN: ${{ secrets.BORINGCACHE_RESTORE_TOKEN }}
    BORINGCACHE_SAVE_TOKEN: ${{ secrets.BORINGCACHE_SAVE_TOKEN }}
```

For Docker:

```yaml
- uses: boringcache/one@v1
  with:
    mode: docker
    workspace: my-org/my-project
    image: ghcr.io/${{ github.repository }}
    tags: latest,${{ github.sha }}
  env:
    BORINGCACHE_RESTORE_TOKEN: ${{ secrets.BORINGCACHE_RESTORE_TOKEN }}
    BORINGCACHE_SAVE_TOKEN: ${{ secrets.BORINGCACHE_SAVE_TOKEN }}
```

## Docs

- [Docs index](docs/README.md)
- [Trust model](docs/trust-model.md)
- [Modes](docs/modes/README.md)
- [Presets](docs/presets/README.md)
- [Action inputs and outputs](action.yml)

## Development

```bash
npm install
npm run build
npm test
```

Generated `dist/**` files must be committed with source changes that affect the
action runtime.
