# Auto mode

`mode: auto` is the default. It resolves archive entries from explicit inputs,
repo config, presets, or runtime cache setup.

Use auto mode when the workflow is archive-oriented and does not need a native
remote-cache adapter.

```yaml
- uses: boringcache/one@v1
  with:
    workspace: my-org/my-project
    entries: bundler,node_modules
```

If no cache entries resolve and the CLI is installed, the action can still act
as a setup step. Use `mode: archive` when an empty archive plan should be
treated as an archive-specific configuration problem.
