/** One account directory; each product retains its financial authority. */
import { D, SIM } from './trading-math.js'
export async function accountDirectory(pool, engine, user) {
  const state = await engine.state(user.user_id)
  const a = state.account
  const trials = a ? [{id:a.id,product:'prop',type:'free_trial',name:'Free Trial',status:a.status,currency:a.currency,
    startingBalance:SIM.INITIAL_BALANCE,balance:a.balance,equity:a.equity,netPnl:a.equity === null ? null : D(a.equity).minus(SIM.INITIAL_BALANCE).toFixed(2),
    profitPct:a.equity === null ? null : D(a.equity).minus(SIM.INITIAL_BALANCE).div(SIM.INITIAL_BALANCE).times(100).toFixed(4),
    openPositions:state.positions.length,pendingOrders:state.orders.length,source:'openfund_simulation',readOnly:a.status!=='active',
    lastActivity:(await pool.query('SELECT updated_at FROM demo_accounts WHERE id=$1',[a.id])).rows[0].updated_at}] : []
  const challenges = (await pool.query(`SELECT c.id,c.status,c.created_at,p.name,p.configuration
    FROM openfund_challenges c JOIN challenge_plans p ON p.id=c.challenge_plan_id WHERE c.user_id=$1 ORDER BY c.created_at`,[user.user_id])).rows
  return {accounts:[...trials,...challenges.map(c=>({id:c.id,product:'prop',type:'challenge',name:c.name,status:c.status,
    currency:null,startingBalance:null,balance:null,equity:null,netPnl:null,openPositions:null,pendingOrders:null,
    phase:null,lastActivity:c.created_at,source:'challenge_record',readOnly:true,unavailableReason:'Challenge execution is not activated.'})),
    {id:`gains:arbitrum:${user.wallet_address}`,product:'perpetual',type:'perpetual',name:'Perpetual',status:'read_only',
      currency:null,balance:null,equity:null,netPnl:null,openPositions:null,source:'gains_arbitrum',readOnly:true,
      unavailableReason:'Balances and fee-adjusted PnL are unavailable from the supported wallet read model.'}]}
}
