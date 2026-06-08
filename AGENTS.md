# BoringCache One

This is the public distribution repo for `boringcache/one`.

## Boundary

- Keep this repo tiny: `action.yml`, bundled `dist/**`, `LICENSE`, README, and
  minimal GitHub release checks.
- Do not add source, tests, examples, docs, dependency lockfiles, generated
  package-manager folders, or benchmark/E2E workflows here.
- Source, tests, examples, docs, and release planning live in
  `boringcache/monorepo` under `gha/` and `.planning/`.

## Maintenance

- Make runtime changes in the monorepo, rebuild there, then sync this repo from
  the monorepo distribution tooling.
- Keep `action.yml` and `dist/**` on the same version.
- Keep the floating `v1` tag pointed at the current validated distribution
  commit after release closure.
