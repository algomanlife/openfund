# Open Trade 0.0.3 — owner setup

What the repository owner must create or approve before Open Trade 0.0.3 can
be signed and published. Everything else is already in source
([release notes](open-trade-0.0.3.md), [delivery report](../reviews/open-trade-0.0.3/DELIVERY.md)).

Never paste a credential into a pull request, issue, commit, chat or CI log.
Secrets go only into GitHub **environment secrets** (Settings → Environments).

## 1. Accounts to create

| Account | Needed for | Cost / approval |
| --- | --- | --- |
| Reown (WalletConnect) Dashboard — <https://dashboard.reown.com> | Wallet pairing QR / deep link | Free tier exists; check the plan's monthly active-connection limits |
| Apple Developer Program (organization) — <https://developer.apple.com/programs/enroll/> | Developer ID signing + notarization (macOS arm64 and x64) | Paid yearly membership; organization enrollment needs a D-U-N-S number and legal-entity verification |
| Microsoft Artifact Signing (formerly Trusted Signing) in Azure — <https://learn.microsoft.com/azure/artifact-signing/> **or** an OV/EV Authenticode certificate from a trusted CA | Windows x64 installer and binaries | Paid; Artifact Signing requires publisher identity validation and is not available to every country or entity type — confirm eligibility first |
| GitHub environments `open-trade-signing` and `open-trade-release` with required reviewers | Gate signing and draft-release jobs | Free; owner configures (agents may not change repository settings) |

## 2. Project IDs and values

| Name | Public or secret | Where it belongs | Absent → |
| --- | --- | --- | --- |
| `OPEN_TRADE_WALLETCONNECT_PROJECT_ID` (32 hex chars) | **Public** application identifier | GitHub repository **variable** (Settings → Variables); embedded in `out/config.json` at build | Connect Wallet is disabled with "Wallet connection is unavailable in this build"; charts and restored sessions still work |
| `OPEN_TRADE_BACKEND` | Public | Workflow env (fixed `https://openfi.cloud`) | Defaults to `https://openfi.cloud`. Packaged builds refuse any non-canonical origin and exit with an error |
| `OPEN_TRADE_IRAN_APPROVED=1` | Public operator flag (runtime env) | Only after the Iran runtime shares accounts and trading state (ADR 0043) | Iran option stays disabled with an explanation |
| `OPEN_TRADE_CHANNEL` | Public | Workflow input (`internal`, `beta`, `stable`) | `internal`: unsigned build named `internal-unsigned` |
| `OPEN_TRADE_MAC_CSC_LINK` | **Secret** (base64 `.p12` of the Developer ID Application certificate + key) | Environment secret `open-trade-signing` | Signed macOS job fails before packaging |
| `OPEN_TRADE_MAC_CSC_KEY_PASSWORD` | **Secret** | same | same |
| `OPEN_TRADE_APPLE_API_KEY` (contents or path of `AuthKey_<id>.p8`) | **Secret** | same | Notarization required → job fails |
| `OPEN_TRADE_APPLE_API_KEY_ID`, `OPEN_TRADE_APPLE_API_ISSUER` | Secret (treat as secret) | same | same |
| `OPEN_TRADE_AZURE_TENANT_ID`, `OPEN_TRADE_AZURE_CLIENT_ID`, `OPEN_TRADE_AZURE_CLIENT_SECRET` | **Secret** (service principal with the *Artifact Signing Certificate Profile Signer* role) | same | Signed Windows job fails |
| `OPEN_TRADE_WIN_SIGN_ENDPOINT`, `OPEN_TRADE_WIN_SIGN_ACCOUNT`, `OPEN_TRADE_WIN_SIGN_PROFILE` | Public | Environment **variables** of `open-trade-signing` | same |
| `OPEN_TRADE_WIN_PUBLISHER` | Public; must equal the certificate subject CN exactly | Environment variable | same |

Values that are public: the Project ID, backend origins, channel, Azure
endpoint/account/profile names and publisher name. Everything marked secret
stays in the protected environment and is never written to artifacts:
`scripts/release-plan.mjs` only checks presence; electron-builder and
`Invoke-TrustedSigning` read the values.

## 3. Reown project configuration

