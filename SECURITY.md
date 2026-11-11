# Security Policy

## Reporting a vulnerability

Report security issues privately through GitHub:
**[Security → Report a vulnerability](https://github.com/algomanlife/openfund/security/advisories/new)**.
Do not open public issues, pull requests or discussions for suspected
vulnerabilities, and do not post exploit details anywhere public.

Please include:

- the affected component, route or file, and the version (`/version` output or commit SHA);
- steps to reproduce, and the impact you observed or expect;
- whether the issue needs a wallet signature, an account or special configuration.

Never include real private keys, seed phrases, session cookies or other people's
data. If you must demonstrate access, use your own test wallet.

### What to expect

Openfund is maintained by a small team; responses are best effort. The
maintainer aims to acknowledge a report within a few days, keep you informed
in the advisory, and credit you in the published advisory unless you ask not to
be named. Please give a reasonable time to fix before any public disclosure.

### Scope

| In scope | Out of scope |
| --- | --- |
| Code in this repository and its release artifacts | Third-party services (Render, Directus upstream, Gains, wallets, DePay) — report to them directly |
| The deployed Openfund application on its official domains | Denial-of-service, spam or social engineering |
| GitHub Actions workflows and release integrity | Findings that need a compromised user device or browser |

Test only against your own accounts and wallets. Do not access, modify or
delete other users' data, and stop and report as soon as you find a
vulnerability.

### Supported versions

Only the latest official release (see
[Releases](https://github.com/algomanlife/openfund/releases/latest)) and `main`
receive security fixes. For which capabilities are simulated, read-only or
live, see [Feature Status](docs/product/FEATURE_STATUS.md).

## Security model (summary)

- **Authentication**: Sign-In with Ethereum (EIP-4361) with single-use nonces,
  domain/chain validation, signature verification (viem, EIP-1271 where
  applicable). Sessions are opaque, server-side, hashed at rest, delivered as
  HttpOnly `SameSite=Lax` cookies (`Secure` in production).
- **Authorization**: the Node backend is the only ownership boundary for wallet
  users; every portfolio/trading endpoint is ownership-scoped. Directus is the
  admin/editorial interface — its public role is read-only on published content
  collections.
- **Secrets**: no secrets in Git. Render prompts for secrets at blueprint apply
  (`sync: false`) or generates them (`generateValue`). gitleaks runs on every PR
  with the default rule set; the repository `gitleaks.toml` only extends it with
  a path allowlist for generated browser bundles (`react/`, `publish-openfund/`,
  `dist/`), whose minified third-party SDK code embeds public constants (the
  documented RainbowKit provider fallback key and wallet-SDK telemetry keys that
  ship inside the published npm packages). Source directories stay fully
  scanned. One further exact-path allowlist covers `infra/upstream/vendor-manifest.json`,
  which holds only vendored-file path to sha256 checksums. `VITE_*` variables are public by definition and must never carry
  secrets.
- **Frontend safety**: CMS-rendered text is DOM-built (no HTML injection), link
  destinations pass fixed whitelists, and anonymous CMS writes are rejected
  (verified by automated probes).
- **Trading honesty**: simulated trading is clearly labelled; the demo engine
  uses server-authoritative marks. Gains on-chain execution remains disabled.
- **Logging**: request/session failures log without tokens, keys, or personal
  financial data.

## Secret-handling rules for contributors

1. Never commit credentials, keys, tokens, or production data (CI blocks this).
2. New secrets belong in `render.yaml` as `sync: false` — never as literals.
3. Document every new variable in `docs/deployment/ENVIRONMENT.md`.
4. Rotate any secret that has ever touched a non-secret channel. Deleting the
   file or commit does not make an exposed credential safe; revoke it first.
5. Local `.env` files and key material are git-ignored; only `.env.example`
   templates with placeholder values are tracked.

Repository-level protections (branch rules, secret scanning, code scanning,
dependency monitoring and Actions hardening) are listed in
[Repository security settings](docs/development/REPOSITORY_SECURITY.md).
