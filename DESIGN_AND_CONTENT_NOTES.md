# Openfund Persian prop-firm landing page

Revised 2026-10-30. The user clarified that Openfund's business is the same prop-firm / trader-funding category as Carrot Funding. They selected: use Carrot's fees, rules and Hyperliquid temporarily as examples, to revise later.

## Scope
- Replaced the earlier generic terminal marketing page with a Persian RTL trader-funding landing page.
- Preserved the existing Openfund emblem geometry. `mark-mint.svg` changes only its fill from lime to #75E4AA for this page.
- Background #030605, mint #75E4AA, green translucent cards, restrained green atmospheric light.
- Existing local Vazirmatn font and its license remain bundled.
- No copied competitor testimonials, wallet records, revenue, funding or payout totals. No competitor signup/payment/social links.
- No payments, authentication, challenge creation, real accounts or wallet connectivity. All plan selection is browser-local; dialogs explicitly identify sample terms.

## Reference sources inspected
- https://carrotfunding.io/ — business structure and visual reference.
- https://carrotfunding.io/challenges/ — the Start/Standard/1-Phase preset fee tables.
- https://carrotfunding.io/rulebook/ — current targets, rolling loss window, simulated-account disclosure.
- https://carrotfunding.io/faq/ — general concept only. This page contained older numerical terms conflicting with the rulebook; those numbers were not used.

## Sample price data used
Start (2 phases, 60% split, 3% max loss, 3% daily loss, 10% lifetime payout cap): 5k $11; 10k $14; 20k $26.
Standard (2 phases, 80% split, 6% max loss, 3% daily loss, no lifetime cap): 10k $25; 50k $149; 100k $309.
1-Phase (80% split, 3% max loss, 3% daily loss, no lifetime cap): 10k $79; 50k $339; 100k $549.
These are the source's preset tables, not an invented pricing formula. They are explicitly non-final sample terms for Openfund. The homepage builder's differently priced named presets were not mixed into this model.

## Validation
JavaScript syntax checked. Actual browser checks cover preset selection, account-size updates, review modal, close/Escape, arithmetic and invalid calculator input, market categories, FAQ, mobile menu, local assets and anchor targets. Desktop and 390px mobile layouts inspected. This verifies the presentation, not a funding or payment service.

## Prior version
The original site is retained in Git history at 5d909c63d0360590bf3b4415859917d2618d304e and separately backed up as ../Openfund_Landing_FA-before-prop-redesign.zip.
