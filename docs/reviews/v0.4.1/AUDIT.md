# v0.4.1 stabilization audit (work in progress)

This is a source and public endpoint checkpoint on 2026-11-07, not a release
certificate. The branch has not been merged, published or deployed. The
v0.4.0 tag and release remain unchanged.

## Identity and production baseline

GitHub `main` and the annotated `v0.4.0` tag resolve to
`f90fac4aeeeeb86edc275320b2806d8b98b71233`. The published release
manifest and `https://openfi.cloud/version` both report frontend hash
`1b446a97ea87625f7d539a3e258ef72400c1274d403be0699b25fc7791dc851a`
and backend hash
`97b773675e010dafb245d39d81627c2947766b0094bcbfe1b53706adfc18a7ba`.
Thus the current runtime identifies as v0.4.0 and its manifest IDs match the
official manifest. This does not verify every served byte or user journey.
`/react/`, `/server/health` and `/items/pages` returned HTTP 200.

The exact public `ui_messages` query used by the React client returned HTTP
403 with Directus error: no permission to access `translations` in
`ui_messages`, or that field does not exist. Its UI translations therefore
cannot be counted as live CMS-connected. The source migration now ensures the
alias and expands an existing public permission only for that alias when
necessary; this change has **not** been applied to production.

## Source fixes and verification

| Area | Proven cause | Source change | Current evidence | Remaining gate |
| --- | --- | --- | --- | --- |
| Render build | `git fetch origin --tags` assumes a checkout remote | Resolve matching tag and published manifest through GitHub; verify digest and SHA before rebuilding | Release unit test and source inspection | Simulated remote-less Render build and official artifact comparison |
| Artifact/CMS URL | `VITE_DIRECTUS_URL` changed the built frontend and could fall back to localhost | Backend serves a no-store public runtime script; production origin validation; release scripts strip `VITE_*` inputs | Typecheck and production build passed | Full clean candidate reproducibility and browser request audit |
| CMS bootstrap | Website expansion seed was missing; production seed imported esbuild from the wrong package scope; an empty Home singleton exposed default status and was incorrectly treated as seeded | Add website seed, resolve frontend lockfile esbuild, use environment credentials, detect a real Home row by ID, repair aliases via Directus API | Disposable Directus 11.9.1 bootstrap completed; Home fa/en rows verified; final rerun created/updated no content | Production backup/schema delta and authorized migration |
| Draft isolation | Public translation tables had unfiltered direct reads | Narrow all translation reads to published parent records | Disposable draft probe was public before the fix and hidden after; published parent remained readable | Production migration and public probe |
| Terminal theme | iframe message changed document and Vela, but terminal's own theme state and icon could remain stale | Route message through terminal theme setter | Local 37-scenario auto-dark suite passed; screenshots below | Authenticated and production browser acceptance |

## Local theme QA

The source branch was served from a Vite development server at 1440×900,
anonymous, Persian Prop trading. A real Chromium click changed the outer and
iframe `data-theme` to `light`; the Vela chart existed, and both themes painted
the chart, book, order form and lower panel coherently. After reload, both
documents retained `light`. The existing auto-dark browser suite, extended to
assert the iframe's own theme toggle state, passed **37 scenarios** across
routes, OS preferences and native auto-dark. Captures:

- [Dark terminal](../../assets/screenshots/v0.4.1/prop-fa-dark.png)
- [Light terminal](../../assets/screenshots/v0.4.1/prop-fa-light.png)

The local backend was unavailable and production CMS `ui_messages` returned
403 during this browser session, so these captures do not prove version,
authenticated trading, complete content or production theme behavior.

## Public CMS record inventory

Read-only public API sampling on 2026-11-07 used `fields=id,translations.language_code`
with `limit=-1`. Counts below mean visible records with at least one translation
row for that language. They do **not** measure field completeness, component
wiring or displayed UI, so no integration or translation percentage is claimed.

| Collection | Visible records | fa rows | en rows |
| --- | ---: | ---: | ---: |
| pages | 24 | 24 | 24 |
| home_content | 1 | 1 | 1 |
| navigation_items | 18 | 18 | 18 |
| faq_categories | 6 | 6 | 6 |
| faqs | 52 | 52 | 52 |
| learning_paths | 5 | 5 | 5 |
| lessons | 25 | 25 | 25 |
| glossary_terms | 40 | 40 | 40 |
| tools | 10 | 10 | 10 |
| referral_content | 1 | 1 | 1 |
| trading_rules | 22 | 22 | 22 |
| legal_documents | 6 | 6 | 6 |
| footer_links | 10 | 10 | 10 |
| terminal_sections | 4 | 4 | 4 |
| ui_messages | unavailable: 403 for `translations` | unknown | unknown |

The requested page/field-level denominator, before/after CMS coverage
percentages, translation completeness, live edit-to-UI proof and hardcoded
field inventory remain open. No production record was changed for testing.

