# Security Policy

## Reporting a vulnerability

Report security issues privately to the repository owner (GitHub security
advisory: Security → Report a vulnerability). Do not open public issues for
suspected vulnerabilities.

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
  scanned. `VITE_*` variables are public by definition and must never carry
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
4. Rotate any secret that has ever touched a non-secret channel.
