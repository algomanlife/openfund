#!/usr/bin/env python3
"""
Openfund backstage — schema initialization (idempotent).

Creates the Directus collections, fields and relations for Openfund content
management + public read permissions. Safe to re-run: existing collections /
fields are detected and skipped.

Usage:
  python3 apply_schema.py [--url http://localhost:8055]
                          [--email admin@openfund.dev]
                          [--password ...]

Env fallbacks: DIRECTUS_URL / DIRECTUS_ADMIN_EMAIL / DIRECTUS_ADMIN_PASSWORD
"""
import argparse
import json
import os
import sys
import urllib.request
import urllib.error

def req(method, url, token=None, body=None):
    data = json.dumps(body).encode() if body is not None else None
    r = urllib.request.Request(url, data=data, method=method)
    r.add_header('Content-Type', 'application/json')
    if token:
        r.add_header('Authorization', f'Bearer {token}')
    try:
        with urllib.request.urlopen(r, timeout=30) as resp:
            return json.loads(resp.read() or b'{}')
    except urllib.error.HTTPError as e:
        err = e.read().decode()[:400]
        raise SystemExit(f'HTTP {e.code} {method} {url}\n{err}')

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--url', default=os.environ.get('DIRECTUS_URL', 'http://localhost:8055'))
    ap.add_argument('--email', default=os.environ.get('DIRECTUS_ADMIN_EMAIL', 'admin@openfund.dev'))
    ap.add_argument('--password', default=os.environ.get('DIRECTUS_ADMIN_PASSWORD', 'openfund-admin-2026'))
    a = ap.parse_args()
    base = a.url.rstrip('/')

    token = req('POST', f'{base}/auth/login', body={'email': a.email, 'password': a.password})['data']['access_token']
    print('login OK')

    existing = {c['collection'] for c in req('GET', f'{base}/collections', token)['data']}

    def ensure_collection(name, meta_extra=None, fields=None):
        if name in existing:
            print(f'collection {name}: exists')
        else:
            req('POST', f'{base}/collections', token, {
                'collection': name,
                'meta': {'icon': 'import_export', 'note': f'Openfund {name}', **(meta_extra or {})},
                'schema': {},
            })
            print(f'collection {name}: created')

    def ensure_field(collection, field, ftype, meta=None, schema=None):
        fields = [f['field'] for f in req('GET', f'{base}/fields/{collection}', token)['data']]
        if field in fields:
            return
        req('POST', f'{base}/fields/{collection}', token, {
            'field': field, 'type': ftype,
            'meta': meta or {}, 'schema': schema or {},
        })
        print(f'  field {collection}.{field}: created')


    def ensure_alias(collection, field, related_field):
        fields = [f['field'] for f in req('GET', f'{base}/fields/{collection}', token)['data']]
        if field in fields:
            return
        req('POST', f'{base}/fields/{collection}', token, {
            'field': field, 'type': 'alias',
            'meta': {'special': ['o2m'], 'interface': 'list-o2m', 'options': {'template': '{{language_code}}: {{value}}'}},
            'schema': None,
        })
        print(f'  alias field {collection}.{field}: created')

    def ensure_relation(collection, field, related, one_field=None):
        rels = req('GET', f'{base}/relations', token)['data']
        cur = next((r for r in rels if r['collection'] == collection and r['field'] == field), None)
        if cur:
            if one_field and cur.get('meta', {}).get('one_field') != one_field:
                import subprocess
                subprocess.run(['/opt/homebrew/opt/postgresql@17/bin/psql', '-U', 'openfund_cms', '-d', 'openfund_cms', '-c',
                    f"UPDATE directus_relations SET one_field='{one_field}' WHERE many_collection='{collection}' AND many_field='{field}';"],
                    check=False, capture_output=True)
                print(f'  relation {collection}.{field}: one_field={one_field} set (via psql)')
            return
        req('POST', f'{base}/relations', token, {
            'collection': collection, 'field': field, 'related_collection': related,
            'meta': ({'one_field': one_field} if one_field else {'sort_field': None}),
            'schema': {'on_delete': 'CASCADE'},
        })
        print(f'  relation {collection}.{field} → {related}: created')

    LANG_META = {
        'interface': 'select-dropdown',
        'options': {'choices': [
            {'text': 'فارسی (fa)', 'value': 'fa'},
            {'text': 'English (en)', 'value': 'en'},
        ]},
        'required': True,
    }
    STATUS_SCHEMA = {'default_value': 'published', 'has_auto_increment': False}

    # ---------------- ui_messages (landing + terminal + common strings) ----
    ensure_collection('ui_messages', {'sort_field': 'namespace'})
    ensure_field('ui_messages', 'key', 'text',
        meta={'unique': True, 'required': True, 'interface': 'input'},
        schema={'is_unique': True, 'is_nullable': False})
    ensure_field('ui_messages', 'namespace', 'string',
        meta=LANG_META and {'interface': 'select-dropdown', 'options': {'choices': [
            {'text': 'Landing', 'value': 'landing'},
            {'text': 'Terminal', 'value': 'terminal'},
            {'text': 'Common', 'value': 'common'},
        ]}, 'required': True})
    ensure_field('ui_messages', 'status', 'string',
        meta={'interface': 'select-dropdown', 'options': {'choices': [
            {'text': 'Published', 'value': 'published'},
            {'text': 'Draft', 'value': 'draft'},
            {'text': 'Archived', 'value': 'archived'},
        ]}, 'special': ['status'], 'required': False},
        schema=STATUS_SCHEMA)

    ensure_collection('ui_message_translations')
    ensure_field('ui_message_translations', 'ui_message_id', 'integer',
        meta={'interface': 'select-dropdown-m2o', 'special': ['m2o'], 'required': True},
        schema={'is_nullable': False})
    ensure_field('ui_message_translations', 'language_code', 'string', meta=dict(LANG_META), schema={'is_nullable': False})
    ensure_field('ui_message_translations', 'value', 'text',
        meta={'interface': 'input-multiline', 'required': True}, schema={'is_nullable': False})
    ensure_relation('ui_message_translations', 'ui_message_id', 'ui_messages', one_field='translations')

    # ---------------- navigation -----------------------------------------
    ensure_collection('navigation_items', {'sort_field': 'sort'})
    ensure_field('navigation_items', 'location', 'string',
        meta={'interface': 'select-dropdown', 'options': {'choices': [
            {'text': 'Landing header', 'value': 'landing_header'},
            {'text': 'Landing footer', 'value': 'landing_footer'},
            {'text': 'Terminal header', 'value': 'terminal_header'},
        ]}, 'required': True}, schema={'is_nullable': False})
    ensure_field('navigation_items', 'sort', 'integer', meta={'interface': 'input', 'hidden': True}, schema={'default_value': 0})
    ensure_field('navigation_items', 'route', 'string', meta={'interface': 'input', 'options': {'placeholder': '#/terminal'}}, schema={})
    ensure_field('navigation_items', 'external_url', 'string', meta={'interface': 'input', 'options': {'placeholder': 'https://…'}}, schema={})
    ensure_field('navigation_items', 'visible', 'boolean', meta={'interface': 'boolean'}, schema={'default_value': True})
    ensure_field('navigation_items', 'status', 'string',
        meta={'interface': 'select-dropdown', 'options': {'choices': [
            {'text': 'Published', 'value': 'published'}, {'text': 'Draft', 'value': 'draft'}, {'text': 'Archived', 'value': 'archived'},
        ]}, 'special': ['status']}, schema=STATUS_SCHEMA)

    ensure_collection('navigation_item_translations')
    ensure_field('navigation_item_translations', 'navigation_item_id', 'integer',
        meta={'interface': 'select-dropdown-m2o', 'special': ['m2o'], 'required': True}, schema={'is_nullable': False})
    ensure_field('navigation_item_translations', 'language_code', 'string', meta=dict(LANG_META), schema={'is_nullable': False})
    ensure_field('navigation_item_translations', 'label', 'string', meta={'interface': 'input', 'required': True}, schema={'is_nullable': False})
    ensure_field('navigation_item_translations', 'description', 'string', meta={'interface': 'input'}, schema={})
    ensure_relation('navigation_item_translations', 'navigation_item_id', 'navigation_items', one_field='translations')

    # ---------------- pages (SEO + meta) ----------------------------------
    ensure_collection('pages')
    ensure_field('pages', 'slug', 'string', meta={'unique': True, 'interface': 'input'}, schema={'is_unique': True, 'is_nullable': False, 'max_length': 64})
    ensure_field('pages', 'template', 'string',
        meta={'interface': 'select-dropdown', 'options': {'choices': [
            {'text': 'Landing', 'value': 'landing'}, {'text': 'Terminal', 'value': 'terminal'},
        ]}}, schema={'is_nullable': False})
    ensure_field('pages', 'status', 'string',
        meta={'interface': 'select-dropdown', 'options': {'choices': [
            {'text': 'Published', 'value': 'published'}, {'text': 'Draft', 'value': 'draft'}, {'text': 'Archived', 'value': 'archived'},
        ]}, 'special': ['status']}, schema=STATUS_SCHEMA)

    ensure_collection('page_translations')
    ensure_field('page_translations', 'page_id', 'integer',
        meta={'interface': 'select-dropdown-m2o', 'special': ['m2o'], 'required': True}, schema={'is_nullable': False})
    ensure_field('page_translations', 'language_code', 'string', meta=dict(LANG_META), schema={'is_nullable': False})
    ensure_field('page_translations', 'title', 'string', meta={'interface': 'input'}, schema={})
    ensure_field('page_translations', 'subtitle', 'string', meta={'interface': 'input'}, schema={})
    ensure_field('page_translations', 'description', 'text', meta={'interface': 'input-multiline'}, schema={})
    ensure_field('page_translations', 'seo_title', 'string', meta={'interface': 'input'}, schema={})
    ensure_field('page_translations', 'seo_description', 'text', meta={'interface': 'input-multiline'}, schema={})
    ensure_relation('page_translations', 'page_id', 'pages', one_field='translations')

    # ---------------- site settings (singleton) ---------------------------
    if 'site_settings' in existing:
        print('collection site_settings: exists')
    else:
        req('POST', f'{base}/collections', token, {
            'collection': 'site_settings',
            'meta': {'icon': 'settings', 'note': 'Openfund site settings', 'singleton': True},
            'schema': {},
        })
        print('collection site_settings: created')
    ensure_field('site_settings', 'default_language', 'string', meta=dict(LANG_META), schema={'default_value': 'fa'})
    ensure_field('site_settings', 'maintenance_message', 'text', meta={'interface': 'input-multiline'}, schema={})

    # ---------------- public (read-only) permissions ----------------------
    roles = req('GET', f'{base}/roles', token)['data']
    public = next((r for r in roles if r['name'] == 'Public'), None)
    if not public:
        public = req('POST', f'{base}/roles', token, {'name': 'Public', 'icon': 'public'})['data']
    # Directus 11: permissions live on policies — use the public policy
    pols = req('GET', f'{base}/policies?limit=-1', token)['data']
    pubpol = next((x for x in pols if x['name'].startswith('$t:public') or 'public' in x['name'].lower()), None)
    if not pubpol:
        raise SystemExit('public policy not found')
    perms = [x for x in req('GET', f'{base}/permissions?limit=-1', token)['data'] if x.get('policy') == pubpol['id']]
    have = {(x['collection'], x['action']) for x in perms}
    wanted = [
        ('ui_messages', {'status': {'_eq': 'published'}}),
        ('ui_message_translations', None),
        ('navigation_items', {'status': {'_eq': 'published'}}),
        ('navigation_item_translations', None),
        ('pages', {'status': {'_eq': 'published'}}),
        ('page_translations', None),
        ('site_settings', None),
    ]
    for coll, cond in wanted:
        if (coll, 'read') in have:
            continue
        req('POST', f'{base}/permissions', token, {
            'policy': pubpol['id'], 'collection': coll, 'action': 'read',
            'fields': ['*'], 'permissions': cond or {},
        })
        print(f'public read: {coll}')
    print('schema OK')

if __name__ == '__main__':
    main()
