# CLI Machine Output Fixtures

These fixtures mirror the CLI golden JSON contracts consumed by `boringcache/one`.
Keep them in sync with the CLI fixtures whenever action parser behavior depends on
new `--dry-run --json` fields.

The action tests intentionally read these files instead of rebuilding equivalent
objects inline, so schema drift between the CLI and action parser is visible.

Unsupported-schema fixtures are parser failure artifacts: they preserve the raw
CLI JSON shape and the expected action decision when the action must stop before
starting a proxy or mutating workflow state.
