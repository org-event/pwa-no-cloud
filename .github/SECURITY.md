# Security Policy

## Supported Versions

| Version | Supported |
| --- | --- |
| `main` branch | Yes |
| Latest [GitHub Pages](https://org-event.github.io/pwa-no-cloud/) build from `main` | Yes |
| Other branches / older builds | Best effort |

## Reporting a Vulnerability

**Do not open a public GitHub issue for security vulnerabilities.**

Use GitHub **private vulnerability reporting** (preferred):

https://github.com/org-event/pwa-no-cloud/security/advisories/new

Maintainers can also publish coordinated disclosures via [Security Advisories](https://github.com/org-event/pwa-no-cloud/security/advisories).

We aim to acknowledge valid reports within **7 days** and share a remediation timeline once confirmed.

Product threat boundaries (what we promise / do not promise) live in
[docs/threat-model.md](../docs/threat-model.md).

## Automated Security

This repository is monitored with:

- Dependabot (dependency CVE alerts and update PRs)
- CodeQL static analysis (JavaScript/TypeScript, GitHub Actions workflows)
- `pnpm audit` in CI
- Dependency review on pull requests
- OpenSSF Scorecard
- Secret scanning and push protection (GitHub)
