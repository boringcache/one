# boringcache/one

One action for the BoringCache product suite.

Defaults are opinionated:

- `setup: mise`
- `mode: auto`

In most workflows you only set `workspace` plus one of `entries`, `preset`, or a mode-specific input such as `image`.

Use `boringcache/one` when you want a single GitHub Action entrypoint for:

- archive caching
- mise-powered language and build tool setup
- Docker and BuildKit cache flows
- Bazel, Gradle, Maven, Turbo, and Rust+sccache proxy-backed modes

## When to use it

Choose this if you want BoringCache to feel closer to a buildpack:

- install the right tools with `mise`
- restore the right cache or start the right proxy
- run the build with one action entrypoint
- save on the way out

You usually do not need to set `setup` or `mode` unless you want a specific adapter such as Docker, Bazel, Gradle, Turbo, or Rust+sccache.

## Mental model

Think about `boringcache/one` in three layers:

- CLI bootstrap: `cli-version` installs the BoringCache CLI and is independent from cache behavior.
- Archive caches: `entries` are optional extra archive paths you want restored and saved.
- Proxy and adapter modes: `docker`, `buildkit`, `bazel`, `gradle`, `maven`, `turbo-proxy`, and `rust-sccache` own the main cache/proxy behavior for the step.

That means:

- `entries` are additive, not required for every step
- presets and modes can contribute their own defaults
- `mise` runtime caching is separate from `entries`
- a step can be valid as CLI-only, archive-only, proxy-only, or a mix of proxy plus extra archive entries

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

With the default `setup: mise`, `boringcache/one` resolves project tools from `mise.toml`, `.tool-versions`, and common version files such as `.ruby-version`, `.python-version`, `.go-version`, `.nvmrc`, and `rust-toolchain`. Use `tools` only when you want to override or add to what the project already declares.

When `cache-runtime: true`, `one` caches `mise` installs and rebuilds shims after restore. It does not archive the shim directory itself.

Generated tags are deterministic and readable. With `cache-tag: web`, `tools: ruby@4.0.1`, and the default `tool-version-scope: patch`, the runtime cache tag becomes `web-mise-ruby-4.0.1` and an archive entry such as `bundler:vendor/bundle` resolves to `web-bundler-ruby-4.0.1`.

If you want the exact same runtime tag across GitHub Actions, local CLI use, and Docker-based workflows, set `runtime-cache-tag` explicitly.

CLI-only bootstrap:

```yaml
- uses: boringcache/one@v1
  with:
    setup: none
    workspace: my-org/my-project
    cli-platform: alpine-amd64
```

This installs the CLI without requiring any archive entries. Use it when a later script or Dockerfile wants to copy `$(which boringcache)` directly.

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
    RAILS_MASTER_KEY: ${{ secrets.RAILS_MASTER_KEY }}
```

If the app uses Rails credentials, set `RAILS_MASTER_KEY` in the workflow environment for the Rails steps that run after `boringcache/one`. The Rails preset sets up Ruby and Node toolchains; it does not materialize app secrets for you.

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

Docker setup only for external `docker buildx build` scripts:

```yaml
- uses: boringcache/one@v1
  with:
    cli-platform: debian-bookworm-amd64
    mode: docker
    docker-command: setup
    workspace: my-org/my-project
    cache-tag: my-run-scope
    registry-tag: my-stable-docker-cache
    driver-opts: |
      network=host
  env:
    BORINGCACHE_RESTORE_TOKEN: ${{ secrets.BORINGCACHE_RESTORE_TOKEN }}
    BORINGCACHE_SAVE_TOKEN: ${{ github.event_name == 'pull_request' && '' || secrets.BORINGCACHE_SAVE_TOKEN }}
```

Use `steps.<id>.outputs.buildx-name` and `steps.<id>.outputs.proxy-port` in the later `docker buildx build` step when a benchmark or custom script needs to keep full control over the build invocation.
If you need to copy the CLI into a container build context, install the matching asset first and then copy `$(which boringcache)`.
You can also use `boringcache/one` as a CLI-only bootstrap step by omitting cache entries and setting `cli-platform` when you need a non-runner asset.

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

Turbo monorepo with automatic package-manager cache defaults:

```yaml
- uses: boringcache/one@v1
  with:
    mode: turbo-proxy
    workspace: my-org/my-project
    cache-tag: web
  env:
    BORINGCACHE_RESTORE_TOKEN: ${{ secrets.BORINGCACHE_RESTORE_TOKEN }}
    BORINGCACHE_SAVE_TOKEN: ${{ github.event_name == 'pull_request' && '' || secrets.BORINGCACHE_SAVE_TOKEN }}