1. Create a project of type *WalletKit/AppKit* named **Open Trade by Openfund**.
2. Metadata: name "Open Trade by Openfund", homepage `https://openfi.cloud`,
   icon: the Openfund mark served at `https://openfi.cloud/assets/mark-mint.svg`.
   Some wallets do not render SVG icons; if a wallet shows a blank icon, the
   owner should publish an approved PNG export of the existing mark (no new
   logo) and the source will point to it.
3. Domain allowlist ("Allowed domains" / Verify API): add `openfi.cloud`. The
   desktop sends `https://openfi.cloud` as its metadata URL in every region.
4. Copy the Project ID into the repository variable
   `OPEN_TRADE_WALLETCONNECT_PROJECT_ID`.

Verify: build with the variable set, open Settings → About (channel and
version), start Connect Wallet — a QR modal must appear. Scan with a real
wallet on Arbitrum One, approve the pairing, then approve the sign-in message;
the startup screen must show the wallet address and both product sections.
Record the wallet app, version and OS in `ACCEPTANCE.md`. Pairing approval
alone must never sign you in.

## 4. Apple

Fields: Team ID (10 characters), "Developer ID Application: <Legal Name> (<TEAMID>)"
certificate exported as `.p12`, App Store Connect API key (Key ID, Issuer ID,
`.p8`, role *Developer* or higher). Bundle ID `cloud.openfund.opentrade` is
fixed in `electron-builder.yml`; keep it for keychain/session continuity.

Verify: dispatch *Open Trade desktop* with `channel=beta` on `main`. The
`signed` job runs `scripts/verify-signatures.mjs`, which requires
`codesign --verify --deep --strict`, a Developer ID authority, the hardened
runtime flag, a stapled ticket on the `.app` and an `spctl` pass. Then install
the DMG on a clean Mac with Gatekeeper on and record the result. Docs:
<https://developer.apple.com/developer-id/>,
<https://developer.apple.com/documentation/security/notarizing-macos-software-before-distribution>,
<https://www.electron.build/docs/notarization>.

## 5. Windows

Either Artifact Signing (endpoint, account, certificate profile, publisher CN,
service principal) or a CA certificate (environment secrets
`OPEN_TRADE_WIN_CSC_LINK` / `OPEN_TRADE_WIN_CSC_KEY_PASSWORD`; hardware-token
EV certificates cannot be used on hosted runners). The workflow installs the `TrustedSigning`
PowerShell module; pin `-RequiredVersion` after the first verified run.

Verify: the `signed` job checks `Get-AuthenticodeSignature` = `Valid` with a
timestamp. Then install on a clean Windows 11 VM and upgrade over 0.0.2.
SmartScreen reputation is not removed by signing alone; record what users see.
Docs: <https://www.electron.build/docs/features/code-signing/code-signing-win>.

## 6. Linux

No signing account is needed. AppImage/deb integrity is the SHA-256 manifest
attached to the release; Open Trade does not claim signed Linux packages.

## 7. Openfund decisions

- Publisher identity (legal name used for Apple, Windows and the deb maintainer).
- First-party licence decision and indicator redistribution rights
  ([licence decision](../legal/LICENSE_DECISION.md), blockers 2 and 3).
- Third-party attribution approval (Vela NOTICE, PineTS AGPL Corresponding
  Source = the tagged commit, WalletConnect Community License, Ubuntu and
  Dastkhat font licences — all shipped under `assets/notices/`).
- Reviewed Arabic, Russian and Simplified Chinese desktop strings: approve
  entries from `apps/open-trade/src/i18n-desktop/drafts/` into `reviewed/`.
- Real-device acceptance sign-off (wallet, installers, upgrade).
- Iran region readiness.
- Explicit public-release authorization.

## 8. What needs approval or payment

Apple membership, Windows signing service/certificate and any Reown paid plan
cost money. Creating GitHub environments, dispatching a signed run,
publishing the draft release and enabling `OPEN_TRADE_IRAN_APPROVED` require
the owner.

## 9. What agents can do without the owner

Source changes, tests, CI workflow edits, internal unsigned builds from CI,
documentation, translation drafts and pull requests. Agents cannot create
credentials, change repository settings or environments, dispatch signed
runs, publish releases or tags, or claim real-device acceptance.
