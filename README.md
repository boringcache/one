# boringcache/one

`boringcache/one` is the public distribution repo for the BoringCache GitHub
Action.

This repo is intentionally tiny: `action.yml`, bundled `dist/**`, `LICENSE`,
this README, and the minimal release checks needed to keep the shipped action
valid. Source, tests, examples, and product docs live in
[`boringcache/monorepo`](https://github.com/boringcache/monorepo) under `gha/`
and the shared planning/docs tree.

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

Docker mode:

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

## Inputs

The shipped input and output contract is in [`action.yml`](action.yml).

## Maintenance

Do not edit the bundled runtime directly in this repo. Maintainers update
`gha/` in `boringcache/monorepo`, build the action there, and sync this
distribution repo from the monorepo release tooling.
