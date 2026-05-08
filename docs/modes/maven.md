# Maven mode

Use `mode: maven` to configure Maven build-cache extension wiring:

```yaml
- uses: boringcache/one@v1
  with:
    mode: maven
    workspace: my-org/my-project
    cache-tag: maven-main
  env:
    BORINGCACHE_RESTORE_TOKEN: ${{ secrets.BORINGCACHE_RESTORE_TOKEN }}
    BORINGCACHE_SAVE_TOKEN: ${{ secrets.BORINGCACHE_SAVE_TOKEN }}
```

Maven inputs:

- `maven-version`: Maven version to install when `setup: mise` and no project pin exists, default `3.9.9`.
- `maven-local-repo`: local Maven repository path, default `~/.m2/repository`.
- `maven-extensions-path`: path to `.mvn/extensions.xml`.
- `maven-build-cache-config-path`: path to `.mvn/maven-build-cache-config.xml`.
- `maven-build-cache-extension-version`: extension version, default `1.2.2`.
- `maven-build-cache-id`: logical remote build-cache id, default `boringcache`.

Outputs:

- `maven-extensions-path`
- `maven-build-cache-config-path`
- `maven-local-repo`

Shared proxy inputs:

- `proxy-port`
- `read-only`
- `proxy-no-git`
- `proxy-no-platform`
- `metadata-hints`
