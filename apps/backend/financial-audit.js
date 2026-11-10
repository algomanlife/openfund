/** Append-only financial audit trail writer (financial_audit_log). */
export const financialAudit = (db, actor, action, entity, entityId, before, after) =>
  db.query('INSERT INTO financial_audit_log (actor, action, entity, entity_id, before, after) VALUES ($1,$2,$3,$4,$5,$6)',
    [actor, action, entity, entityId == null ? null : String(entityId), before == null ? null : JSON.stringify(before), after == null ? null : JSON.stringify(after)])
