# Verification and diagnostics

## Save policy

`save-policy` controls whether the post step publishes cache updates:

- `auto`: default. Save when event policy and tokens allow it.
- `off`: restore/setup only.

```yaml
- uses: boringcache/one@v1
  with:
    save-policy: off
```

`save-always: true` lets the post step run even if an earlier job step fails.

Pull request jobs stay restore-only unless `save-on-pull-request: true` is set
and a save-capable token is available.

## Read-only proxy mode

For proxy-backed modes, `read-only: true` asks the adapter/proxy to run without
writes where supported.

```yaml
- uses: boringcache/one@v1
  with:
    mode: bazel
    read-only: true
```

## Verification

`verify` checks resolved tags:

- `none`: default.
- `check`: one-shot check.
- `wait`: poll until found or timeout.
- `warn`: poll but warn instead of failing on timeout.

```yaml
- uses: boringcache/one@v1
  with:
    verify: wait
    verify-timeout-seconds: 180
```

Use `verify-require-server-signature: true` when verification should require
signed cache hits.

Use `trusted-workspace-signing-key-fingerprint` to pin an expected workspace
signing key fingerprint:

```yaml
- uses: boringcache/one@v1
  with:
    trusted-workspace-signing-key-fingerprint: ed25519-sha256:...
```

## Diagnostics

`diagnostics` controls action-level grouped output:

- `auto`: follows `ACTIONS_STEP_DEBUG`.
- `off`: no grouped diagnostics.
- `summary`: grouped state.
- `verbose`: grouped state plus proxy logs.

```yaml
- uses: boringcache/one@v1
  with:
    diagnostics: verbose
    diagnostics-log-lines: 80
```

`verbose: true` forwards verbose CLI output.

## Metadata hints

`metadata-hints` passes low-cardinality labels to proxy-backed sessions.

```yaml
- uses: boringcache/one@v1
  with:
    mode: bazel
    metadata-hints: |
      project=web
      tool=bazel
      lane=ci
```

Keep values stable and reusable. Avoid commit SHAs, run ids, timestamps, and
other per-run values.

## Proxy scoping

Proxy-backed modes support:

- `proxy-port`: explicit port.
- `proxy-no-git`: disable git scoping.
- `proxy-no-platform`: disable platform scoping.
