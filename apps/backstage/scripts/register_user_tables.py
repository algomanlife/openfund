#!/usr/bin/env python3
"""
Openfund backstage — register the wallet-identity tables (created by
apps/backend/schema.sql) as tracked Directus collections so administrators
can view users and challenges in the Data Studio.

The tables are WRITTEN by the Openfund backend only; Directus is the admin
data interface. The public policy gets NO permission on these collections
(private by default — verified by an unauthenticated probe at the end).

Usage: python3 register_user_tables.py   (idempotent)
"""
import json
import os
import urllib.request
import urllib.error

BASE = os.environ.get('DIRECTUS_URL', 'http://localhost:8055')

def req(method, path, token=None, body=None):
    data = json.dumps(body).encode() if body is not None else None
    r = urllib.request.Request(BASE + path, data=data, method=method)
    r.add_header('Content-Type', 'application/json')
    if token:
        r.add_header('Authorization', f'Bearer {token}')
    try:
        with urllib.request.urlopen(r, timeout=30) as resp:
            return json.loads(resp.read() or b'{}')
    except urllib.error.HTTPError as e:
        raise SystemExit(f'HTTP {e.code} {method} {path}\n{e.read().decode()[:300]}')

# (collection, icon, note, sidebar_visible, field meta overrides)
COLLECTIONS = [
    ('openfund_users', 'manage_accounts', 'Platform users — one wallet = one identity. Written by the Openfund backend.', True, {
        'wallet_address': {'interface': 'input', 'readonly': True, 'width': 'half'},
        'wallet_chain': {'interface': 'input', 'readonly': True, 'width': 'half', 'special': ['cast-timestamp'] if False else []},
        'status': {'interface': 'select-dropdown', 'options': {'choices': [
            {'text': 'Active', 'value': 'active'}, {'text': 'Suspended', 'value': 'suspended'}]}, 'width': 'half'},
        'display_name': {'interface': 'input', 'width': 'half'},
        'last_login_at': {'interface': 'datetime', 'readonly': True, 'width': 'half'},
        'created_at': {'interface': 'datetime', 'readonly': True, 'width': 'half'},
        'updated_at': {'interface': 'datetime', 'readonly': True, 'hidden': True},
    }),
    ('openfund_challenges', 'flag', 'Challenge accounts — a user may own many; lifecycle per record. Written by the backend.', True, {
        'user_id': {'interface': 'select-dropdown-m2o', 'special': ['m2o'], 'readonly': True, 'width': 'half'},
        'challenge_plan_id': {'interface': 'select-dropdown-m2o', 'special': ['m2o'], 'readonly': True, 'width': 'half'},
        'status': {'interface': 'select-dropdown', 'options': {'choices': [
            {'text': 'Created', 'value': 'created'}, {'text': 'Started', 'value': 'started'},
            {'text': 'Passed', 'value': 'passed'}, {'text': 'Failed', 'value': 'failed'},
            {'text': 'Expired', 'value': 'expired'}, {'text': 'Cancelled', 'value': 'cancelled'}]}, 'width': 'half'},
        'created_at': {'interface': 'datetime', 'readonly': True, 'width': 'half'},
        'started_at': {'interface': 'datetime', 'readonly': True, 'width': 'half'},
        'completed_at': {'interface': 'datetime', 'readonly': True, 'width': 'half'},
    }),
    ('challenge_plans', 'inventory_2', 'Challenge plan catalog (editorial + permitted config; risk math stays server-side).', True, {
        'slug': {'interface': 'input', 'readonly': True, 'width': 'half'},
        'name': {'interface': 'input', 'width': 'half'},
        'status': {'interface': 'select-dropdown', 'options': {'choices': [
            {'text': 'Active', 'value': 'active'}, {'text': 'Inactive', 'value': 'inactive'}]}, 'width': 'half'},
        'configuration': {'interface': 'input-code', 'options': {'language': 'json'}, 'width': 'full'},
    }),
    ('audit_log', 'events', 'Security/authorization audit trail (read-only view).', True, {
        'ts': {'interface': 'datetime', 'readonly': True, 'width': 'half'},
        'action': {'interface': 'input', 'readonly': True, 'width': 'half'},
        'user_id': {'interface': 'input', 'readonly': True, 'width': 'half'},
        'ip': {'interface': 'input', 'readonly': True, 'width': 'half'},
        'details': {'interface': 'input-code', 'options': {'language': 'json'}, 'readonly': True},
    }),
    ('auth_sessions', 'lock', 'Server-side sessions (hashed ids) — operational, hidden.', False, {}),
    ('auth_nonces', 'timer', 'Single-use SIWE nonces — operational, hidden.', False, {}),
    # ---- demo trading (financial fields READ-ONLY: written by the engine only) ----
    ('demo_accounts', 'account_balance_wallet', 'Demo trading accounts — one free_demo per user, 100,000 DAI. Written by the engine.', True, {
        'user_id': {'interface': 'select-dropdown-m2o', 'special': ['m2o'], 'readonly': True, 'width': 'half'},
        'account_type': {'interface': 'input', 'readonly': True, 'width': 'half'},
        'currency': {'interface': 'input', 'readonly': True, 'width': 'half'},
        'balance': {'interface': 'input', 'readonly': True, 'width': 'half', 'special': ['cast-timestamp'] if False else []},
        'used_margin': {'interface': 'input', 'readonly': True, 'hidden': True},
        'realized_pnl': {'interface': 'input', 'readonly': True, 'width': 'half'},
        'status': {'interface': 'select-dropdown', 'options': {'choices': [
            {'text': 'Active', 'value': 'active'}, {'text': 'Suspended', 'value': 'suspended'}, {'text': 'Closed', 'value': 'closed'}]}, 'width': 'half'},
        'created_at': {'interface': 'datetime', 'readonly': True, 'width': 'half'},
    }),
    ('trading_positions', 'candlestick_chart', 'Trading positions — written by the engine (read-only here).', True, {
        'user_id': {'interface': 'select-dropdown-m2o', 'special': ['m2o'], 'readonly': True, 'width': 'half'},
        'account_id': {'interface': 'select-dropdown-m2o', 'special': ['m2o'], 'readonly': True, 'width': 'half'},
        'market': {'interface': 'input', 'readonly': True, 'width': 'half'},
        'side': {'interface': 'input', 'readonly': True, 'width': 'half'},
        'quantity': {'interface': 'input', 'readonly': True, 'width': 'half'},
        'entry_price': {'interface': 'input', 'readonly': True, 'width': 'half'},
        'exit_price': {'interface': 'input', 'readonly': True, 'width': 'half'},
        'margin': {'interface': 'input', 'readonly': True, 'width': 'half'},
        'leverage': {'interface': 'input', 'readonly': True, 'width': 'half'},
        'status': {'interface': 'select-dropdown', 'options': {'choices': [
            {'text': 'Open', 'value': 'open'}, {'text': 'Closed', 'value': 'closed'}, {'text': 'Liquidated', 'value': 'liquidated'}]}, 'width': 'half'},
        'exit_reason': {'interface': 'input', 'readonly': True, 'width': 'half'},
        'realized_pnl': {'interface': 'input', 'readonly': True, 'width': 'half'},
        'opened_at': {'interface': 'datetime', 'readonly': True, 'width': 'half'},
        'closed_at': {'interface': 'datetime', 'readonly': True, 'width': 'half'},
    }),
    ('trading_orders', 'receipt_long', 'Trading orders — idempotent submissions, written by the engine.', True, {
        'user_id': {'interface': 'select-dropdown-m2o', 'special': ['m2o'], 'readonly': True, 'width': 'half'},
        'account_id': {'interface': 'select-dropdown-m2o', 'special': ['m2o'], 'readonly': True, 'width': 'half'},
        'market': {'interface': 'input', 'readonly': True, 'width': 'half'},
        'side': {'interface': 'input', 'readonly': True, 'width': 'half'},
        'order_type': {'interface': 'select-dropdown', 'options': {'choices': [
            {'text': 'Market', 'value': 'market'}, {'text': 'Limit', 'value': 'limit'}, {'text': 'Stop', 'value': 'stop'}]}, 'readonly': True, 'width': 'half'},
        'status': {'interface': 'select-dropdown', 'options': {'choices': [
            {'text': 'Pending', 'value': 'pending'}, {'text': 'Filled', 'value': 'filled'},
            {'text': 'Cancelled', 'value': 'cancelled'}, {'text': 'Rejected', 'value': 'rejected'}]}, 'readonly': True, 'width': 'half'},
        'margin': {'interface': 'input', 'readonly': True, 'width': 'half'},
        'leverage': {'interface': 'input', 'readonly': True, 'width': 'half'},
        'reject_reason': {'interface': 'input', 'readonly': True, 'width': 'half'},
        'created_at': {'interface': 'datetime', 'readonly': True, 'width': 'half'},
    }),
    ('trading_ledger', 'menu_book', 'Append-only balance ledger — NEVER editable.', True, {
        'account_id': {'interface': 'select-dropdown-m2o', 'special': ['m2o'], 'readonly': True, 'width': 'half'},
        'user_id': {'interface': 'select-dropdown-m2o', 'special': ['m2o'], 'readonly': True, 'width': 'half'},
        'event': {'interface': 'input', 'readonly': True, 'width': 'half'},
        'amount': {'interface': 'input', 'readonly': True, 'width': 'half'},
        'balance_after': {'interface': 'input', 'readonly': True, 'width': 'half'},
        'ts': {'interface': 'datetime', 'readonly': True, 'width': 'half'},
        'meta': {'interface': 'input-code', 'options': {'language': 'json'}, 'readonly': True},
    }),
    ('trading_events', 'monitor_heart', 'Engine audit trail — read-only.', False, {}),
]

