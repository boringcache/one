# go preset

`preset: go` adds archive defaults for Go module and build caches.

```yaml
- uses: boringcache/one@v1
  with:
    preset: go
    workspace: my-org/my-project
```

Use `mode: go` when the workflow needs the native Go cache proxy path.
