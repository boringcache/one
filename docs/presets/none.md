# none preset

`preset: none` is the default. It does not add preset archive entries.

Use it with explicit `entries`, `cache-profiles`, or a mode-specific setup:

```yaml
- uses: boringcache/one@v1
  with:
    preset: none
    workspace: my-org/my-project
    entries: deps:node_modules
```