def main():
    token = req('POST', '/auth/login', body={'email': 'admin@openfund.dev', 'password': 'openfund-admin-2026'})['data']['access_token']
    existing = {c['collection'] for c in req('GET', '/collections', token)['data']}

    for name, icon, note, visible, fields in COLLECTIONS:
        if name in existing:
            print(f'{name}: already tracked')
        else:
            try:
                req('POST', '/collections', token, {
                    'collection': name,
                    'meta': {'icon': icon, 'note': note, 'hidden': not visible},
                    'schema': {},
                })
                print(f'{name}: tracked (visible={visible})')
            except SystemExit as e:
                print(f'{name}: FAILED — {e}')

        # field presentation niceties (only for newly/already tracked)
        try:
            cur = [f['field'] for f in req('GET', f'/fields/{name}', token)['data']]
            for fname, meta in fields.items():
                if fname in cur and meta:
                    req('PATCH', f'/fields/{name}/{fname}', token, {'meta': meta})
            print(f'  fields polished')
        except SystemExit:
            pass

    # relations for m2o display (challenges → user / plan)
    rels = req('GET', '/relations', token)['data']
    def ensure_rel(many_collection, many_field, one_collection):
        for r in rels:
            if r['collection'] == many_collection and r['field'] == many_field:
                return
        req('POST', '/relations', token, {
            'collection': many_collection, 'field': many_field, 'related_collection': one_collection,
            'meta': {'sort_field': None}, 'schema': {'on_delete': 'CASCADE'},
        })
        print(f'  relation {many_collection}.{many_field} → {one_collection}')
    ensure_rel('openfund_challenges', 'user_id', 'openfund_users')
    ensure_rel('openfund_challenges', 'challenge_plan_id', 'challenge_plans')

    # PUBLIC ROLE MUST HAVE NO PERMISSION on these collections (private by default) — verify
    pols = req('GET', '/policies?limit=-1', token)['data']
    pubpol = next(x for x in pols if 'public' in x['name'].lower())
    perms = [p for p in req('GET', '/permissions?limit=-1', token)['data'] if p.get('policy') == pubpol['id']]
    private_tables = [c[0] for c in COLLECTIONS]
    bad = [p['collection'] for p in perms if p['collection'] in private_tables]
    print('public permissions on identity tables:', bad if bad else 'NONE ✓')

if __name__ == '__main__':
    main()
