# boringcache/one

One action for the BoringCache product suite.

Use `boringcache/one` when you want a single GitHub Action entrypoint for:

- archive caching
- mise-powered language and build tool setup
- Docker and BuildKit cache flows
- Bazel, Gradle, Turbo, and Rust+sccache proxy-backed modes

## When to use it

Choose this if you want BoringCache to feel closer to a buildpack:

- install the right tools with `mise`
- restore the right cache or start the right proxy
- run the build with one action entrypoint
- save on the way out

## Quick start

Archive caching:

```yaml
- uses: boringcache/one@v1
  with:
    workspace: my-org/my-project
    entries: deps:node_modules,build:dist
  env:
    BORINGCACHE_RESTORE_TOKEN: ${{ secrets.BORINGCACHE_RESTORE_TOKEN }}
    BORINGCACHE_SAVE_TOKEN: ${{ github.event_name == 'pull_request' && '' || secrets.BORINGCACHE_SAVE_TOKEN }}
```

Mise-powered Rails-style workflow:

```yaml
- uses: boringcache/one@v1
  with:
    preset: rails
    workspace: my-org/my-project
    entries: bundler:vendor/bundle
  env:
    BORINGCACHE_RESTORE_TOKEN: ${{ secrets.BORINGCACHE_RESTORE_TOKEN }}
    BORINGCACHE_SAVE_TOKEN: ${{ github.event_name == 'pull_request' && '' || secrets.BORINGCACHE_SAVE_TOKEN }}
```

Docker build with cache:

```yaml
- uses: boringcache/one@v1
  with:
    mode: docker
    workspace: my-org/my-project
    image: ghcr.io/${{ github.repository }}
    tags: latest,${{ github.sha }}
  env:
    BORINGCACHE_RESTORE_TOKEN: ${{ secrets.BORINGCACHE_RESTORE_TOKEN }}
    BORINGCACHE_SAVE_TOKEN: ${{ github.event_name == 'pull_request' && '' || secrets.BORINGCACHE_SAVE_TOKEN }}
```

Rust with remote sccache:

```yaml
- uses: boringcache/one@v1
  with:
    mode: rust-sccache
    workspace: my-org/my-project
    sccache: true
    sccache-mode: proxy
  env:
    BORINGCACHE_RESTORE_TOKEN: ${{ secrets.BORINGCACHE_RESTORE_TOKEN }}
    BORINGCACHE_SAVE_TOKEN: ${{ github.event_name == 'pull_request' && '' || secrets.BORINGCACHE_SAVE_TOKEN }}
```

## What it handles

- `mode: archive` for generic portable directory caches
- `mode: docker` for Docker builds with BuildKit cache orchestration
- `mode: buildkit` for direct `buildctl` flows
- `mode: bazel` for remote cache proxy wiring
- `mode: gradle` for Gradle remote build cache wiring
- `mode: turbo-proxy` for Turbo remote cache proxy wiring
- `mode: rust-sccache` for Rust toolchain, cargo caches, and remote `sccache`
- `setup: mise` for installing toolchains such as Node, pnpm, Yarn, Ruby, Python, Go, Java, Maven, Gradle, Rust, Elixir, Erlang, and Bazel

## Setup model

`boringcache/one` supports three setup modes:

- `setup: mise` means `one` installs and activates userland tools with `mise`
- `setup: external` means you manage runtimes elsewhere and `one` only handles BoringCache integration
- `setup: none` means no runtime setup is performed

For Docker and BuildKit, `one` uses the runner's Docker/Buildx environment rather than trying to install a container daemon through `mise`. In practice that means `one` can create builders and manage cache flow for you, but the runner still needs Docker support.

## Trust model

- On `pull_request` jobs, restore can run with `BORINGCACHE_RESTORE_TOKEN`
- Save is skipped cleanly when no save-capable token is present
- Use `BORINGCACHE_SAVE_TOKEN` only on trusted branch, tag, or manual jobs
- `BORINGCACHE_API_TOKEN` still works, but new workflows should prefer split tokens

## Core inputs

| Input | Description |
|-------|-------------|
| `setup` | `mise`, `external`, or `none`. |
| `mode` | `archive`, `docker`, `buildkit`, `bazel`, `gradle`, `turbo-proxy`, or `rust-sccache`. |
| `preset` | `none`, `rails`, or `node-turbo`. |
| `workspace` | Workspace in `org/repo` form. Defaults to the repository name. |
| `working-directory` | Project root used for detection and relative paths. |
| `cache-tag` | Optional cache tag or prefix override. |
| `tools` | Explicit `mise` tools in `tool@version` form. |
| `cache-runtime` | Cache the `mise` runtime directory. |
| `cli-version` | BoringCache CLI version to install. Set to `skip` to disable automatic CLI setup. |

## Archive inputs

| Input | Description |
|-------|-------------|
| `entries` | Comma-separated or newline-separated `tag:path` pairs. |
| `path`, `key`, `restore-keys` | `actions/cache` compatibility inputs. |
| `no-platform` / `enableCrossOsArchive` | Disable platform suffixing for portable caches only. |
| `fail-on-cache-miss` | Fail if restore misses. |
| `lookup-only` | Check for a hit without downloading. |
| `exclude` | Exclude globs on save. |

## Mode-specific inputs

| Input | Description |
|-------|-------------|
| `image`, `tags`, `context`, `dockerfile`, `cache-backend` | Docker and BuildKit build inputs. |
| `buildkit-host`, `output`, `ssh` | BuildKit-only inputs. |
| `bazel-version` | Bazel version for Bazelisk. |
| `gradle-home`, `enable-build-cache` | Gradle mode inputs. |
| `rust-version`, `toolchain`, `targets`, `components`, `sccache`, `sccache-mode` | Rust mode inputs. |
| `turbo-api-url`, `turbo-token`, `turbo-team`, `turbo-port` | Turbo proxy mode inputs. |
| `read-only`, `proxy-port`, `proxy-no-git`, `proxy-no-platform` | Shared proxy-mode controls. |

## Outputs

| Output | Description |
|--------|-------------|
| `cache-hit` | Whether a restore hit was found. |
| `runtime-cache-hit` | Whether the `mise` runtime cache was restored. |
| `resolved-mode` | Effective mode used by the action. |
| `resolved-tools` | Resolved `mise` tools as newline-separated `tool@version` values. |
| `workspace`, `cache-tag`, `proxy-port`, `proxy-log-path` | Shared mode outputs. |
| `image-id`, `digest`, `buildx-name`, `buildx-platforms` | Docker and BuildKit outputs. |
| `rust-version`, `cargo-tag`, `target-tag`, `cargo-bin-tag`, `sccache-tag`, `sccache-hit` | Rust mode outputs. |

## Learn more

- [GitHub Actions docs](https://boringcache.com/docs#github-actions)
- [GitHub Actions auth and trust model](https://boringcache.com/docs#actions-auth)
- [CLI auth model](https://boringcache.com/docs#cli-auth)
