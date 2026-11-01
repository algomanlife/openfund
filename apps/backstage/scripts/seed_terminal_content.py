#!/usr/bin/env python3
"""Additive terminal editorial setup on the EXISTING Directus instance.
Preserves all existing content, permissions and editor changes. No financial writes.
Uses the same normalized pages/ui_messages/translations conventions as apply_schema.py.
"""
import json
import os
import sys
from pathlib import Path
from apply_schema import req

base = os.environ.get('DIRECTUS_URL', 'http://localhost:8055').rstrip('/')
email = os.environ.get('DIRECTUS_ADMIN_EMAIL', 'admin@openfund.dev')
password = os.environ.get('DIRECTUS_ADMIN_PASSWORD', 'openfund-admin-2026')
token = req('POST', base + '/auth/login', body={'email': email, 'password': password})['data']['access_token']
def call(method, path, data=None):
    return req(method, base + path, token, data).get('data')

def field(collection, name, kind, meta=None, schema=None):
    existing = {x['field'] for x in call('GET', '/fields/' + collection)}
    if name not in existing:
        call('POST', '/fields/' + collection, {'field': name, 'type': kind, 'meta': meta or {'interface': 'input'}, 'schema': schema if schema is not None else {}})

collections = {c['collection'] for c in call('GET', '/collections')}
for name in ['terminal_sections', 'terminal_section_translations']:
    if name not in collections:
        call('POST', '/collections', {'collection': name, 'meta': {'icon': 'article', 'note': 'Terminal editorial content only; no financial records.', **({'sort_field': 'sort'} if name == 'terminal_sections' else {'hidden': True})}, 'schema': {}, 'fields': [{'field': 'id', 'type': 'integer', 'schema': {'is_primary_key': True, 'has_auto_increment': True}, 'meta': {'hidden': True}}]})
for name in ['product', 'page', 'section_key']:
    field('terminal_sections', name, 'string')
field('terminal_sections', 'sort', 'integer', {'interface': 'input'}, {'default_value': 0})
field('terminal_sections', 'status', 'string', {'interface': 'select-dropdown', 'special': ['status'], 'options': {'choices': [{'text': s.title(), 'value': s} for s in ['draft', 'published', 'archived']]}}, {'default_value': 'draft'})
field('terminal_sections', 'support_url', 'string', {'interface': 'input', 'note': 'HTTPS only; optional support or educational link.'})
field('terminal_sections', 'illustration', 'uuid', {'interface': 'file-image', 'special': ['file']})
field('terminal_section_translations', 'section_id', 'integer', {'interface': 'select-dropdown-m2o', 'special': ['m2o']})
field('terminal_section_translations', 'language_code', 'string', {'interface': 'select-dropdown', 'options': {'choices': [{'text': 'فارسی', 'value': 'fa'}, {'text': 'English', 'value': 'en'}]}})
field('terminal_section_translations', 'title', 'text')
field('terminal_section_translations', 'body', 'text', {'interface': 'input-multiline'})
field('terminal_sections', 'translations', 'alias', {'special': ['o2m'], 'interface': 'list-o2m', 'options': {'template': '{{language_code}}: {{title}}'}}, None)
relations = call('GET', '/relations')
for collection, name, related, one in [('terminal_section_translations', 'section_id', 'terminal_sections', 'translations'), ('terminal_sections', 'illustration', 'directus_files', None)]:
    if not any(r['collection'] == collection and r['field'] == name for r in relations):
        call('POST', '/relations', {'collection': collection, 'field': name, 'related_collection': related, 'meta': {'one_field': one} if one else {}, 'schema': {'on_delete': 'SET NULL'}})
policies = call('GET', '/policies?limit=-1')
public = next(p for p in policies if p['name'].startswith('$t:public') or p['name'].lower() == 'public')
perms = call('GET', '/permissions?limit=-1')
for collection, condition in [('terminal_sections', {'status': {'_eq': 'published'}}), ('terminal_section_translations', {'section_id': {'status': {'_eq': 'published'}}})]:
    if not any(p.get('policy') == public['id'] and p['collection'] == collection and p['action'] == 'read' for p in perms):
        call('POST', '/permissions', {'policy': public['id'], 'collection': collection, 'action': 'read', 'fields': ['*'], 'permissions': condition})
seed = json.loads((Path(__file__).parent / 'terminal_content.json').read_text())
counts = {}
for collection, key, rows in [('pages', 'slug', seed['pages']), ('ui_messages', 'key', seed['messages']), ('terminal_sections', 'section_key', seed['sections'])]:
    existing = {x[key]: x['id'] for x in call('GET', '/items/' + collection + '?limit=-1&fields=id,' + key)}
    created = 0
    for row in rows:
        if row[key] in existing:
            if '--refresh-product-copy' in sys.argv:
                current = call('GET', '/items/' + collection + '/' + str(existing[row[key]]) + '?fields=translations.id,translations.language_code')
                ids = {t['language_code']: t['id'] for t in current.get('translations', [])}
                for tr in row.get('translations', []):
                    if tr['language_code'] in ids:
                        tr['id'] = ids[tr['language_code']]
                call('PATCH', '/items/' + collection + '/' + str(existing[row[key]]), row)
            continue
        call('POST', '/items/' + collection, row)
        created += 1
    counts[collection] = created
print('Terminal CMS setup complete; new records:', json.dumps(counts))
