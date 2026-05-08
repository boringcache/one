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

- `cache-backend`: `registry` or `local`, default `registry`.
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
