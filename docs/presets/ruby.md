# ruby preset

`preset: ruby` adds Ruby archive defaults.

```yaml
- uses: boringcache/one@v1
  with:
    preset: ruby
    workspace: my-org/my-project
```

Use `tools` or project version files when `setup: mise` should install a
specific Ruby version.
