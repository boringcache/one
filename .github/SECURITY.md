# Security policy

## Reporting a vulnerability

Please report suspected vulnerabilities through GitHub's private vulnerability
reporting for this repository. Do not open a public issue with exploit details,
tokens, logs, or customer data.

Include the affected Action or CLI version, the workflow trust context, clear
reproduction steps, and the impact you observed. Use generated test credentials
and redact secrets from attachments.

## Supported releases

Security fixes are made in the current `v1` release line. Consumers that need a
stable dependency should pin the reviewed distribution commit SHA and update it
deliberately after reviewing a newer release.

The public repository is the small generated Action distribution. The
BoringCache CLI and service authorization boundaries are separate components;
reports that cross those boundaries are still welcome here and will be routed
privately.
