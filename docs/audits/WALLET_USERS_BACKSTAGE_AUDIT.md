# Audit — Wallet Users & Backstage (Phase 1)

> Audit date: 2026-11-01 · Branch: `qwen/wallet-identity` (from `qwen/footer-addresses`, PR #8 pending)
> **RESUME FILE for the wallet-identity task.** Continue from the first unchecked item.

## Subsystem status

| # | Subsystem | Status | Evidence |
|---|---|---|---|
| 1 | React 19 + Vite + TS app (`apps/web-react`) | **Operational & verified** | Playwright E2E 18/18 on dev :5173 + build :4173; hash router `#/`, `#/terminal`; legacy runtime embedded with per-page reload teardown |
| 2 | Landing page (bilingual fa/en, themes, motion) | **Operational & verified** | E2E: theme/lang/dir/arrows/anchors; content editable via Directus (FA + EN values live) |
| 3 | Trading terminal (Vela workspace + Gains data) | **Operational & verified** | 488 markets REST, WS ~90 upd/s, workspace pinned LTR, trade panel right; status bar rebuilt (clock/version/data/support) |
| 4 | RainbowKit + wagmi + viem (connection only) | **Operational & verified** | RainbowKit 2.2.11 / wagmi 2.19.5 / viem 2.57.13; custom bilingual `ConnectButton.Custom`; modal styled (`styles.css` imported) and translated to fa; Arbitrum Sepolia 421614; falls back to `createConfig` + injected connector without `VITE_WALLETCONNECT_PROJECT_ID` |
| 5 | Directus backstage (CMS) | **Operational & verified** | Directus 11.9.1 + PostgreSQL 17 local (brew) + docker compose; 489 `ui_messages` (fa/en, section/label); nav, pages, site_settings; public read = published only; no tokens in frontend |
| 6 | CMS client & fallback | **Operational & verified** | `apps/web-react/src/cms/client.ts` (mirror `packages/cms-client`): one request, 2.5 s timeout, static fallback tested with backstage stopped |
| 7 | Wallet-based authentication (SIWE) | **Missing** | No nonce endpoint, no signature verification, no session; wallet connection IS currently treated as "connected" UI state only — no login |
| 8 | Session management | **Missing** | No backend, no cookies, no logout lifecycle |
| 9 | Openfund user identity records | **Missing** | Only Directus system users exist; no business `users` table, no wallet uniqueness |
| 10 | Challenge records / plans | **Missing** | Landing shows marketing presets only; no `challenges`/`challenge_plans` persistence |
| 11 | Dedicated backend service | **Missing** | No auth/ownership boundary beyond Directus public read policy |
| 12 | Gains trading contracts | **Planned** | Public market-data API only; on-chain SDK vendored, unused — no orders |
| 13 | Deployment (compose for full stack) | **Partial** | Directus compose exists; app + backend not containerized yet |

## Security findings

- **S1 (high):** wallet connection is presented as identity without cryptographic proof — the exact gap this task closes (SIWE).
- **S2 (info):** no privileged tokens in the frontend today; public Directus policy is read-only, published-only. Keep it that way.
- **S3 (info):** local Directus credentials are dev-only (`infrastructure/directus/.env`, gitignored); CORS open to :5173/:4173 origins.
- **S4 (medium, new surface):** the planned backend must own SIWE + sessions + ownership checks; Directus stays an admin data interface, not the auth boundary.

## Integration gaps & plan

1. **Backend** (`apps/backend`, Node + Express): `/auth/nonce`, `/auth/verify` (EIP-4361 SIWE, viem `verifySiweMessage`, EIP-1271 where feasible), HttpOnly session cookies (SameSite=Lax, signed, 7 d, rotation), `/auth/logout`, `/me`, `/me/challenges`; ownership enforced per-request; rate limiting; audit log table.
2. **PostgreSQL tables** (created via Directus so admins see them, written by the backend over SQL): `users` (uuid pk, unique normalized wallet, status, display_name, timestamps), `challenges` (user fk, plan fk, lifecycle timestamps), `challenge_plans` (slug, name, config JSON). Unique wallet ⇒ one identity per wallet.
3. **Directus admin UX**: collections visible to Administrator role only; public role gets **no** permission on these tables; suspension via a controlled field (enforced by backend reads of `status`).
4. **Frontend**: `SessionContext` — states: disconnected → connecting → connected-unauthenticated → signing → authenticated (+ wrong network / expired / failed). Sign once per session; profile panel with challenge list (empty state included); account-switch and disconnect invalidate the session.
5. **Tests**: backend SIWE unit tests (valid / bad signature / nonce reuse / expired nonce / wrong domain / wrong chain) with a programmatic viem wallet; E2E: user create/retrieve/duplicate-block, multi-challenge ownership isolation, suspension, regression of landing/terminal/CMS/RainbowKit.

> Honest-testing note: automated wallet flows use a real ECDSA account (viem local account), not a browser extension. Browser-extension signing was exercised manually.

## Progress checklist (resume)

- [x] Phase 1 — this audit
- [x] Phase 2 — README (English, 25 sections) + Directus/RainbowKit representation
- [x] Phase 3 — backend SIWE + sessions (`apps/backend`, Node 22 + Express + viem/siwe)
- [x] Phase 4 — users / challenges / challenge_plans (schema.sql + seed-plans.js)
- [x] Phase 5 — Directus user/challenge admin (register_user_tables.py; public policy: no permission, verified FORBIDDEN)
- [x] Phase 6 — frontend session UX (useOpenfundSession + ProfilePanel + sign-in chip; profile with challenge list + empty state)
- [x] Phase 7 — security hardening (single-use nonces, domain/chain binding, HttpOnly hashed-id cookies, rate limits, audit_log, suspension enforcement, account-switch invalidation)
- [x] Phase 8 — tests: SIWE matrix 22/22, full-stack session E2E 11/11 (real ECDSA signer via mock EIP-1193 + EIP-6963), regression 18/18 + round-6 9/9 on dev AND build
- [x] Phase 9 — docs: USER_IDENTITY, WALLET_AUTHENTICATION, DATABASE_SCHEMA (architecture), USER_MANAGEMENT (backstage), README, CHANGELOG, FEATURE_STATUS
- [ ] Phase 10 — PR (this branch → PR #9)

Testing honesty: automated wallet flows use a programmatic secp256k1 signer
(production cryptographic path), not a browser extension.
