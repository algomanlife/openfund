# Controlled challenge acceptance

Status: **In Progress** until the owner accepts the two lineages in an
isolated runtime. See the pull request for automated evidence. Use a fresh
test database for each acceptance run.

## Operator setup

Start the unified app against a disposable PostgreSQL database with the
current schema and plan seeds. Use the existing `ADMIN_API_TOKEN` for that
runtime. Select its GLOBAL home region. Each tester first signs in with their
intended wallet so the wallet is registered. Use disposable wallet addresses
and keep the operator token and coupon codes private.

Set `OPENFUND_URL` to the test runtime origin. Set `OPERATOR_NAME` to the
operator name to record in the audit trail. Load `ADMIN_API_TOKEN` from the
test runtime's secret store into the current shell. Set `INSTANT_WALLET` and
`TWO_STEP_WALLET` to the registered wallets. The same wallet can be used for
both profiles.

### Test A — Instant Funding

Run once and pass the returned `code` privately to the Instant tester.

```sh
curl --fail-with-body -sS -X POST "$OPENFUND_URL/admin/coupons/controlled" \
  -H "Authorization: Bearer $ADMIN_API_TOKEN" \
  -H "X-Admin-Actor: $OPERATOR_NAME" -H 'Content-Type: application/json' \
  --data "{\"profile\":\"instant\",\"walletAddress\":\"$INSTANT_WALLET\"}"
```

### Test B — Two-Step Evaluation

The catalog calls the Two-Step model **Standard**. Run once and pass the
returned `code` privately to the Two-Step tester.

```sh
curl --fail-with-body -sS -X POST "$OPENFUND_URL/admin/coupons/controlled" \
  -H "Authorization: Bearer $ADMIN_API_TOKEN" \
  -H "X-Admin-Actor: $OPERATOR_NAME" -H 'Content-Type: application/json' \
  --data "{\"profile\":\"standard\",\"walletAddress\":\"$TWO_STEP_WALLET\"}"
```

Each call returns HTTP 201, the coupon ID, the code and its expiry. Each slot
is reserved once per database. A code expires in seven days and allows one
successful checkout. A repeated issue returns HTTP 409. Verify the wallet
before issuing. Use a fresh isolated database to repeat a completed run.

## Trader checkout and owner checklist

1. Sign in with the registered wallet and open **Challenges**. Choose
   **Instant** for Test A or **Standard** for Test B, select the account size
   and continue to checkout. Enter the receipt details, accept the checkout
   terms, enter the matching code and select **Apply**. Confirm the amount
   due is zero. Select **Activate challenge** and confirm the receipt and
   owned account appear. Repeat with the other tester and code. Check that
   another wallet, the other model and a second activation are rejected.
2. For Instant, open Prop and trade the already active account. Verify the
   normal loss, trade validation and conduct controls through the terminal.
   Close every position and cancel pending orders before checking eligibility
   in **Prop → Withdrawals**. The payout cycle opens immediately once the
   remaining checks pass. The published 15% best-day consistency rule and
   1% minimum profit still apply. One profitable day alone cannot qualify.
   Automated acceptance replays seven days of engine-generated realized
   trades in a disposable database to test this without waiting. For manual
   acceptance with unmodified timestamps, spread profit across enough
   trading days to meet consistency.
3. For Standard, start the evaluation from the Prop dashboard. Realize at
   least 1% net on each phase. Confirm that Phase 2 opens after Phase 1
   and that the final pass awaits manual review.
4. Use `GET /admin/rewards/reviews` with the operator bearer token. Find the
   final-pass row marked `test_mode: true`. Approve with
   `POST /admin/rewards/reviews/<phase-2-challenge-id>`, the same auth and
   actor headers, and JSON `{"decision":"approve","note":"Controlled test verified"}`.
   In **Prop → Withdrawals**, choose and activate the **Weekly** cycle on
   the funded account. Verify the account starts at its funded virtual
   balance. Trade and close for eligible profit. The payout-cycle wait is
   waived. News coverage, deductions and other applicable controls remain.
5. Use **Request simulated payout**. In the operator page at
   `/en/operations/payouts`, supply the test token and operator name, choose
   **Test** under **Payout scope** and refresh. Review the calculation.
   Reject one request with a reason, confirm that the virtual profit returns,
   and use **Messages** to request reconsideration from the trader page.
   Reply and record the reconsideration outcome in the operator view. Submit
   a fresh request, approve it and select **Complete simulated settlement**.
   Confirm the trader history reads **Simulated settlement completed** and
   that completion does not debit the virtual balance a second time.
6. Inspect `GET /admin/coupons/controlled` for both redemptions, phase
   accounts and simulated payout outcomes. Inspect
   `GET /admin/withdrawals/<id>/audit` for the named operator decisions.
   Confirm the real payout queue and public real payout totals omit test
   entries, and that there are no chain hashes, payment records, verified
   payout certificates, allocation journal entries, treasury receivables,
   fee refunds, IB entitlements, partner commissions or live eligibility
   from either test lineage.

## Cleanup and archive

Finish or reject any outstanding test payout reviews and close any remaining
test positions and orders. Revoke each entitlement through
`POST /admin/coupons/controlled/instant/revoke` and
`POST /admin/coupons/controlled/standard/revoke` using the same operator
headers. Revocation closes checkout access, including for an unused code.
It retains issued accounts and history.

Export the controlled report and payout audit records to the owner's private
acceptance archive. Omit codes and operator tokens from evidence. Stop the
isolated runtime. Retain a backup of its database if audit retention requires
it, then retire that disposable database. Keep production data and credentials
outside this procedure.

## Automated acceptance

The commerce suite uses the actual order, evaluation and withdrawal engine
with an isolated PostgreSQL database and deterministic marks. The browser
suite uses both normal checkouts with generated SIWE signers and exercises
the Standard funded payout in the live React runtime. The regional suite
verifies that signed replication preserves the test marker and final
simulated settlement in the peer's read model. Controlled lineages stay in
their issuing region and are excluded from regional ownership handoff.
