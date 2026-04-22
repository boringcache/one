# BoringCache One ADRs

These ADRs record decisions owned by the maintained `boringcache/one` GitHub Action.

The action can describe what it needs from the CLI or Rails, but the CLI owns local planning and proxy behavior, and Rails owns API/control-plane truth.

## Current Map

| ADR | Status | Active Role |
| --- | --- | --- |
| [0001](0001-cli-plan-owned-action-contract.md) | accepted launch-readiness decision | Keep the action as orchestration around CLI dry-run plans, split tokens, provider metadata seeding, launch benchmark evidence, and the removed Docker helper boundary |
