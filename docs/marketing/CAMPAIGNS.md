# Promotional campaigns and announcement bars

Owner guide and technical reference. The design is recorded in
[ADR 0045](../decisions/0045-campaigns-and-announcements.md).

## Where

**Backstage → Marketing**:

- **Promotional campaigns.** Popups that open after a delay on public pages.
- **Announcement banners.** A bar above the site header.

Every write asks for the owner password. Visitors see only records that are
*published* and *active*, inside their start and end times (UTC).

## Fields

| Field | Meaning |
| --- | --- |
| Internal name | Identifier, `a-z`, `0-9`, `-` |
| Template (popup) | *Split*: image on one side, headline, text and button on the other. *Image with call to action*: one image with the headline and button |
| Style (bar) | Mint, Neutral or Notice |
| Priority | The highest eligible record is shown |
| Starts / Ends at | UTC; empty means no limit |
| Languages | **Eligibility.** The record appears only in these languages, and each needs its own copy. There is no fallback to another language |
| Regions | GLOBAL, IRAN or both |
| Pages | All public pages, Home, Challenges, Information pages. Checkout, purchases, sign-in, profile and trading pages never show campaigns |
| Button destination | `https://…` (opens in a new tab when it is another site) or a site path such as `/fa/checkout?plan=standard` |
| Coupon code | A reference to an existing public coupon. With a site-path destination, the button carries `?coupon=` and checkout prices it on the server |
| Delay (popup) | 3–120 seconds of *visible* time (pauses while the tab is hidden); default 12 |
| Show (popup) | Once per browser session, or once per interval of N days. At most one popup per session in any case |
| Images (popup) | PNG, JPEG or WebP up to 3 MB, stored in the Directus folder `campaign-media`; an optional mobile image |

Closing a bar hides it for the rest of the browser session.

## Rules that protect visitors and the business

- Publishing is refused when an eligible language has no headline, when a
  destination has no button label, or when the coupon is not currently
  promotable (inactive, expired, not started, used up, restricted to named
  customers, or an internal test coupon). A live campaign whose coupon stops
  being valid disappears from the site, and reactivating it is refused.
- Text is plain: markup is refused. Destinations must be `https://` or a site
  path: `javascript:`, `data:`, `http:` and protocol-relative links are refused.
- Directus never prices anything. Discounts come from the coupon engine at
  checkout.

## Counters

Impressions, clicks, closes and click-through rate per record (last 90 days)
appear in each list. They are anonymous daily counts
(`campaign_daily_stats`): no IP address, wallet or user id is stored. Each
event is counted at most once per page view.

## The Persian Iran-access bar

The CMS bootstrap creates `iran-access-fa` once: Persian only, GLOBAL region,
all public pages, one button (Persian label meaning "Enter Openfund Iran") → `https://openfi.live/`.
Editors may change or retire it; a later bootstrap never overwrites it. If no
content source answers at all, the site shows this same Persian bar from a
built-in fallback; other languages show nothing.

## Technical reference

| Piece | Location |
| --- | --- |
| Directus collections, public permissions, `campaign-media` folder, seed | `apps/backstage/scripts/apply_schema.py` |
| Editor role permissions (no deletes) | `apps/backstage/scripts/register_backstage_editor.py` |
| Backstage API and validation | `apps/backstage/operations/campaigns.js`; UI `public/marketing.js` |
| Backend counters and coupon check | `apps/backend/campaigns.js`, table `campaign_daily_stats` |
| Site selection, frequency, counters | `apps/web-react/src/features/campaigns/` |
| IRAN delivery | `/cms` snapshot allowlist (`apps/backend/cms-snapshot.js`) |
| Tests | `apps/backend/test/campaigns.test.mjs`, `apps/backstage/operations/test/campaigns.test.js`, `apps/web-react/test/ui-refinement.test.mjs`, `e2e/test-campaigns.mjs` (CI job *Campaigns and announcements*) |

After deployment, run the CMS bootstrap and `register_backstage_editor.py`
against production Directus (owner step) before using Marketing.
