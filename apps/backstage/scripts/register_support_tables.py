#!/usr/bin/env python3
"""
Openfund backstage — customer support queue and public contact settings (idempotent).

1. Registers the backend's support tables (created by apps/backend/schema.sql in
   the shared PostgreSQL database) as Directus collections:

     support_messages        Contact Us submissions. Operators may change ONLY
                             status, assigned_to and internal_notes; submitted
                             content is immutable (database trigger).
     support_message_events  append-only operator history written by the
                             backend admin API (read-only here).

2. Creates the "Support Agent" role + "Customer support" policy: read the queue,
   update operator fields. No create, no delete, no other customer data.

3. Adds the public contact settings to the `site_settings` singleton:
   support_email, legal_email, technical_email, community_email. An empty value
   is NOT published: the Contact Us page shows a department card without an
   email address until the owner enters a verified mailbox here.

4. Verifies the public policy has NO access to the support collections (and
   that anonymous probes are refused). The public form writes through the
   backend (POST /support/messages), never through Directus.

Usage: python3 register_support_tables.py [--url URL] [--email E] [--password P]
       (env fallbacks DIRECTUS_URL / DIRECTUS_ADMIN_EMAIL / DIRECTUS_ADMIN_PASSWORD)
Run after the backend migration (apps/backend/migrate.js) and apply_schema.py.
"""
import argparse
import json
import os
import urllib.request
import urllib.error