A source trace found that `Home.tsx` read the CMS `prop_description` and
`perpetual_description` fields but displayed two fixed Persian notes instead.
The branch now renders those fields when populated and uses language-specific
fallback notes when empty. The local Home seed's `prop_description` is empty
in both languages, so this remains a fallback in an unchanged seed. The
technical feature strip on Home still uses hardcoded editorial copy. Its
component now has English labels and caveated descriptions, but the current
English Home route uses a separate landing. This remains a CMS-coverage gap
and is not counted as a CMS connection.

A disposable CMS edit of the Persian `home_content_translations.prop_description`
appeared in the rendered Persian Home card without rebuilding the frontend;
the test restored the original empty value. This proves one concrete
record/API/client/component/UI path. `#/en/home` presents the separate English
challenge landing, so the Home singleton's English fields cannot be counted
as visible English Home integration merely because its translation row exists.
The browser edit test is `e2e/test-home-cms-edit.cjs` and refuses non-local
services or a non-CI database.

## Disposable CMS verification

Node 22.23.4, PostgreSQL 17.11 and Directus 11.9.1 were used with a newly
created local `openfund_cms_ci_v041` database. Directus bootstrap and the
backend's additive migration completed before Openfund CMS bootstrap. The
first Openfund run completed all six stages, but a field check found that
Home's empty singleton had only schema defaults and no translations. The
seed's existence test was corrected to require a real row ID; a rerun created
Home with both fa/en rows and the final bootstrap rerun created/updated no
content. The other seeds also reported zero creates/updates on their rerun
(615 `ui_messages` already present). A public `ui_messages` query returned
200 with two language rows. A new draft row's
translation was visible through the direct child endpoint before the
permission fix, and invisible afterward; a published translation remained
visible. This is local evidence only and did not touch production.

## Required gates still open

- Production backup, schema snapshot/delta, approved non-destructive
  permission migration and published-only public checks.
- Complete CMS field/UI trace for both languages and exact numerator/denominator.
- Authenticated browser theme matrix and production verification of
  desktop/mobile, RTL/LTR and market/trading flows.
- Full integrated GitHub candidate gate on the final branch, CI review and
  branch protection. A local candidate passed on the earlier `4d999e2` source;
  subsequent Home/CI changes require fresh final-branch checks.
- GitHub PR, allowed merge, official **v0.4.1** publication, Render deployment
  and post-deployment smoke tests. No official tag, published artifact checksum
  or deployment ID exists for v0.4.1 yet.
- Payment and real-wallet production acceptance require independent operational
  evidence; HTTP health alone is insufficient.

**Status:** blocked from publication and production readiness until these gates
pass. Do not run routine production CMS seeds or reset the shared database.

The first full local candidate attempt passed clean installs, documentation,
typecheck, web/backend suites, reproducible frontend builds, migrations,
authenticated layout and chart checks, then failed at `test:browser:polish`
because the test runtime used `localhost:8055` with no CMS there. The gate now
requires an explicit healthy `CMS_PUBLIC_URL` with public fa/en Home and UI
translations before running those expensive stages. This failed attempt did
not produce an official or candidate archive.

The second attempt used the disposable CMS and passed its preflight, but the
existing terminal-completion test assumed the catalog would be unavailable.
The test now explicitly blocks the catalog request for its unavailable-state
scenario; a standalone rerun passed 515 checks. A new CI CMS job uses pinned
Directus 11.9.1 and PostgreSQL 17
for clean bootstrap, bilingual reads, rerun preservation and draft isolation;
its GitHub result is still pending.

The integrated GitHub candidate now starts its own disposable Directus
instance. Official publication has a separate gate for the existing production
CMS URL. The currently observed production 403 will fail that gate until a
backed-up, reviewed permission migration repairs the public read.

The third attempt passed clean installs, source checks, both reproducible
frontend builds, migrations, backend tests and the browser audit, completion,
layout and chart suites. The polish matrix then encountered a live Gains
signal timeout in the English, light, 900px scenario. The visible result was
the explicit market-unavailable state. The release runner now uses the polish
suite's recorded market chart fixture for its visual matrix; this fixture
does not provide trading, account or live-feed acceptance. A separate public
Gains REST check returned HTTP 200, without a prolonged reconnect test.

The fourth local candidate passed all 25 recorded release stages, including
clean installs, two identical frontend builds, backend/browser suites, 2,565
polish checks, 37 auto-dark paint scenarios and the authenticated layout
matrix. `scripts/release/verify.mjs` verified its payload. Its source commit
is `4d999e222be0c85c7386c8ea2f9c33dea263f5be`, and its **unofficial**
archive SHA-256 is
`3d20657cbda26335f61ad3a346b4ec4fce855e0d2caea6024bbcc24fa8f5199f`.
This is local candidate evidence, not a GitHub Release or deployed version.

The first PR CI run exposed a shared-database assumption that the local
candidate did not exercise: Directus added an editorial metadata column to
`public.challenge_plans`, while the isolated backend engine test used
`INSERT ... SELECT *` into its backend-only schema. PostgreSQL rejected the
different column counts. The test now copies the six backend contract columns
explicitly; all 13 tests in that file passed against the locally bootstrapped
shared Directus database. A new integrated CI run is required for the fix.
