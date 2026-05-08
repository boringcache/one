# BoringCache One Comprehension

This directory holds durable context for `boringcache/one`, the maintained first-party GitHub Action.

Start here when changing action inputs, outputs, modes, bundled helper behavior, workflow E2E coverage, release wiring, or the boundary between the action, CLI, and Rails API.

## Map

- [Repository Boundary](repository-boundary.md) records what belongs in this repo and what must stay in CLI or Rails.
- [ADR 0001](../adr/0001-cli-plan-owned-action-contract.md) records the launch contract: the action orchestrates CLI dry-run plans, should not become a second planner, and keeps Docker on CLI-planned BuildKit registry-cache refs.
- [ADR 0002](../adr/0002-launch-action-readiness-and-legacy-retirement.md) records the current launch audit: Docker path alignment, version coupling, split-token examples, release proof, action-side performance guardrails, and the current Docker/BuildKit readiness contract.
- Public how-to docs live outside this comprehension folder under `docs/`,
  grouped by mode, preset, or shared workflow concern. Keep `README.md` as a
  short entrypoint.

## Update Rule

Update these notes before handoff when action behavior, workflow contracts, CLI install/version selection, provider metadata, mode ownership, readiness semantics, or release assumptions change.
