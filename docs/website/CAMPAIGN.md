# Sales-campaign landing

Status: implemented on branch `agent/claude/checkout-campaign-chart-trading`
(local verification; not deployed). Decision:
[ADR 0028](../decisions/0028-manual-payment-treasury-networks-campaign-chart-english-lotage.md).

## Routes and languages

- `/fa/campaign` — Persian, right-to-left; `/en/campaign` — English, left-to-right.
- Any other locale redirects to `/en/campaign`. The page is a fa/en
  publication like the whitepaper: it is indexable, listed in the sitemap for
  fa and en only, and `seoHead.ts` gives it fa/en hreflang alternates.
- Source: `apps/web-react/src/features/campaign/` (excluded from the ar/ru/zh-CN
  source inventory by design).

## Sections

Hero (headline, introduction, a genuine terminal capture, **View & buy a
challenge** → checkout, **Explore the terminal** → terminal section),
advantages (only capabilities that exist), the terminal (genuine captures of
the chart and the order ticket), prop challenges, five onboarding steps,
transparency (treasury and rules links), FAQ and a final CTA.

## Content rules

- Prices: `/purchases/plans`, the same server catalog the checkout charges.
  Rules: `src/data/challengePlans.ts`. Nothing is hard-coded.
- Images: `apps/web-react/public/assets/campaign/*.jpg`, unedited captures of
  the current build; provenance in
  [the screenshot manifest](../assets/screenshots/manifest.json). Refresh them
  when the terminal changes visibly.
- No guaranteed profit, success rates, user counts or unsourced financial
  figures; the page states that accounts are simulated and fees non-refundable.
- Every purchase CTA uses the one checkout route (`/:locale/checkout`).

## Attribution

Only `utm_source`, `utm_medium`, `utm_campaign`, `utm_content` and `utm_term`
(safe characters, ≤64) are kept for the visit (sessionStorage), appended to
checkout links and emitted as `openfund:campaign` window events
(`campaign_view`, `campaign_cta`), pushed to `window.dataLayer` when a tag
manager is installed. No wallet, email, order or other identifier is sent.
