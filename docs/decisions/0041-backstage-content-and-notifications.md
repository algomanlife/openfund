# ADR 0041 — Backstage content editing and in-app notifications

- **Status:** Accepted for the source tree (branch `agent/claude/launch-completion`). Not deployed.
- **Date:** 2026-11-17

## Context

Owners edited website copy only in Directus Studio, and traders had no
in-product channel for operator replies or decisions. Support replies were
not delivered anywhere, and no outbound mail infrastructure exists.

## Decision

1. **Content editing stays in Directus.** Backstage gains a Content
   workspace that reads and writes the same Directus records through one
   server-held static token of a dedicated *Backstage Content Editor* user.
   The role's permissions are generated from the website's editorial catalog
   (no deletes, no forbidden collections). Backstage validates every write
   again: owner session, CSRF, password re-entry, GLOBAL region, an
   allowlisted collection and text field, plain text, placeholders equal to
   the English source. The editorial catalog is generated into
   `content-registry.json` from `editorialRoutes.ts` and
   `editorialSurfaces.ts`, so Backstage cannot drift from the site.
2. **The site may be framed only by named origins.** `frame-ancestors`
   includes the configured CMS origin (visual editing) and optional exact
   origins from `CSP_EXTRA_FRAME_ANCESTORS` (the Backstage preview). The
   preview never receives editing attributes because the adapter trusts only
   the CMS origin.
3. **Notifications are additive operational records.** A `notifications`
   table with a unique dedupe key; emitters are payout decisions, support
   replies and a read-only relay over recorded `challenge_events`. Delivery
   is in-app by polling. External channels implement an adapter interface and
   are owner-configured; none is enabled.
4. **Support threads** reuse the payout-thread model on `support_messages`.

## Consequences

- No new service, no change to financial tables or engine logic.
- A Directus token now exists on the Backstage service; its scope is limited
  by the role and by Backstage's own validation.
- Email delivery of support replies remains a future owner decision.
