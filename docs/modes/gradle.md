# Gradle mode

Use `mode: gradle` to set up the Gradle remote build cache:

```yaml
- uses: boringcache/one@v1
  with:
    mode: gradle
    workspace: my-org/my-project
    cache-tag: gradle-main
  env:
    BORINGCACHE_RESTORE_TOKEN: ${{ secrets.BORINGCACHE_RESTORE_TOKEN }}
    BORINGCACHE_SAVE_TOKEN: ${{ secrets.BORINGCACHE_SAVE_TOKEN }}
```

Gradle inputs:

- `gradle-home`: Gradle user home, default `~/.gradle`.
- `enable-build-cache`: set `org.gradle.caching=true`, default `true`.

Shared proxy inputs:

- `proxy-port`
- `read-only`
- `proxy-no-git`
- `proxy-no-platform`
- `metadata-hints`

Add archive `entries` when the workflow also has local directories to cache.
