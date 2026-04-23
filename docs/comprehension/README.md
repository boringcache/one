# BoringCache One Comprehension

This directory holds durable context for `boringcache/one`, the maintained first-party GitHub Action.

Start here when changing action inputs, outputs, modes, bundled helper behavior, workflow E2E coverage, release wiring, or the boundary between the action, CLI, and Rails API.

## Map

- [Repository Boundary](repository-boundary.md) records what belongs in this repo and what must stay in CLI or Rails.
- [ADR 0001](../adr/0001-cli-plan-owned-action-contract.md) records the launch contract: the action orchestrates CLI dry-run plans, should not become a second planner, and keeps the old Dockerfile-internal helper surface removed before launch.
- [ADR 0002](../adr/0002-launch-action-readiness-and-legacy-retirement.md) records the current launch audit: helper retirement, version coupling, split-token examples, release proof, and action-side performance guardrails.

## Update Rule

Update these notes before handoff when action behavior, workflow contracts, CLI install/version selection, provider metadata, mode ownership, or release assumptions change.