```

When you omit `entries` in `mode: turbo-proxy`, `one` detects `npm`, `pnpm`, or `yarn` from the project and defaults archive entries for the package-manager cache plus `node_modules`. It also exports project-local cache directories such as `PNPM_STORE_DIR`, `YARN_CACHE_FOLDER`, or `npm_config_cache`.

Maven with generated build-cache config:

```yaml
- uses: boringcache/one@v1
  with:
    mode: maven
    workspace: my-org/my-project
    cache-tag: service
    maven-local-repo: .m2/repository
  env:
    BORINGCACHE_RESTORE_TOKEN: ${{ secrets.BORINGCACHE_RESTORE_TOKEN }}
    BORINGCACHE_SAVE_TOKEN: ${{ github.event_name == 'pull_request' && '' || secrets.BORINGCACHE_SAVE_TOKEN }}
```

In `mode: maven`, `one` starts the cache-registry proxy, ensures `.mvn/extensions.xml` contains the Maven build-cache extension, writes `.mvn/maven-build-cache-config.xml`, and defaults the archive cache to the Maven local repository when you do not pass `entries`.

## What it handles

- `mode: archive` for generic portable directory caches
- `mode: docker` for Docker builds with BuildKit cache orchestration
- `mode: buildkit` for direct `buildctl` flows
- `mode: bazel` for remote cache proxy wiring
- `mode: gradle` for Gradle remote build cache wiring
- `mode: maven` for Maven build cache extension and proxy wiring
- `mode: turbo-proxy` for Turbo remote cache proxy wiring
- `mode: rust-sccache` for Rust toolchain, cargo caches, and remote `sccache`
- `setup: mise` for installing toolchains such as Node, pnpm, Yarn, Ruby, Python, Go, Java, Maven, Gradle, Rust, Elixir, Erlang, and Bazel

## Setup model

`boringcache/one` supports three setup modes:

- `setup: mise` means `one` installs and activates userland tools with `mise`
- `setup: external` means you manage runtimes elsewhere and `one` only handles BoringCache integration
- `setup: none` means no runtime setup is performed

For Docker and BuildKit, `one` uses the runner's Docker/Buildx environment rather than trying to install a container daemon through `mise`. In practice that means `one` can create builders and manage cache flow for you, but the runner still needs Docker support.

## Mode model

- One invocation of `boringcache/one` runs one primary `mode`
- `archive` is the portable directory-cache mode
- the other modes are proxy/build adapters
- that invocation can still install multiple tools through `mise`
- that invocation can also restore extra archive `entries` alongside the primary mode

In practice:

- Ruby plus Node is one step
- Docker plus Rails tooling can be one step
- Bazel plus Gradle should be separate `boringcache/one` steps in the same job
- Maven plus Docker should be separate `boringcache/one` steps in the same job

## Tag model

- `cache-tag` gives `one` a stable human prefix for generated tags
- for archive `entries`, `cache-tag` prefixes each entry tag unless you already included that prefix yourself
- `runtime-cache-tag` lets you set the exact runtime cache tag when you need local and CI reuse to line up exactly
- `tool-version-scope` controls how generated tags encode versions: `patch`, `minor`, or `major`
- `resolved-tags` outputs the exact cache tags `one` resolved for checks and verification
- `resolved-entries` and `runtime-cache-tag` still show the deterministic archive and runtime tag plan

Example:

```yaml
- id: cache
  uses: boringcache/one@v1
  with:
    workspace: boringcache/web
    cache-tag: web
    tool-version-scope: minor
    entries: bundler:vendor/bundle
