# Wallet and Identity

Wallet connection exposes an address and network to the browser. **SIWE authentication** verifies control of that identity and creates the backend session needed for private product APIs. Neither step submits a trade or grants spending approval.

## Connection and networks

RainbowKit, wagmi and viem provide connection, chain selection and signature requests. **The person always chooses the wallet.** The connect button opens an Openfund wallet picker that lists every browser wallet announcing itself through EIP-6963 (MetaMask, Rabby, …). The generic `window.ethereum` connector is offered, labelled "Browser wallet", only when no wallet announces itself, because it talks to whichever extension last claimed that global. Nothing is requested from a wallet before a choice.

Mobile wallets (WalletConnect QR / deep link) need a WalletConnect Cloud project id in the public runtime variable `VITE_WALLETCONNECT_PROJECT_ID` (create a free project at cloud.reown.com and add every serving origin, e.g. `https://openfund.cloud`, to its allowed domains). Without it the picker says mobile connection is not configured on this deployment; browser wallets keep working. When it is set, the picker offers "Mobile wallet (WalletConnect)", which opens the RainbowKit modal, and the CSP allows the WalletConnect Verify frame. Never commit a project id or invent a placeholder.

The product network policy is (any of the five locales — `/:locale/perpetual/*` always means Arbitrum One):

| Product | Chain | Purpose |
| --- | --- | --- |
| Prop | Ethereum Sepolia, 11155111 | SIWE sign-in context; account collateral remains virtual DAI in PostgreSQL |
| Perpetual | Arbitrum One, 42161 | SIWE context and Gains wallet-scoped reads; execution disabled |

The wallet must approve network changes and message signatures. A connected address is not itself an authenticated account. The account menu offers an explicit network switch and "Disconnect wallet".

## Errors shown to people

Wallet and SIWE failures are classified (`src/wallet/errors.ts`) instead of printing the provider's raw text:

| Situation | Shown as |
| --- | --- |
| Request declined in the wallet (EIP-1193 4001) — connection, network switch or signature | neutral status: the request was declined, try again when ready; the wallet stays connected after a declined signature |
| Request already open in the wallet (-32002) | open the extension and approve or decline it |
| Wallet locked / unauthorised (4100), unsupported method (4200), unknown network (4902), disconnected (4900/4901), extension unavailable | alert naming the action to take |
| Backend unreachable / 5xx, SIWE domain not allowed, expired or reused nonce, invalid signature, rate limited, suspended account | alert naming the cause (a domain rejection points to server configuration: `ALLOWED_DOMAINS`) |
| Session restore failure on reload | alert: the server is unreachable, reload | No private key, seed phrase or privileged CMS token belongs in the browser configuration.

## Authentication flow

The backend issues a short-lived single-use nonce (ten minutes). Verification validates the EIP-4361 message, including expected domain, URI, allowed chain, issued/expiry/not-before times and signature. Conditional nonce consumption prevents replay races. EOA verification uses viem; contract-wallet verification uses the message's chain context where applicable.

One normalized wallet address maps to one `openfund_users` identity. Successful verification issues an opaque random session cookie; only its hash is stored. Cookies are HttpOnly, SameSite=Lax and Secure in production, with server-side expiry (default seven days). Logout revokes the session; suspension blocks login and active requests. SSE revalidates session state.

## Isolation and failure handling

The server derives ownership for every private product request. Prop account IDs and Perpetual wallet references cannot be swapped through client parameters. Async frontend reads are cancelled/hidden when scope changes. Verify/logout ordering prevents late responses from restoring a previous wallet session. Disconnect revokes the backend session and clears private UI state.

Mutation origins, allowed SIWE domains and CORS must match the intended deployment. Same-origin API and `/react/` hosting keep session cookies first-party. Keep `SIM_TEST_MODE` disabled in production.

## Verification limits

Generated EIP-1193 test signers exercise actual ECDSA/SIWE and account switching; `e2e/test-wallet-connect.cjs` scripts two EIP-6963 wallets that accept or decline connection, network switch and signature. They are not evidence that real extensions, hardware wallets, remote WalletConnect or live EIP-1271 contracts have passed acceptance. Deployed HTTPS session behavior requires external runtime verification. See [Security](../security/SECURITY.md), [authentication internals](../architecture/WALLET_AUTHENTICATION.md) and [flow diagrams](../architecture/FLOWS.md#authentication).

## Verification availability

Contract-wallet verification uses the existing chain RPC with a five-second
transport timeout and no automatic transport retries. EOA signatures still use
viem's existing local recovery path. Invalid or unavailable verification remains
fail-closed; this does not enable transactions or bypass SIWE checks. This bounds
negative-signature requests that previously stalled release CI on an unavailable
public RPC. Actual contract-wallet/device acceptance remains a separate gate.
