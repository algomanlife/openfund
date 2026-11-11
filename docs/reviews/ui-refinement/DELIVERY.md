# UI refinement — eight scoped fixes

Branch `claude/ui-refinement`, 11 November 2026. Frontend only: no trading, wallet-authentication, session, payment, backend, database, contract or Directus change.

Screenshots are genuine captures of the local development build of this branch (Vite dev server, local Directus 11.9.1 seed content, a disposable injected test wallet, no backend session). Each image shows the state before the change (top or left) and after it.

| # | Change | Evidence |
| --- | --- | --- |
| 01 | Wallet chip stays level (the FAQ `summary>span` rotation no longer applies); grouped menu: wallet information, then actions; RTL page, LTR values | [desktop](01-wallet-desktop-fa.jpg), [mobile](01-wallet-mobile-fa.jpg) |
| 02, 03 | Persian card copy spacing and wrapping; decorative English labels removed from both illustrations | [desktop](02-03-landing-cards-desktop-fa.jpg), [mobile](02-03-landing-cards-mobile-fa.jpg) |
| 04, 05 | Footer partners Render and Liara; the corporate-information block replaced by the address | [footer](04-05-footer-fa.jpg) |
| 06 | Day/night theme control on the website header and terminal | [dark](06-toggle-header-dark.jpg), [light, mobile](06-toggle-header-light-mobile.jpg) |
| 07 | Economy › Referral & Rewards (same `/referral` page) | [mobile menu](07-economy-menu-mobile-fa.jpg) |
| 08 | Shared signed-out empty state in the terminal account tabs | [dark](08-terminal-empty-state-dark.jpg), [light, mobile](08-terminal-empty-state-light-mobile.jpg) |

Capture matrix: 360, 390, 768, 1024, 1440 and 1920 px across fa, en, ar, ru and zh-CN; no horizontal overflow was measured on any capture.

[Reviews index](../README.md)
