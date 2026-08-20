# Security Policy

## Reporting a Vulnerability

Please do not open a public issue or pull request for a potential security
vulnerability. Email [security@boringcache.com](mailto:security@boringcache.com)
or use GitHub's private vulnerability reporting for the public Action
distribution repository:

https://github.com/boringcache/one/security/advisories/new

Include the Action version or immutable commit, workflow event and runner
platform, expected impact, and enough reproduction detail for us to verify the
report. Do not include live credentials, customer data, or secrets.

## Supported Versions

The current `boringcache/one@v1` release is supported. Security fixes are
normally shipped as a new release and immutable distribution commit rather
than backported to every older Action version.

## Scope

Reports about the Action runtime, distribution bundle, release pipeline,
credential isolation, trust decisions, cache publication boundary, or the
Action-to-CLI contract are welcome through either private reporting path.

For service, website, account, Artifact, Registry, or other product reports,
use [security@boringcache.com](mailto:security@boringcache.com) or the
[BoringCache security policy](https://boringcache.com/security).
