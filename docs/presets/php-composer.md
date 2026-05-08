# php-composer preset

`preset: php-composer` adds Composer-oriented archive defaults.

```yaml
- uses: boringcache/one@v1
  with:
    preset: php-composer
    workspace: my-org/my-project
    composer-version: 2.9.5
```

`composer-version` is used when setup is `mise` and the project does not
already pin Composer.
