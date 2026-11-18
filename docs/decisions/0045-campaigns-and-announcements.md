# ADR 0045 — Promotional campaigns and announcement bars on one content model

- **Status:** Proposed (implemented on branch `agent/claude/campaigns`; owner review pending)
- **Date:** 2026-11-18
- **Builds on:** [ADR 0033](0033-regional-authority-and-synchronization.md) (regions and the `/cms` snapshot), the Directus content architecture in `AGENTS.md`.

## Context

The owner needs to run promotional popups and site-wide announcements, change
them without a deploy, and target them by language, region, page and schedule.
The existing Iran access notice was a long, hard-coded, all-locale component
with several links. It needed to become a short, Persian-only bar with one call
to action, managed from Backstage.

## Decision

1. **One Directus collection, two placements.** `site_campaigns` (with
   `site_campaign_translations`) holds both `modal` (promotional popup) and
   `announcement_bar` records. Their behavior and counters stay separate.
2. **Eligibility is explicit.** `locales` lists the languages a record may
   appear in, and it needs copy in each of them. The site never falls back to
   another language: a Persian-only bar is never shown in English. The route
   language decides, never IP or Geo-IP.
3. **Delivery uses the existing content path.** The public role reads only
   `published` and `active` records. IRAN reads them through the backend's
   `/cms` snapshot, already approved for cross-region content (`site_campaigns`
   is added to its allowlist). Nothing financial crosses regions. When no
   source answers, only the Persian Iran-access bar has a built-in fallback.
4. **Backstage writes, with server validation.** Backstage → Marketing
   (`apps/backstage/operations/campaigns.js`) writes through the restricted
   editor token after owner password re-entry. It enforces enums, plain text,
   https-or-same-site destinations, image signatures and publication rules
   (copy in every eligible locale). The editor role gets no deletes.
5. **Coupons stay in the backend.** A campaign stores a coupon *code*. The
   backend's `GET /campaigns/coupons/:code` reports whether that code is
   public, active, inside its window and not used up. Backstage refuses to
   publish or reactivate a campaign whose coupon is not promotable, and the
   site hides such a campaign. Checkout prices it on the server as before.
6. **Media.** Images go to a single Directus folder, `campaign-media`. Only
   that folder is publicly readable; other files stay private.
7. **Privacy-conscious counters.** `campaign_daily_stats` holds anonymous daily
   impressions, clicks and closes per campaign and placement. No IP address,
   wallet, user id or user agent is stored.

## Consequences

- Campaign changes go live within the CMS cache window (about 20 s), with no
  deploy.
- The hard-coded Iran notice is removed; the seed creates the equivalent
  Persian bar once, and later edits are never overwritten.
- `CSP_EXTRA_CONNECT` now also extends `img-src`, so a local non-HTTPS CMS can
  serve campaign images (production CMS is HTTPS and needs nothing).
- Directus permissions change in two places: Public reads published
  campaigns and the `campaign-media` folder, and the Backstage editor role
  writes campaigns without deletes. Both are applied by the existing
  bootstrap scripts.
