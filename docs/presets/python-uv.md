# python-uv preset

`preset: python-uv` adds uv-oriented archive defaults.

```yaml
- uses: boringcache/one@v1
  with:
    preset: python-uv
    workspace: my-org/my-project
    uv-version: 0.9.21
```

`uv-version` is used when setup is `mise` and the project does not already pin
uv.
