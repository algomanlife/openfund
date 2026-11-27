# On-chain records runbook (Arbitrum Sepolia)

Owner runbook for [ADR 0063](../decisions/0063-on-chain-certificates-and-trade-ledger.md):
deploying the two contracts, giving each region a recorder key, enabling the
worker and keeping it funded. Everything here runs on **Arbitrum Sepolia**
(chain id `421614`), a test network: its ETH has no value and Openfund pays
every transaction. Traders never sign or pay.

## What gets recorded

| Record | Contract | When |
| :--- | :--- | :--- |
| Challenge purchase certificate | `OpenfundCertificate.issue` (kind 1) | A purchased challenge is created |
| Free Trial start certificate | `issue` (kind 2) | A Free Trial is requested |
| Phase 1 pass certificate | `issue` (kind 3) | Phase 1 of a two-phase challenge or trial is passed |
| Challenge pass certificate | `issue` (kind 4) | A paid evaluation's final phase is passed |
| Free Trial pass certificate | `issue` (kind 5) | A Free Trial's final phase is passed |
| Payout certificate | `issue` (kind 6) | A payout is paid with final on-chain evidence |
| Evaluation outcome | `OpenfundCertificate.setStatus` | Passed, failed (rule breach) or expired |
| Position open, SL/TP change, partial close, close | `OpenfundTradeLedger.record` | Every position event on a challenge or Free Trial account |

Certificates are soulbound ERC-721 tokens (ERC-5192): they cannot be
transferred or approved. Trades are `TradeRecorded` events with the full
position data (market, side, leverage, quantity, entry and exit price, stop
loss, take profit, realized PnL, exit reason, time); prices and quantities are
fixed point with 10 decimals.

## 1. Build and test the contracts

Install [Foundry](https://book.getfoundry.sh/getting-started/installation), then:

```bash
cd packages/openfund-chain-records
forge build
forge test -vvv
```

CI runs the same `forge test` (job "Chain records contracts").

## 2. Prepare the keys

Create three keys with a wallet you control. Never paste a key into a chat,
an issue or a commit.

- **Owner key** — deploys the contracts and manages recorders. Keep it offline
  after deployment.
- **GLOBAL recorder key** — used by the Render service.
- **IRAN recorder key** — used by the Liara runtime (only if IRAN records).

Fund the owner and recorder addresses with Arbitrum Sepolia ETH from a public
faucet (bridge Sepolia ETH to Arbitrum Sepolia if a faucet only gives Sepolia
ETH). A recorder needs very little: Arbitrum Sepolia gas is cheap, but every
trade event is one transaction, so keep a buffer and watch the balance.

## 3. Deploy

```bash
export RPC=https://sepolia-rollup.arbitrum.io/rpc
export OWNER=0x...            # owner address
forge create src/OpenfundCertificate.sol:OpenfundCertificate --rpc-url $RPC --interactive \
  --broadcast --constructor-args $OWNER "https://openfi.cloud/chain/certificates/"
forge create src/OpenfundTradeLedger.sol:OpenfundTradeLedger --rpc-url $RPC --interactive \
  --broadcast --constructor-args $OWNER
```

`--interactive` asks for the owner private key instead of taking it as an
argument. The base URI makes each certificate's `tokenURI` resolve to
`GET /chain/certificates/0x<token id>` on the public site.

## 4. Allow the recorders

```bash
cast send <certificate address> "setRecorder(address,bool)" <GLOBAL recorder> true --rpc-url $RPC --interactive
cast send <ledger address>      "setRecorder(address,bool)" <GLOBAL recorder> true --rpc-url $RPC --interactive
# repeat for the IRAN recorder when IRAN records
```

## 5. Verify the source on Arbiscan

```bash
forge verify-contract <certificate address> src/OpenfundCertificate.sol:OpenfundCertificate \
  --chain 421614 --etherscan-api-key <key> \
  --constructor-args $(cast abi-encode "constructor(address,string)" $OWNER "https://openfi.cloud/chain/certificates/")
forge verify-contract <ledger address> src/OpenfundTradeLedger.sol:OpenfundTradeLedger \
  --chain 421614 --etherscan-api-key <key> --constructor-args $(cast abi-encode "constructor(address)" $OWNER)
```

A verified source lets anyone read the contract on
[sepolia.arbiscan.io](https://sepolia.arbiscan.io) and tell the official
contracts from look-alikes. Publish both addresses in the README technology
table and on the site.

## 6. Enable the worker

On Render (service `openfund`), set:

| Variable | Value |
| :--- | :--- |
| `CHAIN_RECORDS_PRIVATE_KEY` | the GLOBAL recorder key (secret) |
| `CHAIN_RECORDS_CERTIFICATE_ADDRESS` | certificate contract |
| `CHAIN_RECORDS_LEDGER_ADDRESS` | ledger contract |
| `CHAIN_RECORDS_ENABLED` | `1` |

On Liara (the app with the `engine` role), set the same with the IRAN
recorder key. Records created before enabling are already queued and are
sent first, oldest first.

## 7. Monitor

`GET /chain/status` (public) reports whether the worker is enabled, the
operator address, its balance and whether it is low, and the queue counts
(`pending`, `confirmed`, `failed`). The backend logs
`[chain-records] operator balance low` below `CHAIN_RECORDS_MIN_BALANCE_ETH`
(default 0.01). When the balance runs out, trading continues and records wait;
fund the recorder and they are sent.

A record that keeps failing is retried with backoff (10 s doubling up to one
hour) and marked `failed` after `CHAIN_RECORDS_MAX_ATTEMPTS` (default 20)
attempts. To retry failed records after fixing the cause:

```sql
UPDATE chain_records SET status = 'pending', attempts = 0, next_attempt_at = now() WHERE status = 'failed';
```

## Rotating or revoking a recorder

`setRecorder(<old>, false)` on both contracts with the owner key, allow the
new address, then replace `CHAIN_RECORDS_PRIVATE_KEY`. Records are
idempotent: a record id or certificate token is written once, so re-sending
after a rotation never duplicates anything.

## If the test network is retired

Testnets are sometimes shut down (Arbitrum Goerli was). Every record stays in
`chain_records` with its payload and transaction hash; deploying the
contracts on another network and resetting the queue
(`UPDATE chain_records SET status='pending', attempts=0, tx_hash=NULL, next_attempt_at=now()`)
re-records the full history there.

## Database access and public metadata

`chain_records` is a protected trading table in the PostgreSQL privilege
policy. Directus receives no access; the backend worker owns record updates.
Public certificate verification exposes only the network, recording status
and explorer links, never the outbox payload or worker error details.
