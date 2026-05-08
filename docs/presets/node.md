# node preset

`preset: node` detects the Node package manager and adds archive defaults for
Node workflows.

```yaml
- uses: boringcache/one@v1
  with:
    preset: node
    workspace: my-org/my-project
```

Use `mode: turbo-proxy` for Turbo remote-cache proxy setup.
