#!/usr/bin/env python3
"""
Openfund backstage: remove arrow glyphs from editorial copy (idempotent).

Arrows are rendered by the website's direction-aware primitive (DirArrow),
which mirrors by the element's direction. Arrow glyphs typed into copy point
the wrong way in half of the locales, so this migration removes a LEADING or
TRAILING arrow glyph (and the space next to it) from existing editorial
values. The words are never changed, a glyph inside a sentence is reported
but left alone, and financial collections are never read.

Default is a dry run that prints every change. `--apply` writes them.
Re-running finds nothing to change.

Usage:
  python3 strip_arrow_glyphs.py [--apply] (same env/args as apply_schema.py)
Run it in production only after a verified CMS backup (docs/deployment/RENDER.md).
"""
import argparse
import json
import os
import re
import urllib.error
import urllib.parse
import urllib.request

# Editorial collections only (the translation rows hold the copy).
COLLECTIONS = [
    'ui_message_translations', 'navigation_item_translations', 'page_translations',
    'footer_link_translations', 'faq_translations', 'faq_category_translations',
    'glossary_term_translations', 'learning_path_translations', 'lesson_translations',
    'tool_translations', 'trading_rule_translations', 'legal_document_translations',
    'home_content_translations', 'referral_content_translations', 'site_campaign_translations',
    'governance_content_block_translations', 'governance_milestone_translations',
    'developer_doc_translations',
]
# Identifiers and links are never copy.
SKIP_FIELDS = {'id', 'key', 'slug', 'languages_code', 'language_code', 'url', 'href', 'link', 'path', 'status', 'icon'}
TEXT_TYPES = {'string', 'text'}
GLYPHS = '←→↙↘↖↗‹›↓↑'
EDGE = re.compile(rf'^[\s{GLYPHS}]*[{GLYPHS}][\s{GLYPHS}]*|[\s{GLYPHS}]*[{GLYPHS}][\s{GLYPHS}]*$')
INNER = re.compile(rf'[{GLYPHS}]')


def strip_edges(value):
    """Remove leading/trailing arrow glyphs and the whitespace next to them."""
    if not isinstance(value, str) or not INNER.search(value):
        return value
    return EDGE.sub('', value)


def req(method, url, token=None, body=None):
    data = json.dumps(body).encode() if body is not None else None
    r = urllib.request.Request(url, data=data, method=method)
    r.add_header('Content-Type', 'application/json')
    if token:
        r.add_header('Authorization', f'Bearer {token}')
    try:
        with urllib.request.urlopen(r, timeout=60) as resp:
            raw = resp.read()
            return json.loads(raw) if raw else {}
    except urllib.error.HTTPError as e:
        if e.code in (403, 404):
            return None
        raise SystemExit(f'HTTP {e.code} {method} {url}\n{e.read().decode()[:400]}')


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--url', default=os.environ.get('DIRECTUS_URL', 'http://localhost:8055'))
    ap.add_argument('--email', default=os.environ.get('DIRECTUS_ADMIN_EMAIL', 'admin@openfund.dev'))
    ap.add_argument('--password', default=os.environ.get('DIRECTUS_ADMIN_PASSWORD', 'openfund-admin-2026'))
    ap.add_argument('--apply', action='store_true', help='write the changes (default: dry run)')
    a = ap.parse_args()
    base = a.url.rstrip('/')
    token = req('POST', f'{base}/auth/login', body={'email': a.email, 'password': a.password})['data']['access_token']

    changed = inner = 0
    for collection in COLLECTIONS:
        meta = req('GET', f'{base}/fields/{collection}', token)
        if not meta:
            print(f'{collection}: not present, skipped')
            continue
        fields = [f['field'] for f in meta['data'] if f.get('type') in TEXT_TYPES and f['field'] not in SKIP_FIELDS]
        if not fields:
            continue
        query = urllib.parse.urlencode({'fields': ','.join(['id', *fields]), 'limit': '-1'})
        rows = req('GET', f'{base}/items/{collection}?{query}', token)['data']
        for row in rows:
            patch = {}
            for field in fields:
                value = row.get(field)
                fixed = strip_edges(value)
                if fixed != value:
                    patch[field] = fixed
                    print(f'{collection}#{row["id"]}.{field}: {value!r} -> {fixed!r}')
                if isinstance(fixed, str) and INNER.search(fixed):
                    inner += 1
                    print(f'{collection}#{row["id"]}.{field}: glyph inside the text left for an editor: {fixed[:80]!r}')
            if patch:
                changed += 1
                if a.apply:
                    req('PATCH', f'{base}/items/{collection}/{row["id"]}', token, patch)
    mode = 'applied' if a.apply else 'dry run'
    print(f'{mode}: {changed} rows with edge arrows, {inner} values with an arrow inside the text')


if __name__ == '__main__':
    main()
