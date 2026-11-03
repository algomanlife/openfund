# Wallet and Identity

Wallet connection exposes an address and network to the browser. **SIWE authentication** verifies control of that identity and creates the backend session needed for private product APIs. Neither step submits a trade or grants spending approval.

## Connection and networks

RainbowKit, wagmi and viem provide connection UI, chain selection and signature requests. An optional public `VITE_WALLETCONNECT_PROJECT_ID` enables the remote wallet list; absent configuration falls back to injected wallets. The product network policy is:

| Product | Chain | Purpose |
| --- | --- | --- |
| Prop | Ethereum Sepolia, 11155111 | SIWE sign-in context; account collateral remains virtual DAI in PostgreSQL |
| Perpetual | Arbitrum One, 42161 | SIWE context and Gains wallet-scoped reads; execution disabled |

The wallet must approve network changes and message signatures. A connected address is not itself an authenticated account. No private key, seed phrase or privileged CMS token belongs in the browser configuration.

## Authentication flow

The backend issues a short-lived single-use nonce (ten minutes). Verification validates the EIP-4361 message, including expected domain, URI, allowed chain, issued/expiry/not-before times and signature. Conditional nonce consumption prevents replay races. EOA verification uses viem; contract-wallet verification uses the message's chain context where applicable.

One normalized wallet address maps to one `openfund_users` identity. Successful verification issues an opaque random session cookie; only its hash is stored. Cookies are HttpOnly, SameSite=Lax and Secure in production, with server-side expiry (default seven days). Logout revokes the session; suspension blocks login and active requests. SSE revalidates session state.

## Isolation and failure handling

The server derives ownership for every private product request. Prop account IDs and Perpetual wallet references cannot be swapped through client parameters. Async frontend reads are cancelled/hidden when scope changes. Verify/logout ordering prevents late responses from restoring a previous wallet session. Disconnect revokes the backend session and clears private UI state.

Mutation origins, allowed SIWE domains and CORS must match the intended deployment. Same-origin API and `/react/` hosting keep session cookies first-party. Keep `SIM_TEST_MODE` disabled in production.

## Verification limits

Generated EIP-1193 test signers exercise actual ECDSA/SIWE and account switching. They are not evidence that real extensions, hardware wallets, remote WalletConnect or live EIP-1271 contracts have passed acceptance. Deployed HTTPS session behavior requires external runtime verification. See [Security](../security/SECURITY.md), [authentication internals](../architecture/WALLET_AUTHENTICATION.md) and [flow diagrams](../architecture/FLOWS.md#authentication).

## Verification availability

Contract-wallet verification uses the existing chain RPC with a five-second
transport timeout and no automatic transport retries. EOA signatures still use
viem's existing local recovery path. Invalid or unavailable verification remains
fail-closed; this does not enable transactions or bypass SIWE checks. This bounds
negative-signature requests that previously stalled release CI on an unavailable
public RPC. Actual contract-wallet/device acceptance remains a separate gate.
