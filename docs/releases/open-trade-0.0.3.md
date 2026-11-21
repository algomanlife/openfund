# Open Trade 0.0.3 — release notes (candidate, not published)

Open Trade's version is independent of the Openfund platform version. Tag when
published: `open-trade-v0.0.3` (desktop tags never reuse platform tags).

**Status: candidate with internal unsigned CI builds; not published.**
On main `adbdeabd`, build, desktop UI acceptance, packaging and checksum
verification passed for macOS arm64/x64, Windows x64 and Linux x64.
The macOS x64 installer upload failed after five GitHub request timeouts;
the other targets uploaded successfully.
[CI evidence](https://github.com/algomanlife/openfund/actions/runs/44880940066).
Signing jobs were skipped. Signed/notarized distribution, real-wallet acceptance
and clean-machine installation/upgrade acceptance remain pending. The website download manifest still lists
only the verified 0.0.2 builds; add 0.0.3 entries with
`scripts/release/open-trade-releases.mjs` after the owner publishes the release.
Blockers: [delivery report](../reviews/open-trade-0.0.3/DELIVERY.md#remaining-blockers).

## What changes

- **Prop and Perpetual in one desktop session.** The account selector now has
  two separated sections: *PROP — Simulated Trading* (the wallet's real Prop
  accounts) and *PERPETUAL — Gains Account* (read-only). Switching products
  keeps the wallet session, stops the other product's stream or polling,
  clears its data and restores each product's own chart layout. The active
  product is shown in the title bar.
- **Read-only Gains account view.** Open positions, open orders and the latest
  100 history events from `/products/perpetual/gains`, with source, network,
  freshness (up to date / stale / inconsistent / outdated / unavailable) and
  verified Arbiscan transaction links. Snapshots for another wallet or without
  `readOnly: true` are discarded. No order, approval or collateral transfer
  exists in the desktop; balances and P&L Gains does not provide stay "—".
- **Wallet sign-in hardening.** Missing or malformed WalletConnect Project ID
  is reported and disables Connect Wallet; rejected, expired, relay, chain and
  mismatch failures have localized messages; a failed sign-in disconnects the
  half-open pairing; switching wallet address or ending the pairing signs the
  desktop out; listeners no longer accumulate across sign-ins. Pairing alone
  never authenticates.
- **Five locales.** Persian (RTL, Dastkhat), English, Arabic (RTL, Dastkhat
  Arabic), Russian and Simplified Chinese, chosen in Settings or on the start
  screen and persisted. Arabic, Russian and Chinese reuse the web terminal's
  reviewed dictionaries; 123 desktop-only strings per locale have drafts
  awaiting review and are shown in English with a visible notice until approved.
- **Configuration and security.** Packaged builds connect only to
  `https://openfi.cloud` or `https://openfi.live`; backend responses over 4 MiB
  or not JSON objects are refused; external links are an allowlist (exact-commit
  source link for AGPL Corresponding Source, validated Arbiscan and release
  pages); the session token still never reaches the renderer.
- **Updates.** No automatic installation. The app checks GitHub Releases for a
  newer `open-trade-v*` tag on its channel and offers *View release* or *Later*.
- **About.** Version, commit, channel, signing state and server in Settings.
  The version comes from `package.json` only.
- **Packaging.** `internal` builds are named `…-internal-unsigned-…`;
  `beta`/`stable` builds must sign (and notarize on macOS) or packaging fails.
  CI builds macOS arm64 and x64 on separate native runners, Windows x64 and
  Linux x64, and verifies checksums and signatures on the building runner.

## Not in this release

Live Gains execution, automatic updates, signed Linux packages, a desktop
performance baseline (harness added, not yet run) and full Gains history
paging in the desktop.
