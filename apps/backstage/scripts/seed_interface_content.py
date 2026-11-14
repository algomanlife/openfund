#!/usr/bin/env python3
"""Add missing React copy to the existing Directus ui_messages authority.
Never overwrites editor values; new records start as drafts. No public writes.
"""
import argparse
import json
import os
from pathlib import Path
from apply_schema import req, license_preflight

REGISTRY = Path(__file__).resolve().parents[1] / 'content-registry.json'

def payload(row):
    locations = row['locations']
    return {
        'key': row['key'], 'namespace': 'react', 'status': 'draft',
        'product_area': row['area'], 'content_page': ', '.join(sorted({x['page'] for x in locations})),
        'content_routes': '; '.join(sorted({x['route'] for x in locations})),
        'source_location': '\n'.join(f"{x['component']}:{x['line']} ({x['method']})" for x in locations),
        'content_owner': row['owner'], 'translation_status': 'review_required',
        'translations': [{'language_code': locale, 'value': row[locale]} for locale in ('fa', 'en')],
    }

def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--dry-run', action='store_true')
    args = parser.parse_args()
    registry = json.loads(REGISTRY.read_text())
    rows = registry['records']
    assert len({r['key'] for r in rows}) == len(rows), 'Duplicate registry identifiers'
    if args.dry_run:
        for row in rows:
            assert payload(row)['status'] == 'draft'
        print(json.dumps(registry['summary']))
        return
    base = os.environ['DIRECTUS_URL'].rstrip('/')
    token = req('POST', f'{base}/auth/login', body={
        'email': os.environ['DIRECTUS_ADMIN_EMAIL'], 'password': os.environ['DIRECTUS_ADMIN_PASSWORD']
    })['data']['access_token']
    license_preflight(base, token)
    existing = req('GET', f'{base}/items/ui_messages?fields=key&limit=-1', token)['data']
    keys = {r['key'] for r in existing}
    created = 0
    for row in rows:
        if row['key'] in keys:
            continue
        req('POST', f'{base}/items/ui_messages', token, payload(row))
        created += 1
    # Named bookmarks split the existing collection into usable product areas.
    # Preserve any customized bookmarks, filters or layout preferences.
    presets = req('GET', f'{base}/presets?limit=-1', token)['data']
    bookmarks = {p.get('bookmark') for p in presets if p.get('collection') == 'ui_messages'}
    for area in sorted({r['area'] for r in rows}):
        name = f'Openfund — {area}'
        if name in bookmarks:
            continue
        req('POST', f'{base}/presets', token, {
            'collection': 'ui_messages', 'bookmark': name, 'layout': 'tabular',
            'filter': {'_and': [{'namespace': {'_eq': 'react'}}, {'product_area': {'_eq': area}}]},
            'layout_query': {'tabular': {'fields': ['key', 'content_page', 'status', 'translation_status', 'date_updated'], 'limit': 25}},
        })
    print(f'Created {created} drafts; preserved {len(rows) - created} existing records.')

if __name__ == '__main__':
    main()
