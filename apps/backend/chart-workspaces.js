/**
 * Openfund — per-wallet chart workspaces (Vela chart state).
 *
 * The owner is ALWAYS the authenticated session's user (requireAuth →
 * req.user.user_id); no wallet address or user id is read from the request.
 * Each entry is one (workspace, scope) document:
 *   scope '*'      workspace-wide chart settings (timeframe, indicators,
 *                  chart style, renderer config, drawing-tool defaults)
 *   scope <symbol> that market's user drawings
 * Writes use optimistic concurrency: the client sends the revision it last
 * saw (`baseRevision`, 0 to create); a mismatch returns 409 with the stored
 * entry so the client can reconcile instead of overwriting newer state.
 * Payloads are size-limited; live position overlays are never stored.
 */
import { Router } from 'express'

export const WORKSPACE_RE = /^[a-z0-9_-]{1,32}$/
export const SCOPE_RE = /^(\*|[A-Za-z0-9._:/-]{1,64})$/
export const MAX_ENTRY_BYTES = 200 * 1024
export const MAX_ENTRIES = 120
export const SCHEMA_VERSION_MAX = 1000

const fail = (status, error) => Object.assign(new Error(error), { status })
const wrap = fn => (req, res, next) => Promise.resolve(fn(req, res)).catch(next)
const view = r => ({ scope: r.scope, schemaVersion: r.schema_version, revision: Number(r.revision), data: r.data, updatedAt: r.updated_at })

export function chartWorkspaceRoutes({ pool, requireAuth, limit = () => (req, res, next) => next() }) {
  const router = Router()
  /* A terminal document is bound to ONE identity. It sends that identity
     (x-openfund-chart-user); if the session cookie now belongs to someone
     else (a wallet switch while an old document still flushes a save), the
     request is refused instead of writing one wallet's chart into another's
     workspace. Ownership itself still comes only from the session. */
  const sameIdentity = (req, res, next) => {
    const claimed = req.headers['x-openfund-chart-user']
    if (claimed !== undefined && claimed !== req.user.user_id) return res.status(409).json({ error: 'identity_mismatch' })
    next()
  }
  const params = req => {
    const { workspace } = req.params
    const scope = req.params.scope === undefined ? undefined : decodeURIComponent(req.params.scope)
    if (!WORKSPACE_RE.test(workspace || '')) throw fail(400, 'invalid_workspace')
    if (scope !== undefined && !SCOPE_RE.test(scope)) throw fail(400, 'invalid_scope')
    return { workspace, scope }
  }

  /* the whole workspace for the signed-in wallet */
  router.get('/chart/workspaces/:workspace', requireAuth, sameIdentity, limit(120), wrap(async (req, res) => {
    const { workspace } = params(req)
    const { rows } = await pool.query(
      `SELECT scope, schema_version, revision, data, updated_at FROM chart_workspaces
        WHERE user_id=$1 AND workspace=$2 ORDER BY scope`, [req.user.user_id, workspace])
    res.set('Cache-Control', 'no-store').json({ workspace, entries: rows.map(view) })
  }))

  /* save one entry (create with baseRevision 0, update with the last seen revision) */
  router.put('/chart/workspaces/:workspace/:scope', requireAuth, sameIdentity, limit(240), wrap(async (req, res) => {
    const { workspace, scope } = params(req)
    const { data, schemaVersion = 1, baseRevision } = req.body || {}
    if (!data || typeof data !== 'object' || Array.isArray(data)) throw fail(400, 'invalid_data')
    const sv = Number(schemaVersion)
    if (!Number.isInteger(sv) || sv < 1 || sv > SCHEMA_VERSION_MAX) throw fail(400, 'invalid_schema_version')
    const base = Number(baseRevision)
    if (!Number.isInteger(base) || base < 0) throw fail(400, 'invalid_revision')
    const json = JSON.stringify(data)
    if (Buffer.byteLength(json) > MAX_ENTRY_BYTES) throw fail(413, 'workspace_too_large')
    const uid = req.user.user_id
    const current = async () => (await pool.query(
      `SELECT scope, schema_version, revision, data, updated_at FROM chart_workspaces WHERE user_id=$1 AND workspace=$2 AND scope=$3`,
      [uid, workspace, scope])).rows[0]
    let row
    if (base === 0) {
      const { rows: [{ n }] } = await pool.query('SELECT count(*)::int AS n FROM chart_workspaces WHERE user_id=$1 AND workspace=$2', [uid, workspace])
      if (n >= MAX_ENTRIES) throw fail(413, 'workspace_entry_limit')
      row = (await pool.query(
        `INSERT INTO chart_workspaces (user_id, workspace, scope, schema_version, revision, data)
         VALUES ($1,$2,$3,$4,1,$5::jsonb) ON CONFLICT DO NOTHING
         RETURNING scope, schema_version, revision, data, updated_at`, [uid, workspace, scope, sv, json])).rows[0]
    } else {
      row = (await pool.query(
        `UPDATE chart_workspaces SET data=$5::jsonb, schema_version=$4, revision=revision+1, updated_at=now()
          WHERE user_id=$1 AND workspace=$2 AND scope=$3 AND revision=$6
          RETURNING scope, schema_version, revision, data, updated_at`, [uid, workspace, scope, sv, json, base])).rows[0]
    }
    if (!row) {
      const cur = await current()
      return res.status(409).json({ error: 'stale_revision', current: cur ? view(cur) : null })
    }
    res.json({ scope: row.scope, revision: Number(row.revision), updatedAt: row.updated_at })
  }))

  return router
}
