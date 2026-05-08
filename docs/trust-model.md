# Trust model

Use split tokens in GitHub Actions:

```yaml
env:
  BORINGCACHE_RESTORE_TOKEN: ${{ secrets.BORINGCACHE_RESTORE_TOKEN }}
  BORINGCACHE_SAVE_TOKEN: ${{ secrets.BORINGCACHE_SAVE_TOKEN }}
```

Every job that should read cache needs `BORINGCACHE_RESTORE_TOKEN`.
Only trusted jobs that should publish cache updates need
`BORINGCACHE_SAVE_TOKEN`.

Pull request jobs are restore-only by default. Set
`save-on-pull-request: true` only when that write scope is intentional.

`BORINGCACHE_API_TOKEN` is still accepted as a legacy fallback, but new
workflows should use split tokens.
