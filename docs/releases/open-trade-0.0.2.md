# Open Trade 0.0.2 (beta, unsigned) — release preparation

Open Trade is the lightweight Openfund desktop workspace. Its version (0.0.2)
is independent of the Openfund web platform version (v0.6.5 candidate).

**Status: prepared, not published.** Publishing a GitHub Release needs the
owner's approval. Until then the website shows these builds as "awaiting
release approval" and offers no download.

## Assets (verified 2026-11-15)

Built from `76512b53501e2c4c63e168c14b1f725b1e3fd353` by
[CI run 43611941782](https://github.com/algomanlife/openfund/actions/runs/43611941782),
which passed the desktop acceptance test on each operating system. The
artifacts were downloaded and each SHA-256 matched the run's `SHA256SUMS.txt`.

| Platform | Architecture | File | Bytes | SHA-256 |
| --- | --- | --- | --- | --- |
| macOS | arm64 | `Open-Trade-0.0.2-beta-unsigned-mac-arm64.dmg` | 123102751 | `0159708add92e3e9c1e22be9efc84778635d30f684de308f5938319e6a3ba540` |
| macOS | x64 | `Open-Trade-0.0.2-beta-unsigned-mac-x64.dmg` | 127208223 | `b81b1e8c70a3ca73df394d07f36529b0da3256cb8191d17db329153ba72bdfbf` |
| Windows | x64 | `Open-Trade-0.0.2-beta-unsigned-win-x64.exe` | 123186356 | `bbcb600e7e11396ccd1dff3d0c8a9ce484c3fb1405f92723b7017dbe414d156f` |
| Linux | x64 | `Open-Trade-0.0.2-beta-unsigned-linux-x86_64.AppImage` | 127864761 | `de1f82b27144d4c7ef1a7735ce6ea7a6ffa994bd53f833f8c304b2068c0093f0` |
| Linux | x64 (amd64) | `Open-Trade-0.0.2-beta-unsigned-linux-amd64.deb` | 102430624 | `8b9ec5f714fe0820426b9ce68f49bc46dd941d50f96846ed6f62ebd86d9285cc` |

Checks performed:

- File formats: two compressed DMG images, an NSIS installer (`PE32`
  installer stub for an x64 app), an x86-64 ELF AppImage, a Debian 2.0 package.
- Metadata: both DMGs contain `Open Trade.app`, `cloud.openfund.opentrade`,
  version 0.0.2, binaries `arm64` and `x86_64` respectively; the Debian
  package is `open-trade 0.0.2 amd64`.
- Runtime: the arm64 app launched from the DMG on macOS reached the start
  screen in 3.7 s, reported version 0.0.2, and its renderer has no Node access.
  Windows, Linux and Intel macOS start-up evidence is the CI acceptance run on
  each operating system.

## Signing (do not misrepresent)

None of the installers is signed for distribution:

- macOS arm64 has only an ad-hoc signature and x64 is unsigned; Gatekeeper
  rejects both. Users must open them with Control-click → Open (or remove the
  quarantine attribute). Not notarized.
- Windows: the installer is not code-signed; SmartScreen will warn.
- Linux: no package or AppImage signature.

Proper distribution needs an Apple Developer ID with notarization and a
Windows code-signing certificate — owner decisions with cost and identity
implications.

## Known limitations

From `apps/open-trade/ACCEPTANCE.md`: real-wallet sign-in needs a confirmed
WalletConnect project ID; the Perpetual account UI, footprint forwarding and
signed auto-updates are not delivered.

## Publication (owner action)

1. Download the five files from the CI run above and verify them:
   `shasum -a 256 -c SHA256SUMS.txt` with the table above.
2. Publish a **pre-release** whose tag is separate from the platform's
   `vMAJOR.MINOR.PATCH` tags:

   ```sh
   gh release create open-trade-v0.0.2 --repo algomanlife/openfund \
     --target 76512b53501e2c4c63e168c14b1f725b1e3fd353 --prerelease \
     --title "Open Trade 0.0.2 (beta, unsigned)" \
     --notes-file docs/releases/open-trade-0.0.2.md \
     Open-Trade-0.0.2-beta-unsigned-*.dmg Open-Trade-0.0.2-beta-unsigned-*.exe \
     Open-Trade-0.0.2-beta-unsigned-*.AppImage Open-Trade-0.0.2-beta-unsigned-*.deb SHA256SUMS.txt
   ```

3. Fill the website download manifest from the verified build record and
   commit it through a reviewed PR:

   ```sh
   node scripts/release/open-trade-releases.mjs open-trade-v0.0.2 <YYYY-MM-DD>
   ```

   The website validator accepts only assets of this repository's releases,
   so download buttons appear only for the published files.
