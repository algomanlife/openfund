# Engineering roadmap

Engineering priorities protect financial truth, ownership and reliable operations. [Milestones](MILESTONES.md) supply the status, dependency and acceptance register.

## Preserve the delivered foundations

F1/F2 and T1/T2 require ongoing regression coverage: same-origin routes, Vela attribution/lifecycle, Gains freshness and reconnect, Decimal settlement, fee-aware margin, idempotency, partial-close provenance and unknown stale values. X1/X2 require product/account isolation, journal version checks, export safety, published-only CMS and Persian/English product parity.

## Finish release evidence

X3 closes the gap between generated signers and actual extension/hardware/remote-wallet acceptance. I2 exercises authenticated Blueprint validation, deployed HTTPS cookies, CMS content, engine/SSE recovery, migrations, backup and restore. I3 defines observable failure signals, alert ownership, dependency triage, incident handling and privacy/retention decisions. Local tests cannot substitute for these external gates.

## Extend with explicit contracts

A1 needs scoped order semantics, risk/retry rules and analytically justified metrics. A2 needs supported network/contract references, fee/collateral correctness, simulation, wallet rejection/revert/receipt handling and reconciliation. A3 cannot proceed without genuine market-depth/trade data.

P1/P2 must isolate venue adapters and route authority from existing Prop simulation. E1 needs versioned developer interfaces and rate/authorization policies. E2 needs load evidence and an engine lock/lease or equivalent coordination design before increasing API instances; the current Render service intentionally runs one engine process.

## Maintenance acceptance

Every capability transition updates product docs, feature status, relevant milestone and architecture contract. Significant UI changes refresh genuine screenshots. New env variables update Blueprint ownership, `.env.example` and the environment register. Migrations remain additive; dependency/source provenance and required notices remain intact. See [Contributing](../../CONTRIBUTING.md).
