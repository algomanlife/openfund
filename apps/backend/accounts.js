/** One account directory; each product retains its financial authority. */
import { D, SIM } from "./trading-math.js";
import { normalizeRules } from "./evaluation.js";
export async function accountDirectory(pool, engine, user) {
  const state = await engine.state(user.user_id);
  const a = state.account;
  const trials = a
    ? [
        {
          id: a.id,
          product: "prop",
          type: "free_trial",
          name: "Free Trial",
          status: a.status,
          currency: a.currency,
          startingBalance: SIM.INITIAL_BALANCE,
          balance: a.balance,
          equity: a.equity,
          netPnl:
            a.equity === null
              ? null
              : D(a.equity).minus(SIM.INITIAL_BALANCE).toFixed(2),
          profitPct:
            a.equity === null
              ? null
              : D(a.equity)
                  .minus(SIM.INITIAL_BALANCE)
                  .div(SIM.INITIAL_BALANCE)
                  .times(100)
                  .toFixed(4),
          openPositions: state.positions.length,
          pendingOrders: state.orders.length,
          source: "openfund_simulation",
          readOnly: a.status !== "active",
          lastActivity: (
            await pool.query(
              "SELECT updated_at FROM demo_accounts WHERE id=$1",
              [a.id],
            )
          ).rows[0].updated_at,
        },
      ]
    : [];
  /* challenge records: live balances from their trading accounts when
     provisioned; evaluation status drives tradability */
  const challenges = (
    await pool.query(
      `SELECT c.id, c.status, c.stage, c.account_size_usd, c.demo_account_id,
              c.created_at, c.started_at, c.expires_at, c.rules_snapshot,
              p.name, p.configuration
         FROM openfund_challenges c JOIN challenge_plans p ON p.id=c.challenge_plan_id
        WHERE c.user_id=$1 ORDER BY c.created_at`,
      [user.user_id],
    )
  ).rows;
  const challengeViews = [];
  for (const c of challenges) {
    let balance = null, equity = null, netPnl = null, profitPct = null,
        openPositions = null, pendingOrders = null, lastActivity = c.created_at,
        currency = null;
    if (c.demo_account_id) {
      const st = await engine.state(user.user_id, c.demo_account_id);
      const acc = st.account;
      if (acc) {
        balance = acc.balance;
        equity = acc.equity;
        currency = acc.currency;
        netPnl = acc.realized_pnl;
        profitPct = acc.equity === null ? null : D(acc.equity).minus(c.account_size_usd).div(c.account_size_usd).times(100).toFixed(4);
        openPositions = st.positions.length;
        pendingOrders = st.orders.length;
        lastActivity = (
          await pool.query("SELECT updated_at FROM demo_accounts WHERE id=$1", [c.demo_account_id])
        ).rows[0].updated_at;
      }
    }
    const rules = c.rules_snapshot ?? normalizeRules(c.configuration ?? {});
    const tradable = c.status === 'started';
    challengeViews.push({
      id: c.id,
      product: "prop",
      type: "challenge",
      name: c.name,
      status: c.status,
      stage: c.stage,
      phases: rules.phases ?? 0,
      currency,
      startingBalance: c.account_size_usd ? D(c.account_size_usd).toFixed(2) : null,
      balance,
      equity,
      netPnl,
      profitPct,
      openPositions,
      pendingOrders,
      tradingAccountId: c.demo_account_id,
      timeLimitDays: rules.free ? (rules.trialDaysPerPhase ?? null) : (rules.timeLimitDays ?? null),
      expiresAt: c.expires_at,
      lastActivity,
      source: "openfund_challenge_simulation",
      readOnly: !tradable,
      unavailableReason: tradable
        ? null
        : c.status === 'created'
          ? 'Challenge is provisioned. Start it to begin the evaluation.'
          : c.status === 'started'
            ? null
            : `Challenge is ${c.status}; trading is closed (history remains available).`,
    });
  }
  return {
    accounts: [
      ...trials,
      ...challengeViews,
      {
        id: `gains:arbitrum:${user.wallet_address}`,
        product: "perpetual",
        type: "perpetual",
        name: "Perpetual",
        status: "read_only",
        currency: null,
        balance: null,
        equity: null,
        netPnl: null,
        openPositions: null,
        pendingOrders: null,
        source: "gains_arbitrum",
        readOnly: true,
        unavailableReason:
          "Balances and fee-adjusted PnL are unavailable from the supported wallet read model.",
      },
    ],
  };
}
