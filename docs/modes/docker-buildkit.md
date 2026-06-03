# Docker and BuildKit modes

Use `mode: docker` for `docker buildx build` workflows:

```yaml
- uses: boringcache/one@v1
  with:
    mode: docker
    workspace: my-org/my-project
    image: ghcr.io/${{ github.repository }}
    tags: latest,${{ github.sha }}
  env:
    BORINGCACHE_RESTORE_TOKEN: ${{ secrets.BORINGCACHE_RESTORE_TOKEN }}
    BORINGCACHE_SAVE_TOKEN: ${{ secrets.BORINGCACHE_SAVE_TOKEN }}
```

Use `mode: buildkit` when the workflow calls `buildctl` directly.

## Docker inputs

Common Docker inputs:

- `context`: build context, default `.`.
- `dockerfile`: Dockerfile path, default `Dockerfile`.
- `image`: image name.
- `tags`: comma-separated or newline-separated tags, default `latest`.
- `build-args`: newline-separated build args.
- `target`: build target stage.
- `platforms`: target platforms.
- `push`: push the image.
- `load`: load the image into the local daemon when supported.
- `no-cache`: disable cache usage.
- `secrets`: newline-separated BuildKit secret specs.
- `docker-tool-cache`: Docker mode only, comma- or newline-separated `TOOL:TAG`
  native remote-cache tools to expose inside Dockerfile `RUN` steps. Plain
  `turbo`, `nx`, or `sccache` values require `[adapters.<tool>].tag`.
- `ssh`: newline-separated SSH specs.

Docker-specific setup inputs:

- `driver`: buildx driver, default `docker-container`.
- `driver-opts`: newline-separated buildx driver options.
- `buildkitd-config-inline`: inline BuildKit daemon TOML.
- `docker-command`: `build` or `setup`. `setup` prepares cache wiring without running the build.

## BuildKit inputs

`mode: buildkit` requires `buildkit-host`.

TLS inputs:

- `buildkit-tls-ca`
- `buildkit-tls-cert`
- `buildkit-tls-key`
- `buildkit-tls-skip-verify`

`output` sets custom `buildctl` output. When set, `image`, `tags`, and `push`
are ignored in BuildKit mode.

## Cache inputs

Docker and BuildKit share:

- `cache-backend`: `registry`, `local`, or `auto`, default `registry`. `auto`
  is a dogfood path that keeps registry restore semantics while delegating
  cache publication to the CLI cache-to accelerator.
- `cache-mode`: `min` or `max`, default `max`.
- `registry-tag`: proxy cache namespace tag.
- `registry-ref-tag`: local/no-CI OCI tag suffix, default `buildcache`.
- `oci-hydration`: `metadata-only`, `bodies-background`, or `bodies-before-ready`.
- `require-oci-import-ready`: fail setup when planned imports are unreadable.

Useful outputs for Docker and BuildKit setup:

- `cache-from`
- `cache-to`
- `docker-cache-from-refs`
- `docker-cache-requested-from-refs`
- `docker-cache-unreadable-from-refs`
- `docker-cache-import-ready`

Set `require-oci-import-ready: true` when a workflow should fail instead of
continuing after an incomplete warm import.

## Dockerfile tool caches

Use `docker-tool-cache` when a Dockerfile build step runs a tool that already
speaks a native remote-cache protocol:

```yaml
- uses: boringcache/one@v1
  with:
    mode: docker
    workspace: my-org/my-project
    image: ghcr.io/${{ github.repository }}
    docker-tool-cache: turbo:turbo-cache,sccache:rust-cache
```

Then opt in inside the Dockerfile with the stable BuildKit secret id:

```Dockerfile
RUN --mount=type=secret,id=boringcache-tool-cache-env \
  . /run/secrets/boringcache-tool-cache-env && \
  turbo run build
```

The action does not build this secret itself. It delegates the build to
`boringcache docker --tool-cache ...`, so the CLI owns the proxy URL, local
tool-token values, and adapter tag contract outside the Docker build graph.

`docker-tool-cache` requires `docker-command: build`; setup-only mode cannot
inject the CLI-owned secret into a later user-run `docker buildx build`.
