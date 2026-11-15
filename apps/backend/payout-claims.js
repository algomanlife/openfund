export const CLAIM_PATH = '/sync/v1/payout-claim'
const fail = (status, message) => Object.assign(new Error(message), { status })

export async function claimPayoutTransaction(db, { hash, requestId, region }) {
  const inserted = await db.query(
    `INSERT INTO payout_transaction_claims(tx_hash,request_id,home_region) VALUES ($1,$2,$3)
     ON CONFLICT DO NOTHING RETURNING request_id`, [hash, requestId, region])
  if (inserted.rowCount) return
  const { rows: [existing] } = await db.query(
    'SELECT request_id,home_region FROM payout_transaction_claims WHERE tx_hash=$1', [hash])
  if (existing?.request_id !== requestId || existing.home_region !== region)
    throw fail(409, 'payout_transaction_already_claimed')
}

export function createPayoutClaimClient(sync, signedHeaders) {
  return async (db, { hash, requestId }) => {
    if (sync.region === 'GLOBAL') return claimPayoutTransaction(db, { hash, requestId, region: 'GLOBAL' })
    if (sync.region !== 'IRAN' || !sync.peerUrl) throw fail(503, 'payout_claim_authority_unavailable')
    const body = Buffer.from(JSON.stringify({ hash, requestId }))
    let response
    try {
      response = await fetch(sync.peerUrl + CLAIM_PATH, {
        method: 'POST', body, headers: signedHeaders(sync, 'POST', CLAIM_PATH, body),
        signal: AbortSignal.timeout(5000), redirect: 'error',
      })
    } catch { throw fail(503, 'payout_claim_authority_unavailable') }
    if (response.status === 409) throw fail(409, 'payout_transaction_already_claimed')
    if (response.status !== 204) throw fail(503, 'payout_claim_authority_unavailable')
  }
}
