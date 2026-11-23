# 0056 — Terminal guide: an educational popup on the trading terminal

- **Status:** Accepted (2026-11-23)
- **Scope:** Directus content (`site_guides`, `site_guide_steps`), backend counters, website terminal, Backstage Marketing
- **Item:** batch 3, K
- **Builds on:** [ADR 0045](0045-campaigns-and-announcements.md) (campaigns and announcement bars)

## Context

New traders arrive at the terminal without knowing how to connect a wallet,
sign in, choose an account or place an order. The owner wants a short,
step-by-step guide with videos that appears on the terminal and can be
turned off. ADR 0045 bans promotional popups on the terminal and portfolio
pages, and that ban must stay.

## Decision

1. **A separate `guide` placement, not a campaign.** Guides live in their own
   Directus collections (`site_guides`, `site_guide_steps`), are managed in
   Backstage → Marketing → Terminal guide, and render only on the terminal.
   They have no CTA URL, coupon or schedule, so they cannot carry a
   promotion. `campaignPage()` still refuses campaign popups on trading pages.
2. **Steps.** Each step is a video (MP4 H.264 plus WebM, with a poster) or an
   image, a title and body in `fa` and `en` (other locales read `en`), and
   `fa`/`en` WebVTT subtitles. A guide has at most eight steps. Removing a
   step archives it, because the editor role never deletes.
3. **When it opens.** Every time the terminal is entered (one mount of the
   terminal shell), unless the visitor ticked "Don't show again" for the
   current guide version. The terminal menu (the drawer on phones and
   tablets, More on desktop) reopens it at any time. Automated browsers do
   not get the automatic opening, so other terminal tests are not interrupted;
   the guide's own test opts in.
4. **"Don't show again" is a cookie, not an identifier.** The cookie is named
   `of_guide_<id>` and holds only the version number, with `Path=/`,
   `SameSite=Lax` and `Secure` on https. Its lifetime comes from Backstage
   (default 365 days, at most 730). "Publish new version" raises the version,
   so everyone sees the guide again.
5. **Counters stay anonymous.** `POST /guides/events` increments one daily
   row per guide and version for `shown`, `completed` and `opted_out`
   (`guide_daily_stats`). The row stores no IP address, wallet, user id,
   cookie or user agent. The endpoint is rate-limited. Backstage reads the
   totals through `GET /admin/guides/stats`.
6. **Media and regions.** Media are stored in the existing publicly readable
   `campaign-media` folder. IRAN reads the guide through its own `/cms`
   snapshot (both collections are on the snapshot allowlist). Subtitles are
   fetched as text and attached as same-origin blob URLs, so cross-origin CMS
   media need no CORS mode on the video. When no content source answers, a
   bundled, published-only fallback (the seed and its media under
   `/assets/guides/`) is used.
7. **Our own footage only.** The two seeded videos are recorded by
   `scripts/guides/record-terminal-guide.mjs` from Openfund's own terminal: a
   local build with demo data, a generated EIP-1193 test wallet that never
   sends a transaction, and every address masked on screen. The script fails
   unless each video runs 30 to 60 seconds and stays under 5 MB. The MP4 is
   encoded by Chromium's MediaRecorder and the WebM by Playwright's bundled
   ffmpeg; no other encoder is required. No third-party footage is used.

## Consequences

- The terminal gains one educational modal. It is accessible: a labelled
  dialog with a focus trap, Escape to close and focus return, full screen on
  phones, 44 px targets, and no autoplay with reduced motion.
- Editors can change copy, order and media without a deploy. A new version
  intentionally shows the guide again to people who opted out.
- The seed is created only when absent and is never overwritten.

## Verification

- Backend: `apps/backend/test/guides.test.mjs` (`npm run test:guides`).
- Backstage: `apps/backstage/operations/test/guides.test.js`.
- Website unit: `apps/web-react/test/terminal-guide.test.mjs` (in `test:content`).
- Browser: `e2e/test-terminal-guide.cjs` (`npm run test:browser:terminal-guide`):
  390, 768 and 1440 px, `en`/`fa`, dark/light, reduced motion, cookie,
  menu entry, focus trap and no interruption of other automated tests.
