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
    ensure_alias('navigation_items', 'translations', None)

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
    ensure_alias('pages', 'translations', None)

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


    # --- round-6: content-editing UX ---------------------------------------
    # section grouping + friendly label so editors browse by page section
    ensure_field('ui_messages', 'section', 'string',
        meta={'interface': 'select-dropdown', 'options': {'choices': [
            {'text': 'هدر / ناوبری', 'value': 'navigation'},
            {'text': 'هیرو (بالای صفحه)', 'value': 'hero'},
            {'text': 'معرفی', 'value': 'intro'},
            {'text': 'بازارها', 'value': 'markets'},
            {'text': 'حساب‌ها و پلن‌ها', 'value': 'accounts'},
            {'text': 'چطور کار می‌کند', 'value': 'how'},
            {'text': 'تیم', 'value': 'team'},
            {'text': 'قوانین', 'value': 'rules'},
            {'text': 'مبانی فنی', 'value': 'platform'},
            {'text': 'فوتر', 'value': 'footer'},
            {'text': 'متن‌های حقوقی', 'value': 'legal'},
            {'text': 'ترمینال — هدر', 'value': 'term_header'},
            {'text': 'ترمینال — پنل معامله', 'value': 'term_trade'},
            {'text': 'ترمینال — مارکت', 'value': 'term_markets'},
            {'text': 'ترمینال — دیتابوک', 'value': 'term_book'},
            {'text': 'ترمینال — نوار وضعیت', 'value': 'term_status'},
            {'text': 'عمومی', 'value': 'general'},
        ]}, 'required': False})
    ensure_field('ui_messages', 'label', 'string',
        meta={'interface': 'input', 'options': {'placeholder': 'نام فهمیدن برای редакتر — مثلاً: تیتر هیرو'}, 'required': False})

    # hide the raw translation tables from the sidebar (edited inline in parents)
    for hide in ['ui_message_translations', 'navigation_item_translations', 'page_translations']:
        cur = req('GET', f'{base}/collections/{hide}', token)['data']
        if not cur['meta'].get('hidden'):
            req('PATCH', f'{base}/collections/{hide}', token, {'meta': {'hidden': True, 'icon': 'translate'}})
            print(f'  collection {hide}: hidden from sidebar')
    # friendly name + icon for the main collections
    for coll, icon, note in [
        ('ui_messages', 'article', 'تمام متن‌های لندینگ و ترمینال — fa/en + بخش صفحه'),
        ('navigation_items', 'menu', 'آیتم‌های منو (هدر/فوتر)'),
        ('pages', 'public', 'سئو و متادیتای صفحات'),
    ]:
        cur = req('GET', f'{base}/collections/{coll}', token)['data']
        req('PATCH', f'{base}/collections/{coll}', token, {'meta': {'icon': icon, 'note': note, 'sort': 1 if coll == 'ui_messages' else None}})
        print(f'  collection {coll}: icon/note set')

    # ---------------- challenge_plans (commercial catalog, shared table) --
    # The backend's own table (same database). Directus becomes the editing
    # surface; the engine/seed remain the writer of record for provisioning.
    ensure_collection('challenge_plans', {'icon': 'inventory_2', 'note': 'چلنج‌ها — کاتالوگ تجاری (منبع واحد قیمت و شرایط). نوشتن: فقط ادمین.'})
    ensure_field('challenge_plans', 'slug', 'string', meta={'interface': 'input', 'readonly': True}, schema={'is_nullable': False})
    ensure_field('challenge_plans', 'name', 'string', meta={'interface': 'input'}, schema={'is_nullable': False})
    ensure_field('challenge_plans', 'status', 'string',
        meta={'interface': 'select-dropdown', 'options': {'choices': [
            {'text': 'Active', 'value': 'active'}, {'text': 'Inactive', 'value': 'inactive'},
        ]}, 'required': True}, schema={'default_value': 'active'})
    ensure_field('challenge_plans', 'configuration', 'json',
        meta={'interface': 'input-code', 'options': {'language': 'json'}, 'note': 'JSON شرایط پلن: sizes/prices/targets/limits — با اعتبارسنجی فرانت‌اند', 'width': 'full'}, schema={'default_value': '{}'})
    ensure_field('challenge_plans', 'created_at', 'timestamp', meta={'interface': 'datetime', 'hidden': True, 'readonly': True}, schema={})
    ensure_field('challenge_plans', 'updated_at', 'timestamp', meta={'interface': 'datetime', 'hidden': True, 'readonly': True}, schema={})

    # ---------------- home_content (product gateway) ----------------------
    if 'home_content' in existing:
        print('collection home_content: exists')
    else:
        req('POST', f'{base}/collections', token, {
            'collection': 'home_content',
            'meta': {'icon': 'wysiwyg', 'note': 'محتوای صفحهٔ خانه — دوزبانه', 'singleton': True},
            'schema': {},
        })
        print('collection home_content: created')
    ensure_field('home_content', 'status', 'string',
        meta={'interface': 'select-dropdown', 'options': {'choices': [
            {'text': 'Published', 'value': 'published'}, {'text': 'Draft', 'value': 'draft'}, {'text': 'Archived', 'value': 'archived'},
        ]}, 'special': ['status']}, schema=STATUS_SCHEMA)
    ensure_field('home_content', 'prop_cta_destination', 'string',
        meta={'interface': 'select-dropdown', 'options': {'choices': [
            {'text': 'Trading Challenges', 'value': 'challenges'}, {'text': 'Terminal', 'value': 'terminal'},
        ]}, 'required': True}, schema={'default_value': 'challenges'})
    ensure_field('home_content', 'perpetual_cta_destination', 'string',
        meta={'interface': 'select-dropdown', 'options': {'choices': [
            {'text': 'Trading Challenges', 'value': 'challenges'}, {'text': 'Terminal', 'value': 'terminal'},
        ]}, 'required': True}, schema={'default_value': 'terminal'})
    ensure_field('home_content', 'prop_image', 'uuid', meta={'interface': 'file-image', 'special': ['file']}, schema={})
    ensure_field('home_content', 'perpetual_image', 'uuid', meta={'interface': 'file-image', 'special': ['file']}, schema={})
    ensure_collection('home_content_translations')
    ensure_field('home_content_translations', 'home_content_id', 'integer',
        meta={'interface': 'select-dropdown-m2o', 'special': ['m2o'], 'required': True}, schema={'is_nullable': False})
    ensure_field('home_content_translations', 'language_code', 'string', meta=dict(LANG_META), schema={'is_nullable': False})
    for f, it in [('headline', 'input'), ('sub', 'input-multiline'), ('note', 'input-multiline'),
                  ('prop_title', 'input'), ('prop_description', 'input-multiline'), ('prop_cta', 'input'),
                  ('perpetual_title', 'input'), ('perpetual_description', 'input-multiline'), ('perpetual_cta', 'input'),
                  ('seo_title', 'input'), ('seo_description', 'input-multiline')]:
        ensure_field('home_content_translations', f, 'text', meta={'interface': it}, schema={})
    ensure_relation('home_content_translations', 'home_content_id', 'home_content', one_field='translations')
    ensure_alias('home_content', 'translations', None)

    # ---------------- faqs ------------------------------------------------
    ensure_collection('faqs', {'sort_field': 'sort', 'icon': 'help', 'note': 'پرسش‌های متداول صفحهٔ چلنج‌ها'})
    ensure_field('faqs', 'sort', 'integer', meta={'interface': 'input', 'hidden': True}, schema={'default_value': 0})
    ensure_field('faqs', 'page', 'string',
        meta={'interface': 'select-dropdown', 'options': {'choices': [
            {'text': 'Trading Challenges', 'value': 'challenges'},
        ]}, 'required': True}, schema={'default_value': 'challenges'})
    ensure_field('faqs', 'status', 'string',
        meta={'interface': 'select-dropdown', 'options': {'choices': [
            {'text': 'Published', 'value': 'published'}, {'text': 'Draft', 'value': 'draft'}, {'text': 'Archived', 'value': 'archived'},
        ]}, 'special': ['status']}, schema=STATUS_SCHEMA)
    ensure_collection('faq_translations')
    ensure_field('faq_translations', 'faq_id', 'integer',
        meta={'interface': 'select-dropdown-m2o', 'special': ['m2o'], 'required': True}, schema={'is_nullable': False})
    ensure_field('faq_translations', 'language_code', 'string', meta=dict(LANG_META), schema={'is_nullable': False})
    ensure_field('faq_translations', 'question', 'text', meta={'interface': 'input-multiline', 'required': True}, schema={'is_nullable': False})
    ensure_field('faq_translations', 'answer', 'text', meta={'interface': 'input-multiline', 'required': True}, schema={'is_nullable': False})
    ensure_relation('faq_translations', 'faq_id', 'faqs', one_field='translations')
    ensure_alias('faqs', 'translations', None)

    # ---------------- trading_rules (rulebook sections) --------------------
    ensure_collection('trading_rules', {'sort_field': 'sort', 'icon': 'gavel', 'note': 'بخش‌های رول‌بوک — ترتیب/وضعیت/محتوا دوزبانه'})
    ensure_field('trading_rules', 'sort', 'integer', meta={'interface': 'input', 'hidden': True}, schema={'default_value': 0})
    ensure_field('trading_rules', 'section_key', 'string', meta={'interface': 'input', 'note': 'شناسه/لنگر بخش (انگلیسی، یکتا)', 'readonly': True}, schema={'is_unique': True})
    ensure_field('trading_rules', 'review_status', 'string',
        meta={'interface': 'select-dropdown', 'options': {'choices': [
            {'text': 'Current (شروع کرده)', 'value': 'current'}, {'text': 'Draft (پیش‌نویس)', 'value': 'draft'}, {'text': 'Planned (برنامه‌ریزی‌شده)', 'value': 'planned'},
        ]}, 'required': True}, schema={'default_value': 'draft'})
    ensure_field('trading_rules', 'effective_date', 'date', meta={'interface': 'datetime'}, schema={})
    ensure_field('trading_rules', 'status', 'string',
        meta={'interface': 'select-dropdown', 'options': {'choices': [
            {'text': 'Published', 'value': 'published'}, {'text': 'Draft', 'value': 'draft'}, {'text': 'Archived', 'value': 'archived'},
        ]}, 'special': ['status']}, schema=STATUS_SCHEMA)
    ensure_collection('trading_rule_translations')
    ensure_field('trading_rule_translations', 'trading_rule_id', 'integer',
        meta={'interface': 'select-dropdown-m2o', 'special': ['m2o'], 'required': True}, schema={'is_nullable': False})
    ensure_field('trading_rule_translations', 'language_code', 'string', meta=dict(LANG_META), schema={'is_nullable': False})
    ensure_field('trading_rule_translations', 'title', 'text', meta={'interface': 'input', 'required': True}, schema={'is_nullable': False})
    ensure_field('trading_rule_translations', 'paragraphs', 'json',
        meta={'interface': 'list', 'options': {'template': '{{item}}'}, 'note': 'پاراگراف‌های بخش — هر آیتم یک پاراگراف'}, schema={})
    ensure_field('trading_rule_translations', 'formula', 'text', meta={'interface': 'input-multiline', 'note': 'فرمول (اختیاری، انگلیسی)'}, schema={})
    ensure_field('trading_rule_translations', 'explanation_title', 'text', meta={'interface': 'input'}, schema={})
    ensure_field('trading_rule_translations', 'explanation_body', 'text', meta={'interface': 'input-multiline'}, schema={})
    ensure_field('trading_rule_translations', 'table', 'json',
        meta={'interface': 'input-code', 'options': {'language': 'json'}, 'note': 'جدول: {caption, columns[2], rows[[a,b]]}'}, schema={})
    ensure_relation('trading_rule_translations', 'trading_rule_id', 'trading_rules', one_field='translations')
    ensure_alias('trading_rules', 'translations', None)

    # ---------------- legal_documents --------------------------------------
    ensure_collection('legal_documents', {'sort_field': 'sort', 'icon': 'gavel', 'note': 'اسناد حقوقی و سلب مسئولیت — نسخه‌دار'})
    ensure_field('legal_documents', 'sort', 'integer', meta={'interface': 'input', 'hidden': True}, schema={'default_value': 0})
    ensure_field('legal_documents', 'doc_type', 'string',
        meta={'interface': 'select-dropdown', 'options': {'choices': [
            {'text': 'Important information & disclaimer', 'value': 'overview'},
            {'text': 'Simulated trading environment', 'value': 'simulated-environment'},
            {'text': 'No investment services', 'value': 'no-investment-services'},
            {'text': 'General risk warning', 'value': 'general-risk'},
            {'text': 'Corporate information & access', 'value': 'corporate'},
            {'text': 'Offices', 'value': 'offices'},
            {'text': 'Hosting & infrastructure note', 'value': 'hosting'},
        ]}, 'required': True}, schema={'default_value': 'overview'})
    ensure_field('legal_documents', 'version', 'string', meta={'interface': 'input', 'note': 'مثال: 2026-11'}, schema={'default_value': '2026-11'})
    ensure_field('legal_documents', 'effective_date', 'date', meta={'interface': 'datetime'}, schema={})
    ensure_field('legal_documents', 'status', 'string',
        meta={'interface': 'select-dropdown', 'options': {'choices': [
            {'text': 'Published', 'value': 'published'}, {'text': 'Draft', 'value': 'draft'}, {'text': 'Archived', 'value': 'archived'},
        ]}, 'special': ['status']}, schema=STATUS_SCHEMA)
    ensure_collection('legal_document_translations')
    ensure_field('legal_document_translations', 'legal_document_id', 'integer',
        meta={'interface': 'select-dropdown-m2o', 'special': ['m2o'], 'required': True}, schema={'is_nullable': False})
    ensure_field('legal_document_translations', 'language_code', 'string', meta=dict(LANG_META), schema={'is_nullable': False})
    ensure_field('legal_document_translations', 'title', 'text', meta={'interface': 'input', 'required': True}, schema={'is_nullable': False})
    ensure_field('legal_document_translations', 'paragraphs', 'json',
        meta={'interface': 'list', 'options': {'template': '{{item}}'}, 'note': 'پاراگراف‌های سند'}, schema={})
    ensure_relation('legal_document_translations', 'legal_document_id', 'legal_documents', one_field='translations')
    ensure_alias('legal_documents', 'translations', None)

    # ---------------- footer_links -----------------------------------------
    ensure_collection('footer_links', {'sort_field': 'sort', 'icon': 'link', 'note': 'پیوندهای فوتر — مقصد از فهرست مجاز'})
    ensure_field('footer_links', 'sort', 'integer', meta={'interface': 'input', 'hidden': True}, schema={'default_value': 0})
    ensure_field('footer_links', 'destination', 'string',
        meta={'interface': 'select-dropdown', 'options': {'choices': [
            {'text': 'Challenges page', 'value': 'challenges'},
            {'text': 'Markets page', 'value': 'markets'},
            {'text': 'Rulebook page', 'value': 'rulebook'},
            {'text': 'Transparency page', 'value': 'transparency'},
            {'text': 'Challenges → accounts section', 'value': 'accounts-section'},
            {'text': 'Challenges → team section', 'value': 'team-section'},
            {'text': 'Challenges → FAQ section', 'value': 'faq-section'},
            {'text': 'GitHub repository', 'value': 'github'},
        ]}, 'required': True}, schema={'default_value': 'challenges'})
    ensure_field('footer_links', 'status', 'string',
        meta={'interface': 'select-dropdown', 'options': {'choices': [
            {'text': 'Published', 'value': 'published'}, {'text': 'Draft', 'value': 'draft'}, {'text': 'Archived', 'value': 'archived'},
        ]}, 'special': ['status']}, schema=STATUS_SCHEMA)
    ensure_collection('footer_link_translations')
    ensure_field('footer_link_translations', 'footer_link_id', 'integer',
        meta={'interface': 'select-dropdown-m2o', 'special': ['m2o'], 'required': True}, schema={'is_nullable': False})
    ensure_field('footer_link_translations', 'language_code', 'string', meta=dict(LANG_META), schema={'is_nullable': False})
    ensure_field('footer_link_translations', 'label', 'text', meta={'interface': 'input', 'required': True}, schema={'is_nullable': False})
    ensure_relation('footer_link_translations', 'footer_link_id', 'footer_links', one_field='translations')
    ensure_alias('footer_links', 'translations', None)

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
        ('home_content', {'status': {'_eq': 'published'}}),
        ('home_content_translations', None),
        ('faqs', {'status': {'_eq': 'published'}}),
        ('faq_translations', None),
        ('trading_rules', {'status': {'_eq': 'published'}}),
        ('trading_rule_translations', None),
        ('legal_documents', {'status': {'_eq': 'published'}}),
        ('legal_document_translations', None),
        ('footer_links', {'status': {'_eq': 'published'}}),
        ('footer_link_translations', None),
        ('challenge_plans', {'status': {'_eq': 'active'}}),
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
