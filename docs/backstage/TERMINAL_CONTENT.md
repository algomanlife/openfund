# Terminal editorial administration

Use the existing Directus instance. Run `python3 apps/backstage/scripts/seed_terminal_content.py` with DIRECTUS_URL/DIRECTUS_ADMIN_EMAIL/DIRECTUS_ADMIN_PASSWORD supplied server-side. Default local-dev credentials follow the existing setup scripts. The default is additive and preserves editor changes. `--refresh-product-copy` explicitly refreshes only this script's product records; it was used for the user's 2026-11-02 presentation correction.

- Existing `pages` / `page_translations`: dashboard, Portfolio, Journal and informational headings, descriptions and SEO (fa/en).
- Existing `ui_messages` / translations: `products.*` explanatory/empty-state/help copy, fa/en, published-only.
- New normalized `terminal_sections` / `terminal_section_translations`: product, page, stable section_key, sort, draft/published/archived status, optional illustration file and HTTPS support/education URL; per-language title/body. Administrators can create/reorder sections, replace images, publish/unpublish and edit independently in each language.
- The Terminal trading tab deliberately **does not render pages or editorial sections**, so CMS editing cannot add banners, introductions or cards around the workspace. Operational control labels and account data remain in the terminal runtime/adapters.

The script extends the existing Public policy with read-only published parent filtering and parent-status filtering on section translations. It does not grant public journal/user/account/trade access. No new public file-wide permission is granted: illustrations must already be readable under the existing approved media policy. Upload/replace an approved image in Directus and select it in the illustration field. Missing/inaccessible media does not grant access to private files.

The React client fetches public content with no token, a 20-second shared cache and refreshes mounted sections every 30 seconds. Published edits and unpublishing appear without rebuilding. Preview uses Directus draft editing plus the local product preview; there is no new public draft-preview token flow. Financial balances, live PnL, execution, prices, risk and eligibility never come from these editorial collections.

Customer-facing content uses product/account language. Engineering readiness, third-party implementation gaps and deployment status belong in developer documentation and PR review, not marketing banners.
