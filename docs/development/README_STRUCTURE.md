# README structure contract

The root `README.md` is a short, current entry point. Deep detail lives in
`docs/` and is **linked, never duplicated**. The shape below is enforced on
every commit by `npm run docs:check` (and therefore CI) through three
dependency-free gates. The machine-readable source of this contract is
[`scripts/docs/lib/readme-contract.mjs`](../../scripts/docs/lib/readme-contract.mjs);
`check-readme.mjs` fails if this page's numbered list drifts from it.

## Sections (exact, in order)

Before the first section: the title block (logo, `# Openfund`, tagline,
automatic badges) and one paragraph saying what Openfund is, with its links.
No other heading may appear before the first section.

1. `## Project overview`
2. `## Product ecosystem`
3. `## Feature status`
4. `## Product gallery`
5. `## Business model`
6. `## Technical architecture`
7. `## Technology stack`
8. `## Development workflow`
9. `## Versioning and releases`
10. `## Security`
11. `## License`
12. `## Retired and no longer used`
13. `## Contributing`

No other `##` section, no duplicates, no skipped heading levels.

## Rules (`scripts/docs/check-readme.mjs`)

| Rule | What fails |
| --- | --- |
| Structure | A section missing, added, renamed, duplicated or out of order; an orphan heading before the first section; a heading that skips a level |
| One responsibility per section | Platform versions outside *Versioning and releases*; font names outside *Technology stack*; diagrams outside *Technical architecture*; license terms outside *License*; vulnerability reporting outside *Security*; images outside the title and *Product gallery* (generated blocks are exempt) |
| Budgets | More than 350 lines or 1,500 words in total, or more than 70 lines in one section |
| Freshness | A hand-written `vX.Y.Z` that is not the latest official release or the declared next release in [docs/status/status.json](../status/status.json); a dated gallery/capture heading |
| Single source | A section that drops its required link to the document that owns its detail (for example *Feature status* → `docs/status/README.md`, *Technology stack* → the design system's typography section) |
| Links | A local link or image that does not resolve, or a missing heading anchor |
| Generated blocks | A block that is missing, outside its section or stale |

## Generated blocks

| Block | Section | Source | Regenerate |
| --- | --- | --- | --- |
| `<!-- status:summary -->` | Feature status | [docs/status/status.json](../status/status.json) | `node scripts/docs/status.mjs` |
| `<!-- gallery -->` | Product gallery | [docs/assets/gallery/gallery.json](../assets/gallery/gallery.json) | `node scripts/docs/check-readme.mjs --write` |
| `<!-- license:summary -->` | License | [THIRD_PARTY_NOTICES.md](../../THIRD_PARTY_NOTICES.md) | `node scripts/docs/check-readme.mjs --write` |
| `<!-- retired:summary -->` | Retired and no longer used | [RETIRED.json](RETIRED.json) | `node scripts/docs/check-retired.mjs --write` |

Edit the source, regenerate, commit both. Never hand-edit inside a block.

## Retired registry (`scripts/docs/check-retired.mjs`)

[RETIRED.json](RETIRED.json) lists every retired, legacy-only and dormant
item with its replacement and the patterns that identify it. For an item with
status `retired`, CI fails if any active file, text or archive entry still
references it (dated evidence under the registry's `historical` paths is
exempt), or if `THIRD_PARTY_NOTICES.md`'s active table lists it. The gate
renders [RETIRED.md](RETIRED.md) and the README block. Retiring something
means adding it here in the same pull request that removes it.

## Font gate (`scripts/docs/check-fonts.mjs`)

Only two faces exist: **Ubuntu** (general/Latin) and **Dastkhat** (`Dastkhat`,
`Dastkhat Arabic`, `Dastkhat FaNum`; the only Persian/Arabic face). CI fails on
any retired font file, any retired face in a font context (CSS, canvas,
`FontFace`, Office `typeface`, Google Fonts URL, PDF font names, archives), any
`@font-face`/`FontFace` naming another family, or a Persian/Arabic
`@font-face` outside the one shared
[`dastkhat.css`](../../apps/web-react/public/assets/fonts/dastkhat/dastkhat.css).
Policy: [design system › typography](../design/DESIGN_SYSTEM.md#typography-and-font-tokens).

## Where detail lives

| README section | Owning documents |
| --- | --- |
| Product ecosystem | [Platform tour](../product/PLATFORM_TOUR.md) |
| Feature status | [docs/status](../status/README.md), [feature register](../product/FEATURE_STATUS.md) |
| Product gallery | [gallery.json](../assets/gallery/gallery.json), [capture requirements](../assets/gallery/CAPTURE_REQUIREMENTS.md), [screenshot manifest](../assets/screenshots/manifest.json) |
| Business model | [Business model in detail](../economy/BUSINESS_DETAIL.md), [ECONOMY.md](../../ECONOMY.md) |
| Technical architecture | [Architecture](../architecture/ARCHITECTURE.md), [platform reference](../architecture/PLATFORM_REFERENCE.md) |
| Technology stack | [Tech stack](../architecture/TECH_STACK.md), [design system](../design/DESIGN_SYSTEM.md) |
| Versioning and releases | [Release runbook](../deployment/RELEASES.md), [CHANGELOG](../../CHANGELOG.md) |
| Security | [SECURITY.md](../../SECURITY.md), [remediation report](../security/SECURITY-REMEDIATION-2026-11.md) |
| License | [Licensing](../legal/LICENSING.md), [THIRD_PARTY_NOTICES](../../THIRD_PARTY_NOTICES.md) |
| Retired and no longer used | [RETIRED.md](RETIRED.md) |

## Changing the contract

Change `scripts/docs/lib/readme-contract.mjs` and this page together, in a
reviewed pull request, with the reason in the description. Do not weaken a
rule to make a README edit pass; move the detail into `docs/` instead.
