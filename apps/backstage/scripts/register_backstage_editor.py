#!/usr/bin/env python3
"""
Openfund backstage — Directus role for the Backstage Content workspace (idempotent).

Creates the "Backstage Content Editor" role and "Backstage content editing"
policy. API access only (no Data Studio), no admin access. Permissions come
from the generated editorial catalog in ../content-registry.json, so they match
exactly what the website renders and the Backstage server validates:

  ui_messages                     read; update status and translations
  ui_message_translations         read; create; update value
  <editorial surface>             read; update status (non-singletons),
                                  translations and shared text fields
  <surface>_translations          read; create; update the surface text fields

Forbidden (financial, account, governance) collections are never granted;
fields that look like links, destinations, contact or money values are
excluded. No delete permission anywhere.

The script does NOT create a user or token. The owner creates a dedicated
user with this role in Directus Studio, generates its static token there and
stores it as BACKSTAGE_DIRECTUS_TOKEN on the openfund-backstage service.

Usage: python3 register_backstage_editor.py [--url URL] [--email E] [--password P]
       (env fallbacks DIRECTUS_URL / DIRECTUS_ADMIN_EMAIL / DIRECTUS_ADMIN_PASSWORD)
Run after apply_schema.py.
"""
import argparse
import json
import os
import re
import urllib.request
import urllib.error
from pathlib import Path

ROLE = 'Backstage Content Editor'
POLICY = 'Backstage content editing'
PROTECTED = re.compile(r'(url|href|link|destination|email|wallet|address|price|amount|fee|pct|percent|leverage|payment|receiver|token|chain|support_)', re.I)
CATALOG = json.loads((Path(__file__).resolve().parents[1] / 'content-registry.json').read_text())['editorial']


def wanted_permissions():
    forbidden = set(CATALOG['forbidden'])
    wanted = [
        ('ui_messages', 'read', ['*']),
        ('ui_messages', 'update', ['status', 'translations']),
        ('ui_message_translations', 'read', ['*']),
        ('ui_message_translations', 'create', ['*']),
        ('ui_message_translations', 'update', ['value']),
    ]
    for surface in CATALOG['surfaces']:
        coll, tr = surface['collection'], surface['translationCollection']
        if coll in forbidden or tr in forbidden:
            raise SystemExit(f'catalog lists a forbidden collection: {coll}')
        text = [f for f in surface.get('textFields', []) if not PROTECTED.search(f)]
        shared = [f for f in surface.get('sharedTextFields', []) if not PROTECTED.search(f)]
        wanted.append((coll, 'read', ['*']))
        parent_fields = (['status'] if not surface.get('singleton') else []) + (['translations'] if text else []) + shared
        if parent_fields:
            wanted.append((coll, 'update', parent_fields))
        if text and tr != coll:
            wanted += [(tr, 'read', ['*']), (tr, 'create', ['*']), (tr, 'update', text)]
    # Marketing (Backstage campaigns API): popups and announcement bars. The
    # Backstage server validates every value before writing (enums, plain
    # text, https-or-same-site destinations, promotable coupons, image
    # signatures); still no deletes and no financial collection.
    wanted += [
        ('site_campaigns', 'read', ['*']), ('site_campaigns', 'create', ['*']), ('site_campaigns', 'update', ['*']),
        ('site_campaign_translations', 'read', ['*']), ('site_campaign_translations', 'create', ['*']),
        ('site_campaign_translations', 'update', ['headline', 'body', 'cta_label', 'image_alt']),
        ('directus_files', 'create', ['*']), ('directus_files', 'read', ['*']), ('directus_folders', 'read', ['id', 'name']),
    ]
    return wanted


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--url', default=os.environ.get('DIRECTUS_URL', 'http://localhost:8055'))
    ap.add_argument('--email', default=os.environ.get('DIRECTUS_ADMIN_EMAIL'))
    ap.add_argument('--password', default=os.environ.get('DIRECTUS_ADMIN_PASSWORD'))
    ap.add_argument('--dry-run', action='store_true', help='print the permission plan and exit')
    a = ap.parse_args()
    wanted = wanted_permissions()
    if a.dry_run:
        for coll, action, fields in wanted:
            print(f'{action:6} {coll}: {",".join(fields)}')
        return
    if not a.email or not a.password:
        raise SystemExit('Directus admin credentials are required (--email/--password or env)')
    base = a.url.rstrip('/')

    def req(method, path, token=None, body=None):
        data = json.dumps(body).encode() if body is not None else None
        r = urllib.request.Request(base + path, data=data, method=method)
        r.add_header('Content-Type', 'application/json')
        if token:
            r.add_header('Authorization', f'Bearer {token}')
        try:
            with urllib.request.urlopen(r, timeout=30) as resp:
                return json.loads(resp.read() or b'{}')
        except urllib.error.HTTPError as e:
            raise SystemExit(f'HTTP {e.code} {method} {path}\n{e.read().decode()[:400]}')

    token = req('POST', '/auth/login', body={'email': a.email, 'password': a.password})['data']['access_token']
    pols = req('GET', '/policies?limit=-1', token)['data']
    pol = next((p for p in pols if p['name'] == POLICY), None)
    if not pol:
        pol = req('POST', '/policies', token, {'name': POLICY, 'icon': 'edit_note', 'app_access': False, 'admin_access': False,
            'description': 'Backstage Content workspace: editorial copy only. No financial, account or governance data; no deletes.'})['data']
        print(f'policy {POLICY}: created')
    roles = req('GET', '/roles?limit=-1', token)['data']
    role = next((r for r in roles if r['name'] == ROLE), None)
    if not role:
        role = req('POST', '/roles', token, {'name': ROLE, 'icon': 'edit_note', 'description': 'Service user for the Backstage Content workspace (API only).'})['data']
        print(f'role {ROLE}: created')
    if not req('GET', f'/access?filter[role][_eq]={role["id"]}&filter[policy][_eq]={pol["id"]}', token)['data']:
        req('POST', '/access', token, {'role': role['id'], 'policy': pol['id']})
        print('  policy attached to role')
    existing = {c['collection'] for c in req('GET', '/collections?limit=-1', token)['data']}
    have = {(p['collection'], p['action']): p for p in req('GET', f'/permissions?limit=-1&filter[policy][_eq]={pol["id"]}', token)['data']}
    granted = 0
    for coll, action, fields in wanted:
        if coll not in existing:
            print(f'  skip {coll}: collection not present')
            continue
        if (coll, action) in have:
            req('PATCH', f"/permissions/{have[(coll, action)]['id']}", token, {'fields': fields})
        else:
            req('POST', '/permissions', token, {'policy': pol['id'], 'collection': coll, 'action': action, 'fields': fields, 'permissions': {}, 'validation': {}})
        granted += 1
    stray = [k for k in have if k not in {(c, act) for c, act, _ in wanted}]
    for coll, action in stray:
        req('DELETE', f"/permissions/{have[(coll, action)]['id']}", token)
        print(f'  removed stray permission {action} {coll}')
    print(f'policy {POLICY}: {granted} permissions (editorial only, no delete)')


if __name__ == '__main__':
    main()
