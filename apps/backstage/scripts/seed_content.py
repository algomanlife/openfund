#!/usr/bin/env python3
"""
Openfund backstage — content seeding (idempotent).

Imports the CURRENT Persian and English content of the landing and terminal
into Directus so the Data Studio starts populated (no empty CMS):
  - ui_messages: landing dict (fa→en, from dist/translations.json) and
    terminal labels (key→{fa,en}, from terminal-i18n.json)
  - navigation_items + translations (landing header/footer, terminal header)
  - pages + translations (SEO/meta for landing & terminal)
  - site_settings (default language fa)

Re-running creates only missing records (upsert by key/slug) — editorial
changes made in Directus are never overwritten.

Usage: python3 seed_content.py (same env/args as apply_schema.py)
"""
import argparse
import json
import os
import urllib.request
import urllib.error

HERE = os.path.dirname(os.path.abspath(__file__))
REPO = os.path.abspath(os.path.join(HERE, '..', '..', '..'))

def req(method, url, token=None, body=None):
    data = json.dumps(body).encode() if body is not None else None
    r = urllib.request.Request(url, data=data, method=method)
    r.add_header('Content-Type', 'application/json')
    if token:
        r.add_header('Authorization', f'Bearer {token}')
    try:
        with urllib.request.urlopen(r, timeout=30) as resp:
            raw = resp.read()
            return json.loads(raw) if raw else {}
    except urllib.error.HTTPError as e:
        raise SystemExit(f'HTTP {e.code} {method} {url}\n{e.read().decode()[:400]}')

def msg_payload(key, namespace, fa, en):
    return {
        'key': key, 'namespace': namespace, 'status': 'published',
        'translations': [
            {'language_code': 'fa', 'value': fa},
            {'language_code': 'en', 'value': en},
        ],
    }

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--url', default=os.environ.get('DIRECTUS_URL', 'http://localhost:8055'))
    ap.add_argument('--email', default=os.environ.get('DIRECTUS_ADMIN_EMAIL', 'admin@openfund.dev'))
    ap.add_argument('--password', default=os.environ.get('DIRECTUS_ADMIN_PASSWORD', 'openfund-admin-2026'))
    a = ap.parse_args()
    base = a.url.rstrip('/')
    token = req('POST', f'{base}/auth/login', body={'email': a.email, 'password': a.password})['data']['access_token']

    # ---------- ui_messages -------------------------------------------------
    landing = json.load(open(os.path.join(REPO, 'dist', 'translations.json'), encoding='utf8'))
    terminal = json.load(open(os.path.join(HERE, 'terminal-i18n.json'), encoding='utf8'))
    existing = req('GET', f'{base}/items/ui_messages?fields=key&limit=-1', token)['data']
    have = {m['key'] for m in existing}

    created = 0
    for fa, en in landing.items():
        if fa in have:
            continue
        req('POST', f'{base}/items/ui_messages', token, msg_payload(fa, 'landing', fa, en))
        created += 1
    for k, v in terminal.items():
        if k in have:
            continue
        req('POST', f'{base}/items/ui_messages', token, msg_payload(k, 'terminal', v['fa'], v.get('en') or v['fa']))
        created += 1
    print(f'ui_messages: {created} created, {len(have)} already present')

    # ---------- navigation --------------------------------------------------
    NAV = [
        ('landing_header', '#accounts', 'حساب‌های پراپ', 'Prop accounts', 1),
        ('landing_header', '#markets', 'بازارها', 'Markets', 2),
        ('landing_header', '#how', 'چطور کار می‌کند؟', 'How it works?', 3),
        ('landing_header', '#team', 'تیم ما', 'Our team', 4),
        ('landing_header', '#/terminal', 'ورود به ترمینال', 'Enter the terminal', 5),
        ('terminal_header', '#/', 'معامله', 'Trade', 1),
        ('terminal_header', '#/#markets', 'بازارها', 'Markets', 2),
        ('terminal_header', '#', 'پرتفوی', 'Portfolio', 3),
        ('terminal_header', '#', 'بیشتر', 'More', 4),
        ('landing_footer', '#top', 'بازگشت به بالا', 'Back to top', 1),
    ]
    existing_nav = req('GET', f'{base}/items/navigation_items?fields=id,location,route&limit=-1', token)['data']
    have_nav = {(n['location'], n['route']) for n in existing_nav}
    nav_created = 0
    for location, route, fa, en, sort in NAV:
        if (location, route) in have_nav:
            continue
        req('POST', f'{base}/items/navigation_items', token, {
            'location': location, 'route': route, 'sort': sort, 'visible': True, 'status': 'published',
            'translations': [
                {'language_code': 'fa', 'label': fa},
                {'language_code': 'en', 'label': en},
            ],
        })
        nav_created += 1
    print(f'navigation_items: {nav_created} created, {len(existing_nav)} already present')

    # ---------- pages (SEO/meta) --------------------------------------------
    PAGES = [
        ('landing', 'landing', 'اوپن‌فاند — سرمایه، در امتداد مهارت تو', 'Openfund — Capital, in line with your skill',
         'اوپن‌فاند؛ مسیری برای تبدیل مهارت معامله‌گری به فرصت تأمین سرمایه. حساب‌های پراپ، قوانین روشن و نمای بازارهای جهانی.',
         'Openfund — a path from trading skill to funded capital. Prop accounts, clear rules and global markets.'),
        ('terminal', 'terminal', 'اوپن‌فاند — ترمینال معاملاتی', 'Openfund — Trading Terminal',
         'ترمینال معاملاتی حرفه‌ای اوپن‌فاند — چارت ولا و داده‌های زندهٔ گینس.',
         'Openfund professional trading terminal — Vela charts and live Gains data.'),
    ]
    existing_pages = req('GET', f'{base}/items/pages?fields=slug&limit=-1', token)['data']
    have_pages = {p['slug'] for p in existing_pages}
    pages_created = 0
    for slug, template, fa_t, en_t, fa_d, en_d in PAGES:
        if slug in have_pages:
            continue
        req('POST', f'{base}/items/pages', token, {
            'slug': slug, 'template': template, 'status': 'published',
            'translations': [
                {'language_code': 'fa', 'title': fa_t, 'seo_title': fa_t, 'seo_description': fa_d},
                {'language_code': 'en', 'title': en_t, 'seo_title': en_t, 'seo_description': en_d},
            ],
        })
        pages_created += 1
    print(f'pages: {pages_created} created, {len(existing_pages)} already present')

    # ---------- site settings -----------------------------------------------
    settings = req('GET', f'{base}/items/site_settings?fields=id,default_language', token)['data']
    if not settings.get('id'):
        req('PATCH', f'{base}/items/site_settings', token, {'default_language': 'fa'})
        print('site_settings: created (default_language=fa)')
    else:
        print('site_settings: present')
    print('seed OK')

if __name__ == '__main__':
    main()
