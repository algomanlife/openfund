#!/usr/bin/env python3
"""
Openfund backstage — coupon administration in Directus (idempotent).

Registers the backend's commerce tables (created by apps/backend/schema.sql in
the shared PostgreSQL database) as Directus collections, and creates the
"Commerce Admin" role + "Commerce administration" policy:

  coupons                 editable: code, type, value, status (active /
                          inactive / revoked), window, limits, products,
                          account sizes, internal-test flag, challenge models
                          (M2M) and allowed customers (M2M); usage counters,
                          related orders, redemptions and audit shown inline
  coupon_challenge_plans  M2M junction → challenge_plans (hidden)
  coupon_allowed_users    M2M junction → openfund_users (hidden)
  coupon_redemptions      read-only redemption history
  coupon_audit            read-only, append-only change history
  purchase_orders         read-only order view (coupon-related orders)
  purchase_order_events   read-only order state history

Directus is the editing UI only. Validation, pricing and redemption stay in
the backend (apps/backend/coupons.js); database triggers enforce code
normalization, final revocation, pricing lock after first use and the
internal-coupon bounds for every writer. Permissions use no row filters
(Directus 12 Core tier ignores custom permission rules), and the public
policy gets NO access to any commerce collection (verified at the end).

Usage: python3 register_commerce_tables.py [--url URL] [--email E] [--password P]
       (env fallbacks DIRECTUS_URL / DIRECTUS_ADMIN_EMAIL / DIRECTUS_ADMIN_PASSWORD)
Run after register_user_tables.py (challenge_plans and openfund_users must be tracked).
"""
import argparse
import json
import os
import urllib.request
import urllib.error