```

That resolves to tags like `web-mise-ruby-4.0` and `web-bundler-ruby-4.0`, which are deterministic across the same tool versions on local Ubuntu, Docker-based Ubuntu, and GitHub-hosted Ubuntu runners.

## Trust model

- On `pull_request` jobs, restore can run with `BORINGCACHE_RESTORE_TOKEN`
- Save is skipped cleanly when no save-capable token is present
- Use `BORINGCACHE_SAVE_TOKEN` only on trusted branch, tag, or manual jobs
- `BORINGCACHE_API_TOKEN` still works, but new workflows should prefer split tokens
- `verify: check` runs one exact-tag presence check, while `verify: wait` polls until saved tags are visible
- Save-capable tags verify in the post step after `boringcache/one` finishes saving them

## Core inputs

| Input | Description |
|-------|-------------|
| `setup` | `mise`, `external`, or `none`. Defaults to `mise`. |
| `mode` | `auto`, `archive`, `docker`, `buildkit`, `bazel`, `gradle`, `maven`, `turbo-proxy`, or `rust-sccache`. Defaults to `auto`. |
| `preset` | `none`, `rails`, or `node-turbo`. |
| `workspace` | Workspace in `org/repo` form. Defaults to `BORINGCACHE_DEFAULT_WORKSPACE`, then the repository name. |
| `working-directory` | Project root used for detection and relative paths. |
| `cache-tag` | Human-readable cache tag or prefix for generated tags. |
| `runtime-cache-tag` | Optional exact tag override for the `mise` installs cache. |
| `tools` | Explicit `mise` tools in `tool@version` form. |
| `tool-version-scope` | `patch`, `minor`, or `major` for generated tool-scoped tags. |
| `cache-runtime` | Cache `mise` tool installs and regenerate shims after restore. |
| `verify` / `verify-timeout-seconds` / `verify-require-server-signature` | Optional exact-tag verification controls. |
| `cli-version` | BoringCache CLI version to install. Set to `skip` to disable automatic CLI setup. |
| `cli-platform` | Optional CLI asset override such as `alpine-amd64` or `debian-bookworm-amd64` when the runner binary is not the one you need to copy downstream. |

## Archive inputs

| Input | Description |
|-------|-------------|
| `entries` | Optional extra archive cache entries as comma-separated or newline-separated `tag:path` pairs. These append to any defaults from presets, `mise`, or the selected mode. |
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
| `maven-local-repo`, `maven-extensions-path`, `maven-build-cache-config-path`, `maven-build-cache-extension-version`, `maven-build-cache-id` | Maven mode inputs. |
| `rust-version`, `toolchain`, `targets`, `components`, `cargo-tag`, `cargo-git-tag`, `cargo-bin-tag`, `target-tag`, `sccache-tag`, `sccache`, `sccache-version`, `sccache-mode` | Rust mode inputs. |
| `turbo-api-url`, `turbo-token`, `turbo-team`, `turbo-port` | Turbo proxy mode inputs. |
| `read-only`, `proxy-port`, `proxy-no-git`, `proxy-no-platform` | Shared proxy-mode controls. |

## Outputs

| Output | Description |
|--------|-------------|
| `cache-hit` | Whether a restore hit was found. |
| `runtime-cache-hit` | Whether the `mise` runtime cache was restored. |
| `resolved-mode` | Effective mode used by the action. |
| `resolved-tools` | Resolved `mise` tools as newline-separated `tool@version` values. |
| `workspace`, `cache-tag`, `runtime-cache-tag`, `resolved-entries`, `resolved-tags`, `proxy-port`, `proxy-log-path` | Shared mode outputs. |
| `package-manager`, `package-manager-cache-dir` | Turbo mode outputs. |
| `image-id`, `digest`, `buildx-name`, `buildx-platforms` | Docker and BuildKit outputs. |
| `maven-extensions-path`, `maven-build-cache-config-path`, `maven-local-repo` | Maven mode outputs. |
| `rust-version`, `cargo-tag`, `target-tag`, `cargo-bin-tag`, `sccache-tag`, `sccache-hit` | Rust mode outputs. |

## Learn more

- [GitHub Actions docs](https://boringcache.com/docs#github-actions)
- [GitHub Actions auth and trust model](https://boringcache.com/docs#actions-auth)
- [CLI auth model](https://boringcache.com/docs#cli-auth)
