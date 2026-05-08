# Modes

`mode` selects the primary cache behavior for the step.

Common modes:

- [Auto](auto.md)
- [Archive](archive.md)
- [Docker and BuildKit](docker-buildkit.md)
- [Bazel](bazel.md)
- [Go](go.md)
- [Gradle](gradle.md)
- [Maven](maven.md)
- [Turbo proxy](turbo-proxy.md)
- [Nx proxy](nx-proxy.md)
- [Rust sccache](rust-sccache.md)
- [Proxy adapter shared inputs](proxy-adapters.md)

One action invocation runs one primary mode. It can also restore explicit
archive `entries` alongside that mode.
