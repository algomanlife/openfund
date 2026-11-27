# Openfund chain records

Two Solidity contracts that make Openfund challenges and Free Trials publicly
verifiable on **Arbitrum Sepolia** ([ADR 0063](../../docs/decisions/0063-on-chain-certificates-and-trade-ledger.md)).

| Contract | Purpose |
| :--- | :--- |
| [`OpenfundCertificate`](src/OpenfundCertificate.sol) | Soulbound (non-transferable) ERC-721 certificates, ERC-5192 `locked`: challenge purchase, Free Trial start, phase 1 pass, final pass, Free Trial pass and payout, each with an evaluation status |
| [`OpenfundTradeLedger`](src/OpenfundTradeLedger.sol) | `TradeRecorded` events for every position event of a challenge or Free Trial account: open, stop-loss / take-profit change, partial close, close |

Both are written by Openfund recorder keys (one per region) under an owner
key ([`RecorderAccess`](src/RecorderAccess.sol)). A repeated record id or
token id is a no-op, so retries never duplicate records. Traders never sign
or pay.

The backend queues records in the database and sends them
(`apps/backend/chain-records.js`); the contracts hold no funds.

```bash
forge build
forge test -vvv
```

No libraries or remappings are needed. Deployment, recorder keys and
verification on Arbiscan: [runbook](../../docs/operations/CHAIN_RECORDS.md).

License: Apache-2.0, like the rest of Openfund's own code.
