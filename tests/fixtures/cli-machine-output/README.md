# CLI Machine Output Fixtures

These fixtures mirror the CLI golden JSON contracts consumed by `boringcache/one`.
Keep them in sync with the CLI fixtures whenever action parser behavior depends on
new `--dry-run --json` fields.

The action tests intentionally read these files instead of rebuilding equivalent
objects inline, so schema drift between the CLI and action parser is visible.