SUPPORT_ROLE = 'Support Agent'
SUPPORT_POLICY = 'Customer support'
PRIVATE = ('support_messages', 'support_message_events')
CONTACT_FIELDS = (
    ('support_email', 'Customer Support email (accounts, wallets, purchases, payments, invoices, activation)'),
    ('legal_email', 'Legal Department email (legal, terms, privacy requests, formal correspondence)'),
    ('technical_email', 'Technical Department email (platform bugs, terminal, charts, market data incidents)'),
    ('community_email', 'Community Relations email (proposals, partnerships, ambassadors, feedback)'),
)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--url', default=os.environ.get('DIRECTUS_URL', 'http://localhost:8055'))
    ap.add_argument('--email', default=os.environ.get('DIRECTUS_ADMIN_EMAIL'))
    ap.add_argument('--password', default=os.environ.get('DIRECTUS_ADMIN_PASSWORD'))
    a = ap.parse_args()
    if not a.email or not a.password:
        raise SystemExit('Directus admin credentials are required (--email/--password or env)')
    base = a.url.rstrip('/')

    def req(method, path, token=None, body=None, ok404=False):
        data = json.dumps(body).encode() if body is not None else None
        r = urllib.request.Request(base + path, data=data, method=method)
        r.add_header('Content-Type', 'application/json')
        if token:
            r.add_header('Authorization', f'Bearer {token}')
        try:
            with urllib.request.urlopen(r, timeout=30) as resp:
                return json.loads(resp.read() or b'{}')
        except urllib.error.HTTPError as e:
            if ok404 and e.code in (401, 403, 404):
                return None
            raise SystemExit(f'HTTP {e.code} {method} {path}\n{e.read().decode()[:400]}')

    token = req('POST', '/auth/login', body={'email': a.email, 'password': a.password})['data']['access_token']
    existing = {c['collection'] for c in req('GET', '/collections', token)['data']}

    def ensure_collection(name, meta, schema=True):
        if name in existing:
            req('PATCH', f'/collections/{name}', token, {'meta': meta})
            print(f'{name}: tracked (meta refreshed)')
        else:
            req('POST', '/collections', token, {'collection': name, 'meta': meta, 'schema': {} if schema else None})
            existing.add(name)
            print(f'{name}: tracked')

    # ---------------- support queue ----------------
    ensure_collection('support', {'icon': 'support_agent', 'sort': 95, 'note': 'Customer support queue (Contact Us form).'}, schema=False)
    ensure_collection('support_messages', {'group': 'support', 'icon': 'mail', 'sort': 1,
        'display_template': '{{reference}} · {{department}} · {{status}} · {{subject}}',
        'archive_field': 'status', 'archive_value': 'closed', 'unarchive_value': 'in_progress',
        'note': 'Contact Us submissions. Change status, assignment and internal notes only; the customer message is immutable.'})
    ensure_collection('support_message_events', {'group': 'support', 'icon': 'history', 'sort': 2, 'hidden': True,
        'note': 'Append-only operator history written by the backend admin API. Read-only.'})

    cur = {}

    def fields_of(coll):
        if coll not in cur:
            cur[coll] = {f['field']: f for f in req('GET', f'/fields/{coll}', token)['data']}
        return cur[coll]

    def meta(coll, field, m):
        if field in fields_of(coll):
            req('PATCH', f'/fields/{coll}/{field}', token, {'meta': m})

    half, full = 'half', 'full'
    statuses = [('New', 'new', '#3399FF'), ('In progress', 'in_progress', '#FFA439'), ('Waiting for customer', 'waiting_customer', '#A2B5CD'),
                ('Resolved', 'resolved', '#2ECDA7'), ('Closed', 'closed', '#6B7280')]
    readonly = ['id', 'reference', 'full_name', 'email', 'department', 'subject', 'message', 'order_ref', 'challenge_ref', 'locale',
                'user_id', 'privacy_consent_at', 'created_at', 'updated_at']
    for i, f in enumerate(readonly):
        meta('support_messages', f, {'readonly': True, 'width': full if f in ('message', 'subject') else half, 'sort': i + 1,
                                     **({'interface': 'input-multiline'} if f == 'message' else {}),
                                     **({'hidden': True} if f == 'id' else {})})
    meta('support_messages', 'status', {'interface': 'select-dropdown', 'required': True, 'width': half, 'sort': 30, 'display': 'labels',
        'options': {'choices': [{'text': t, 'value': v, 'color': c} for t, v, c in statuses]},
        'display_options': {'choices': [{'text': t, 'value': v, 'foreground': '#FFFFFF', 'background': c} for t, v, c in statuses]},
        'note': 'New → In progress → Waiting for customer → Resolved → Closed. Closed is final.'})
    meta('support_messages', 'assigned_to', {'interface': 'input', 'width': half, 'sort': 31, 'note': 'Operator handling this request.'})
    meta('support_messages', 'internal_notes', {'interface': 'input-multiline', 'width': full, 'sort': 32,
        'note': 'Internal only — never shown to the customer. Append; do not paste secrets or wallet keys.'})
    for f in fields_of('support_message_events'):
        meta('support_message_events', f, {'readonly': True})

    # ---------------- public contact settings ----------------
    if 'site_settings' not in existing:
        raise SystemExit('site_settings is missing — run apply_schema.py first')
    for field, note in CONTACT_FIELDS:
        if field not in fields_of('site_settings'):
            req('POST', '/fields/site_settings', token, {'field': field, 'type': 'string', 'schema': {'is_nullable': True},
                'meta': {'interface': 'input', 'width': 'half', 'options': {'placeholder': 'leave empty until the mailbox is verified'},
                         'validation': {'_and': [{field: {'_regex': r'^$|^[^@\s]+@[^@\s]+\.[^@\s]+$'}}]},
                         'note': note + '. Empty = not published on the Contact Us page.'}})
            cur.setdefault('site_settings', {})[field] = {'field': field}
            print(f'  field site_settings.{field}: created')

    # ---------------- role + policy ----------------
    pols = req('GET', '/policies?limit=-1', token)['data']
    pol = next((p for p in pols if p['name'] == SUPPORT_POLICY), None)
    if not pol:
        pol = req('POST', '/policies', token, {'name': SUPPORT_POLICY, 'icon': 'support_agent', 'app_access': True, 'admin_access': False,
            'enforce_tfa': True, 'description': 'Read the Contact Us queue; update status, assignment and internal notes. No create, no delete, no financial data.'})['data']
        print(f'policy {SUPPORT_POLICY}: created')
    roles = req('GET', '/roles?limit=-1', token)['data']
    role = next((r for r in roles if r['name'] == SUPPORT_ROLE), None)
    if not role:
        role = req('POST', '/roles', token, {'name': SUPPORT_ROLE, 'icon': 'support_agent', 'description': 'Customer support operators (Directus Data Studio).'})['data']
        print(f'role {SUPPORT_ROLE}: created')
    if not req('GET', f'/access?filter[role][_eq]={role["id"]}&filter[policy][_eq]={pol["id"]}', token)['data']:
        req('POST', '/access', token, {'role': role['id'], 'policy': pol['id']})
        print('  policy attached to role')
    wanted = [
        ('support_messages', 'read', ['*']),
        ('support_messages', 'update', ['status', 'assigned_to', 'internal_notes']),
        ('support_message_events', 'read', ['*']),
        ('directus_users', 'read', ['id', 'first_name', 'last_name']),
        ('directus_revisions', 'read', ['*']), ('directus_activity', 'read', ['*']),
    ]
    have = {(p['collection'], p['action']): p for p in req('GET', f'/permissions?limit=-1&filter[policy][_eq]={pol["id"]}', token)['data']}
    for coll, action, fields in wanted:
        if (coll, action) in have:
            req('PATCH', f"/permissions/{have[(coll, action)]['id']}", token, {'fields': fields})
        else:
            req('POST', '/permissions', token, {'policy': pol['id'], 'collection': coll, 'action': action, 'fields': fields, 'permissions': {}, 'validation': {}})
    print(f'policy {SUPPORT_POLICY}: {len(wanted)} permissions (no create/delete)')

    # ---------------- public policy: contact settings readable, queue private ----------------
    pub = next(p for p in pols if p['name'].startswith('$t:public') or 'public' in p['name'].lower())
    leaked = [p['collection'] for p in req('GET', f'/permissions?limit=-1&filter[policy][_eq]={pub["id"]}', token)['data'] if p['collection'] in PRIVATE]
    if leaked:
        raise SystemExit(f'public policy has access to support collections: {leaked}')
    for coll in PRIVATE:
        if req('GET', f'/items/{coll}?limit=1', ok404=True) is not None:
            raise SystemExit(f'anonymous read of {coll} succeeded — refusing')
        if req('POST', f'/items/{coll}', body={}, ok404=True) is not None:
            raise SystemExit(f'anonymous write to {coll} succeeded — refusing')
    print('public access to support collections: NONE ✓ (anonymous read/write probes refused)')


if __name__ == '__main__':
    main()
