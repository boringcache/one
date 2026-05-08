# node-turbo preset

`preset: node-turbo` combines Node archive defaults with Turbo-oriented project
detection.

```yaml
- uses: boringcache/one@v1
  with:
    preset: node-turbo
    workspace: my-org/my-project
```

Use `mode: turbo-proxy` when the workflow also needs the Turbo remote-cache
endpoint.