COMMERCE_ROLE = 'Commerce Admin'
COMMERCE_POLICY = 'Commerce administration'


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--url', default=os.environ.get('DIRECTUS_URL', 'http://localhost:8055'))
    ap.add_argument('--email', default=os.environ.get('DIRECTUS_ADMIN_EMAIL'))
    ap.add_argument('--password', default=os.environ.get('DIRECTUS_ADMIN_PASSWORD'))
    a = ap.parse_args()
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
            if ok404 and e.code in (403, 404):
                return None
            raise SystemExit(f'HTTP {e.code} {method} {path}\n{e.read().decode()[:400]}')

    token = req('POST', '/auth/login', body={'email': a.email, 'password': a.password})['data']['access_token']
    existing = {c['collection'] for c in req('GET', '/collections', token)['data']}
    for needed in ('challenge_plans', 'openfund_users'):
        if needed not in existing:
            raise SystemExit(f'{needed} is not tracked yet — run register_user_tables.py first')

    # ---------------- collections (folder + tables) ----------------
    def ensure_collection(name, meta, schema=True):
        if name in existing:
            req('PATCH', f'/collections/{name}', token, {'meta': meta})
            print(f'{name}: tracked (meta refreshed)')
        else:
            req('POST', '/collections', token, {'collection': name, 'meta': meta, 'schema': {} if schema else None})
            existing.add(name)
            print(f'{name}: tracked')

    ensure_collection('commerce', {'icon': 'storefront', 'note': 'Coupons, redemptions and coupon-related orders. Checkout rules are enforced by the backend.', 'sort': 90}, schema=False)
    ro = 'Written by the Openfund backend — read-only here.'
    ensure_collection('coupons', {'group': 'commerce', 'icon': 'confirmation_number', 'sort': 1, 'display_template': '{{code}} · {{kind}} {{value}} · {{status}}',
        'archive_field': 'status', 'archive_value': 'revoked', 'unarchive_value': 'inactive',
        'note': 'Discount coupons. Create, edit, activate/deactivate and revoke here; validation and redemption are enforced by the backend at checkout.'})
    ensure_collection('coupon_challenge_plans', {'group': 'commerce', 'hidden': True, 'icon': 'link', 'note': 'Coupon ↔ eligible challenge model (junction).'})
    ensure_collection('coupon_allowed_users', {'group': 'commerce', 'hidden': True, 'icon': 'link', 'note': 'Coupon ↔ allowed customer (junction).'})
    ensure_collection('coupon_redemptions', {'group': 'commerce', 'icon': 'receipt', 'sort': 2, 'display_template': '{{status}} · {{net_price_usd}} USD', 'note': 'Redemption history (reserved → consumed or released). ' + ro})
    ensure_collection('coupon_audit', {'group': 'commerce', 'icon': 'history', 'sort': 3, 'display_template': '{{action}} · {{actor}}', 'note': 'Append-only history of every coupon change (who and what). ' + ro})
    ensure_collection('purchase_orders', {'group': 'commerce', 'icon': 'shopping_cart', 'sort': 4, 'display_template': '{{lifecycle_state}} · {{price_usd}} USD · {{payment_method}}', 'note': 'Challenge purchase orders. ' + ro})
    ensure_collection('purchase_order_events', {'group': 'commerce', 'icon': 'timeline', 'sort': 5, 'hidden': True, 'note': 'Order state history (append-only). ' + ro})

    # ---------------- fields ----------------
    cur = {}
    def fields_of(coll):
        if coll not in cur:
            cur[coll] = {f['field']: f for f in req('GET', f'/fields/{coll}', token)['data']}
        return cur[coll]

    def meta(coll, field, m):
        if field in fields_of(coll):
            req('PATCH', f'/fields/{coll}/{field}', token, {'meta': m})

    def alias(coll, field, special, m):
        if field not in fields_of(coll):
            req('POST', f'/fields/{coll}', token, {'field': field, 'type': 'alias', 'meta': {'special': special, **m}, 'schema': None})
            cur[coll][field] = {'field': field}
            print(f'  alias {coll}.{field}')
        else:
            meta(coll, field, {'special': special, **m})

    sizes = [5000, 10000, 25000, 50000, 100000, 200000]
    half, full = 'half', 'full'
    meta('coupons', 'id', {'hidden': True, 'readonly': True})
    meta('coupons', 'code', {'interface': 'input', 'required': True, 'width': half, 'sort': 1, 'options': {'font': 'monospace', 'trim': True},
        'validation': {'_and': [{'code': {'_regex': '^[A-Za-z0-9][A-Za-z0-9_-]{2,39}$'}}]},
        'validation_message': '3–40 characters: letters, digits, "-" or "_". Stored upper-case; must be unique.',
        'note': 'Customer-facing code (case-insensitive, stored upper-case, unique). Locked after the first redemption.'})
    meta('coupons', 'name', {'interface': 'input', 'width': half, 'sort': 2, 'note': 'Internal label, never shown to customers.'})
    meta('coupons', 'kind', {'interface': 'select-dropdown', 'required': True, 'width': half, 'sort': 3, 'display': 'labels',
        'options': {'choices': [{'text': 'Percentage (%)', 'value': 'percent'}, {'text': 'Fixed amount (USD)', 'value': 'fixed'}]},
        'note': 'Percentage of the plan price, or a fixed USD amount. 100% (or fixed ≥ price) activates the challenge without payment.'})
    meta('coupons', 'value', {'interface': 'input', 'required': True, 'width': half, 'sort': 4, 'options': {'min': 0.01, 'step': 0.01},
        'note': 'Percentage 0.01–100 or USD amount. Locked after the first redemption.'})
    meta('coupons', 'status', {'interface': 'select-dropdown', 'required': True, 'width': half, 'sort': 5, 'display': 'labels',
        'options': {'choices': [{'text': 'Active', 'value': 'active', 'color': '#2ECDA7'}, {'text': 'Inactive', 'value': 'inactive', 'color': '#A2B5CD'},
                                {'text': 'Revoked (final)', 'value': 'revoked', 'color': '#E35169'}]},
        'display_options': {'choices': [{'text': 'Active', 'value': 'active', 'foreground': '#FFFFFF', 'background': '#2ECDA7'},
                                        {'text': 'Inactive', 'value': 'inactive', 'foreground': '#FFFFFF', 'background': '#A2B5CD'},
                                        {'text': 'Revoked', 'value': 'revoked', 'foreground': '#FFFFFF', 'background': '#E35169'}]},
        'note': 'Only active coupons apply. Revoked is permanent.'})
    meta('coupons', 'internal', {'interface': 'boolean', 'width': half, 'sort': 6, 'options': {'label': 'Internal test coupon'},
        'note': 'For authorized testers only: requires 1–2 allowed customers and a usage limit. Orders are recorded as "internal_coupon", excluded from revenue and earn no commission.'})
    meta('coupons', 'starts_at', {'interface': 'datetime', 'width': half, 'sort': 7, 'note': 'Optional start (UTC).'})
    meta('coupons', 'expires_at', {'interface': 'datetime', 'width': half, 'sort': 8, 'note': 'Optional expiry (UTC).'})
    meta('coupons', 'max_redemptions', {'interface': 'input', 'width': half, 'sort': 9, 'options': {'min': 1}, 'note': 'Total uses across all customers. Empty = unlimited (not allowed for internal coupons).'})
    meta('coupons', 'per_user_limit', {'interface': 'input', 'width': half, 'sort': 10, 'options': {'min': 1}, 'note': 'Uses per customer (default 1).'})
    meta('coupons', 'products', {'interface': 'select-multiple-checkbox', 'special': ['cast-json'], 'width': half, 'sort': 11,
        'options': {'choices': [{'text': 'Openfund Prop (challenges)', 'value': 'prop'}]},
        'note': 'Allowed products. Empty = all. Checkout currently sells Prop challenges.'})
    meta('coupons', 'account_sizes', {'interface': 'select-multiple-checkbox', 'special': ['cast-json'], 'width': half, 'sort': 12,
        'options': {'choices': [{'text': f'${s:,}', 'value': str(s)} for s in sizes]}, 'note': 'Allowed account sizes. Empty = all.'})
    alias('coupons', 'challenge_models', ['m2m'], {'interface': 'list-m2m', 'width': full, 'sort': 13,
        'options': {'template': '{{challenge_plan_id.name}}', 'enableCreate': False}, 'display': 'related-values',
        'display_options': {'template': '{{challenge_plan_id.slug}}'},
        'note': 'Eligible challenge models. Empty = every model.'})
    alias('coupons', 'allowed_customers', ['m2m'], {'interface': 'list-m2m', 'width': full, 'sort': 14,
        'options': {'template': '{{user_id.wallet_address}}', 'enableCreate': False}, 'display': 'related-values',
        'display_options': {'template': '{{user_id.wallet_address}}'},
        'note': 'Customers allowed to use this coupon (by wallet). Empty = any signed-in customer. Internal coupons: 1–2 test accounts.'})
    meta('coupons', 'description', {'interface': 'input-multiline', 'width': full, 'sort': 15, 'note': 'Internal notes (purpose, campaign, approval reference).'})
    for f, label, s in (('uses_reserved', 'Open reservations', 16), ('uses_consumed', 'Redeemed (paid / activated)', 17)):
        meta('coupons', f, {'interface': 'input', 'readonly': True, 'width': half, 'sort': s, 'note': f'{label}. Maintained by the database.'})
    alias('coupons', 'redemptions', ['o2m'], {'interface': 'list-o2m', 'readonly': True, 'width': full, 'sort': 18,
        'options': {'template': '{{status}} · {{net_price_usd}} USD · {{created_at}}', 'enableCreate': False, 'enableSelect': False}, 'note': 'Redemption history.'})
    alias('coupons', 'orders', ['o2m'], {'interface': 'list-o2m', 'readonly': True, 'width': full, 'sort': 19,
        'options': {'template': '{{lifecycle_state}} · {{price_usd}} USD · {{payment_method}}', 'enableCreate': False, 'enableSelect': False}, 'note': 'Orders that used this coupon.'})
    alias('coupons', 'audit_trail', ['o2m'], {'interface': 'list-o2m', 'readonly': True, 'width': full, 'sort': 20,
        'options': {'template': '{{created_at}} · {{action}} · {{actor}}', 'enableCreate': False, 'enableSelect': False}, 'note': 'Who changed what (append-only).'})
    # Directus fills these (no FK to directus_users is added to the backend
    # table); names of editors are in the item's Revisions panel and in
    # coupon_audit (actor = directus:<user id>)
    meta('coupons', 'user_created', {'special': ['user-created'], 'interface': 'input', 'readonly': True, 'width': half, 'sort': 21, 'note': 'Directus user who created the coupon'})
    meta('coupons', 'user_updated', {'special': ['user-updated'], 'interface': 'input', 'readonly': True, 'width': half, 'sort': 22, 'note': 'Directus user who last modified the coupon'})
    meta('coupons', 'created_at', {'special': ['date-created'], 'interface': 'datetime', 'readonly': True, 'width': half, 'sort': 23})
    meta('coupons', 'updated_at', {'special': ['date-updated'], 'interface': 'datetime', 'readonly': True, 'width': half, 'sort': 24})
    meta('coupons', 'created_by', {'hidden': True, 'readonly': True})

    for coll in ('coupon_redemptions', 'coupon_audit', 'purchase_orders', 'purchase_order_events'):
        for f in fields_of(coll):
            meta(coll, f, {'readonly': True})

    # ---------------- relations ----------------
    rels = {(r['collection'], r['field']): r for r in req('GET', '/relations', token)['data']}
    def relation(coll, field, related, rmeta):
        """Attach Directus metadata (O2M/M2M aliases) to a foreign key that
        schema.sql already owns. Directus 11 rewrites the FK on any relation
        PATCH, so this runs ONCE per relation (skipped when metadata exists)
        and passes the existing on_delete/on_update so the constraint
        definition stays identical. Never creates a new FK."""
        r = rels.get((coll, field))
        if not r or not r.get('schema'):
            raise SystemExit(f'{coll}.{field}: foreign key missing — run the backend migration (apps/backend/schema.sql) first')
        if r.get('meta'):
            print(f'  relation {coll}.{field} → {related}: metadata present')
            return
        sch = r['schema']
        req('PATCH', f'/relations/{coll}/{field}', token, {
            'collection': coll, 'field': field, 'related_collection': related,
            'schema': {'on_delete': sch.get('on_delete') or 'NO ACTION', 'on_update': sch.get('on_update') or 'NO ACTION'},
            'meta': {'sort_field': None, **rmeta}})
        print(f'  relation {coll}.{field} → {related}: metadata attached (FK definition preserved)')
    relation('coupon_challenge_plans', 'coupon_id', 'coupons', {'one_field': 'challenge_models', 'junction_field': 'challenge_plan_id'})
    relation('coupon_challenge_plans', 'challenge_plan_id', 'challenge_plans', {'one_field': None, 'junction_field': 'coupon_id'})
    relation('coupon_allowed_users', 'coupon_id', 'coupons', {'one_field': 'allowed_customers', 'junction_field': 'user_id'})
    relation('coupon_allowed_users', 'user_id', 'openfund_users', {'one_field': None, 'junction_field': 'coupon_id'})
    relation('coupon_redemptions', 'coupon_id', 'coupons', {'one_field': 'redemptions'})
    relation('purchase_orders', 'coupon_id', 'coupons', {'one_field': 'orders'})
    relation('coupon_audit', 'coupon_id', 'coupons', {'one_field': 'audit_trail'})
    # other m2o columns (orders → user/plan, redemptions → user/order, events → order)
    # work from the schema-detected foreign keys without metadata

    # ---------------- role + policy ----------------
    pols = req('GET', '/policies?limit=-1', token)['data']
    pol = next((p for p in pols if p['name'] == COMMERCE_POLICY), None)
    if not pol:
        pol = req('POST', '/policies', token, {'name': COMMERCE_POLICY, 'icon': 'storefront', 'app_access': True, 'admin_access': False,
            'enforce_tfa': False, 'description': 'Create, edit, activate/deactivate and revoke coupons; read redemptions, coupon orders and audit. No delete, no customer data beyond wallet and display name.'})['data']
        print(f'policy {COMMERCE_POLICY}: created')
    roles = req('GET', '/roles?limit=-1', token)['data']
    role = next((r for r in roles if r['name'] == COMMERCE_ROLE), None)
    if not role:
        role = req('POST', '/roles', token, {'name': COMMERCE_ROLE, 'icon': 'storefront', 'description': 'Coupon administration (Directus Data Studio).'})['data']
        print(f'role {COMMERCE_ROLE}: created')
    access = req('GET', f'/access?filter[role][_eq]={role["id"]}&filter[policy][_eq]={pol["id"]}', token)['data']
    if not access:
        req('POST', '/access', token, {'role': role['id'], 'policy': pol['id']})
        print('  policy attached to role')

    editable = ['code', 'name', 'description', 'kind', 'value', 'status', 'internal', 'starts_at', 'expires_at', 'max_redemptions',
                'per_user_limit', 'products', 'account_sizes', 'challenge_models', 'allowed_customers', 'user_created', 'user_updated', 'created_at', 'updated_at']
    wanted = [
        ('coupons', 'create', editable), ('coupons', 'read', ['*']), ('coupons', 'update', editable),
        ('coupon_challenge_plans', 'create', ['*']), ('coupon_challenge_plans', 'read', ['*']), ('coupon_challenge_plans', 'update', ['*']), ('coupon_challenge_plans', 'delete', ['*']),
        ('coupon_allowed_users', 'create', ['*']), ('coupon_allowed_users', 'read', ['*']), ('coupon_allowed_users', 'update', ['*']), ('coupon_allowed_users', 'delete', ['*']),
        ('coupon_redemptions', 'read', ['*']), ('coupon_audit', 'read', ['*']), ('purchase_order_events', 'read', ['*']),
        ('purchase_orders', 'read', ['id', 'status', 'lifecycle_state', 'challenge_plan_id', 'account_size_usd', 'list_price_usd', 'discount_usd', 'price_usd',
                                     'payment_required', 'payment_method', 'coupon_id', 'user_id', 'created_at', 'paid_at', 'expires_at']),
        ('challenge_plans', 'read', ['id', 'slug', 'name', 'status']),
        ('openfund_users', 'read', ['id', 'wallet_address', 'display_name', 'status']),
        ('directus_users', 'read', ['id', 'first_name', 'last_name', 'email']),
        ('directus_revisions', 'read', ['*']), ('directus_activity', 'read', ['*']),
    ]
    perms = [p for p in req('GET', f'/permissions?limit=-1&filter[policy][_eq]={pol["id"]}', token)['data']]
    have = {(p['collection'], p['action']): p for p in perms}
    for coll, action, fields in wanted:
        body = {'policy': pol['id'], 'collection': coll, 'action': action, 'fields': fields, 'permissions': {}, 'validation': {}}
        if (coll, action) in have:
            req('PATCH', f"/permissions/{have[(coll, action)]['id']}", token, {'fields': fields})
        else:
            req('POST', '/permissions', token, body)
    print(f'policy {COMMERCE_POLICY}: {len(wanted)} permissions (no delete on coupons, no row filters)')

    # ---------------- public policy must have NO access ----------------
    pub = next(p for p in pols if p['name'].startswith('$t:public') or 'public' in p['name'].lower())
    private = {'coupons', 'coupon_challenge_plans', 'coupon_allowed_users', 'coupon_redemptions', 'coupon_audit', 'purchase_orders', 'purchase_order_events'}
    leaked = [p['collection'] for p in req('GET', f'/permissions?limit=-1&filter[policy][_eq]={pub["id"]}', token)['data'] if p['collection'] in private]
    if leaked:
        raise SystemExit(f'public policy has access to commerce collections: {leaked}')
    for coll in private:
        if req('GET', f'/items/{coll}?limit=1', ok404=True) is not None:
            raise SystemExit(f'anonymous read of {coll} succeeded — refusing')
    print('public access to commerce collections: NONE ✓ (anonymous probes refused)')


if __name__ == '__main__':
    main()
