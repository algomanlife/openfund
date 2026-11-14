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

def license_preflight(base, token):
    """Directus 12 enforces a license tier (GET /license). The Core tier allows 25
    collections and ignores custom permission rules, which this schema needs
    (public read filtered by status). Directus 11.x has no /license route — skip.
    Fail early with an actionable message instead of a confusing 403/RESOURCE_RESTRICTED
    half-way through the run. See docs/backstage/DIRECTUS_12_ASSESSMENT.md."""
    r = urllib.request.Request(f'{base}/license', method='GET')
    r.add_header('Authorization', f'Bearer {token}')
    try:
        with urllib.request.urlopen(r, timeout=30) as resp:
            lic = json.loads(resp.read() or b'{}').get('data') or {}
    except urllib.error.HTTPError as e:
        if e.code == 404:
            return  # Directus 11.x: no licensing subsystem
        raise SystemExit(f'HTTP {e.code} GET {base}/license')
    ent = lic.get('entitlements') or {}
    rules = (ent.get('custom_permission_rules_enabled') or {}).get('default')
    limit = (ent.get('collections') or {}).get('limit')
    used = (lic.get('usage') or {}).get('collections')
    print(f"license: {lic.get('name')} status={lic.get('status')} collections={used}/{limit} custom_permission_rules={rules}")
    if lic.get('status') == 'locked' or rules is False:
        raise SystemExit(
            'ABORT: this Directus instance is not licensed for Openfund\'s content model '
            '(custom permission rules and/or more than the Core collection limit). '
            'Add a license or Open Innovation Grant key first — see docs/backstage/DIRECTUS_12_ASSESSMENT.md. '
            'No schema or permission changes were made.')

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--url', default=os.environ.get('DIRECTUS_URL', 'http://localhost:8055'))
    ap.add_argument('--email', default=os.environ.get('DIRECTUS_ADMIN_EMAIL', 'admin@openfund.dev'))
    ap.add_argument('--password', default=os.environ.get('DIRECTUS_ADMIN_PASSWORD', 'openfund-admin-2026'))
    a = ap.parse_args()
    base = a.url.rstrip('/')

    token = req('POST', f'{base}/auth/login', body={'email': a.email, 'password': a.password})['data']['access_token']
    print('login OK')
    license_preflight(base, token)

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


    def ensure_alias(collection, field, related_field, meta=None):
        fields = [f['field'] for f in req('GET', f'{base}/fields/{collection}', token)['data']]
        if field in fields:
            return
        req('POST', f'{base}/fields/{collection}', token, {
            'field': field, 'type': 'alias',
            'meta': meta or {'special': ['o2m'], 'interface': 'list-o2m', 'options': {'template': '{{language_code}}: {{value}}'}},
            'schema': None,
        })
        print(f'  alias field {collection}.{field}: created')

    def update_field_meta(collection, field, meta_patch):
        """PATCH a field's presentation metadata (e.g. new dropdown choices).
        Non-destructive: only the keys in meta_patch are changed."""
        fields = req('GET', f'{base}/fields/{collection}', token)['data']
        cur = next((f for f in fields if f['field'] == field), None)
        if not cur:
            return
        merged = {**(cur.get('meta') or {}), **meta_patch}
        if merged == (cur.get('meta') or {}):
            return
        req('PATCH', f'{base}/fields/{collection}/{field}', token, {'meta': merged})
        print(f'  field meta {collection}.{field}: updated')

    def ensure_relation(collection, field, related, one_field=None):
        rels = req('GET', f'{base}/relations', token)['data']
        cur = next((r for r in rels if r['collection'] == collection and r['field'] == field), None)
        if cur:
            if one_field and cur.get('meta', {}).get('one_field') != one_field:
                req('PATCH', f'{base}/relations/{collection}/{field}', token,
                    {'meta': {**(cur.get('meta') or {}), 'one_field': one_field}})
                print(f'  relation {collection}.{field}: one_field={one_field} updated via Directus API')
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
    ensure_alias('ui_messages', 'translations', None)

    # React labels use the same translation table and publication permissions.
    # Searchable metadata contains presentation provenance only, never accounts.
    update_field_meta('ui_messages', 'namespace', {
        'interface': 'select-dropdown', 'options': {'choices': [
            {'text': 'Website (legacy)', 'value': 'landing'},
            {'text': 'Terminal (legacy)', 'value': 'terminal'},
            {'text': 'Shared', 'value': 'common'},
            {'text': 'Website / Dashboard / Terminal (React)', 'value': 'react'},
        ]}, 'required': True})
    for name, label in [
        ('product_area', 'Product area'), ('content_page', 'Page'),
        ('content_routes', 'Routes'), ('source_location', 'Source location'),
        ('content_owner', 'Content owner'),
    ]:
        ensure_field('ui_messages', name, 'text',
                     meta={'interface': 'input-multiline', 'note': label})
    ensure_field('ui_messages', 'translation_status', 'string', meta={
        'interface': 'select-dropdown', 'options': {'choices': [
            {'text': 'Review required', 'value': 'review_required'},
            {'text': 'Reviewed', 'value': 'reviewed'},
        ]}}, schema={'default_value': 'review_required'})
    ensure_field('ui_messages', 'date_updated', 'timestamp',
                 meta={'special': ['date-updated'], 'interface': 'datetime', 'readonly': True, 'hidden': False})

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
    live_collections = {c['collection'] for c in req('GET', f'{base}/collections', token)['data']}
    for hide in ['ui_message_translations', 'navigation_item_translations', 'page_translations',
                 'faq_translations', 'faq_category_translations', 'legal_document_translations',
                 'footer_link_translations', 'terminal_section_translations',
                 'learning_path_translations', 'lesson_translations', 'glossary_term_translations',
                 'tool_translations', 'referral_content_translations', 'trading_rule_translations']:
        if hide not in live_collections:
            continue
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
    ensure_field('faq_translations', 'links', 'json',
        meta={'interface': 'input-code', 'options': {'language': 'json'},
              'note': 'پیوندهای مرتبط: [{target:{kind,slug},label:{fa,en}}]'}, schema={})
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

    # ---------------- website expansion: FAQ categories ---------------------
    # The site-wide FAQ is grouped by topic. Categories are their own collection
    # so editors can rename, reorder or retire a topic without touching code.
    ensure_collection('faq_categories', {'sort_field': 'sort', 'icon': 'category', 'note': 'دسته‌بندی پرسش‌های متداول سایت'})
    ensure_field('faq_categories', 'slug', 'string',
        meta={'interface': 'input', 'unique': True, 'note': 'ASCII key, never changes', 'readonly': True},
        schema={'is_unique': True, 'is_nullable': False, 'max_length': 48})
    ensure_field('faq_categories', 'sort', 'integer', meta={'interface': 'input', 'hidden': True}, schema={'default_value': 0})
    ensure_field('faq_categories', 'icon', 'string',
        meta={'interface': 'select-dropdown', 'options': {'choices': [
            {'text': 'Start', 'value': 'start'}, {'text': 'Payout', 'value': 'payout'},
            {'text': 'Rules', 'value': 'rules'}, {'text': 'Partner', 'value': 'partner'},
            {'text': 'Terminal', 'value': 'terminal'}, {'text': 'Verify', 'value': 'verify'},
            {'text': 'General', 'value': 'general'},
        ]}}, schema={'default_value': 'general'})
    ensure_field('faq_categories', 'status', 'string',
        meta={'interface': 'select-dropdown', 'options': {'choices': [
            {'text': 'Published', 'value': 'published'}, {'text': 'Draft', 'value': 'draft'}, {'text': 'Archived', 'value': 'archived'},
        ]}, 'special': ['status']}, schema=STATUS_SCHEMA)
    ensure_collection('faq_category_translations')
    ensure_field('faq_category_translations', 'faq_category_id', 'integer',
        meta={'interface': 'select-dropdown-m2o', 'special': ['m2o'], 'required': True}, schema={'is_nullable': False})
    ensure_field('faq_category_translations', 'language_code', 'string', meta=dict(LANG_META), schema={'is_nullable': False})
    ensure_field('faq_category_translations', 'label', 'text', meta={'interface': 'input', 'required': True}, schema={'is_nullable': False})
    ensure_field('faq_category_translations', 'description', 'text', meta={'interface': 'input-multiline'}, schema={})
    ensure_relation('faq_category_translations', 'faq_category_id', 'faq_categories', one_field='translations')
    ensure_alias('faq_categories', 'translations', None)

    # faqs gains a stable URL/anchor key and a category (both additive; existing
    # challenge-page rows keep working because the fields are nullable)
    ensure_field('faqs', 'slug', 'string',
        meta={'interface': 'input', 'unique': True, 'note': 'ASCII key used in shareable question links', 'readonly': True},
        schema={'is_unique': True, 'max_length': 96})
    ensure_field('faqs', 'category', 'integer',
        meta={'interface': 'select-dropdown-m2o', 'note': 'FAQ topic group (empty = challenges page)'},
        schema={'is_nullable': True})
    ensure_relation('faqs', 'category', 'faq_categories')
    update_field_meta('faqs', 'page', {'options': {'choices': [
        {'text': 'Trading Challenges', 'value': 'challenges'},
        {'text': 'Website FAQ hub', 'value': 'faq'},
        {'text': 'Growth Partner', 'value': 'referral'},
    ], 'allow_multiple': False}, 'required': True})
    update_field_meta('faqs', 'slug', {'note': 'ASCII key used in shareable question links'})
    update_field_meta('faqs', 'sort', {'hidden': True})

    # ---------------- website expansion: Learning Center --------------------
    ensure_collection('learning_paths', {'sort_field': 'sort', 'icon': 'route', 'note': 'مسیرهای یادگیری — مركز آموزش'})
    ensure_field('learning_paths', 'slug', 'string',
        meta={'interface': 'input', 'unique': True, 'readonly': True}, schema={'is_unique': True, 'is_nullable': False, 'max_length': 64})
    ensure_field('learning_paths', 'path_key', 'string',
        meta={'interface': 'input', 'note': 'A/B/C… identifier', 'readonly': True}, schema={'is_unique': True, 'max_length': 16})
    ensure_field('learning_paths', 'sort', 'integer', meta={'interface': 'input', 'hidden': True}, schema={'default_value': 0})
    ensure_field('learning_paths', 'level', 'string',
        meta={'interface': 'select-dropdown', 'options': {'choices': [
            {'text': 'Foundation', 'value': 'foundation'}, {'text': 'Practitioner', 'value': 'practitioner'},
            {'text': 'Advanced', 'value': 'advanced'},
        ]}, 'required': True}, schema={'default_value': 'foundation'})
    ensure_field('learning_paths', 'status', 'string',
        meta={'interface': 'select-dropdown', 'options': {'choices': [
            {'text': 'Published', 'value': 'published'}, {'text': 'Draft', 'value': 'draft'}, {'text': 'Archived', 'value': 'archived'},
        ]}, 'special': ['status']}, schema=STATUS_SCHEMA)
    ensure_collection('learning_path_translations')
    ensure_field('learning_path_translations', 'learning_path_id', 'integer',
        meta={'interface': 'select-dropdown-m2o', 'special': ['m2o'], 'required': True}, schema={'is_nullable': False})
    ensure_field('learning_path_translations', 'language_code', 'string', meta=dict(LANG_META), schema={'is_nullable': False})
    ensure_field('learning_path_translations', 'eyebrow', 'text', meta={'interface': 'input'}, schema={})
    ensure_field('learning_path_translations', 'title', 'text', meta={'interface': 'input', 'required': True}, schema={'is_nullable': False})
    ensure_field('learning_path_translations', 'summary', 'text', meta={'interface': 'input-multiline'}, schema={})
    ensure_field('learning_path_translations', 'outcomes', 'json',
        meta={'interface': 'list', 'options': {'template': '{{item}}'}, 'note': 'انتظارات یادگیری — هر آیتم یک مورد'}, schema={})
    ensure_relation('learning_path_translations', 'learning_path_id', 'learning_paths', one_field='translations')
    ensure_alias('learning_paths', 'translations', None)
    ensure_alias('learning_paths', 'lessons', None, meta={
        'special': ['o2m'], 'interface': 'list-o2m',
        'options': {'template': '{{sort}}. {{slug}}'},
    })

    ensure_collection('lessons', {'sort_field': 'sort', 'icon': 'menu_book', 'note': 'درسهای مركز آموزش — محتوا بلوك‌بلوك است'})
    ensure_field('lessons', 'slug', 'string',
        meta={'interface': 'input', 'unique': True, 'readonly': True}, schema={'is_unique': True, 'is_nullable': False, 'max_length': 96})
    ensure_field('lessons', 'path_id', 'integer',
        meta={'interface': 'select-dropdown-m2o', 'special': ['m2o'], 'required': True}, schema={'is_nullable': False})
    ensure_field('lessons', 'sort', 'integer', meta={'interface': 'input', 'hidden': True}, schema={'default_value': 0})
    ensure_field('lessons', 'minutes', 'integer', meta={'interface': 'input'}, schema={'default_value': 8})
    ensure_field('lessons', 'glossary', 'json', meta={'interface': 'input-code', 'options': {'language': 'json'}, 'note': 'اسلاگ واژه‌نامه'}, schema={})
    ensure_field('lessons', 'tools', 'json', meta={'interface': 'input-code', 'options': {'language': 'json'}, 'note': 'اسلاگ ابزارها'}, schema={})
    ensure_field('lessons', 'status', 'string',
        meta={'interface': 'select-dropdown', 'options': {'choices': [
            {'text': 'Published', 'value': 'published'}, {'text': 'Draft', 'value': 'draft'}, {'text': 'Archived', 'value': 'archived'},
        ]}, 'special': ['status']}, schema=STATUS_SCHEMA)
    ensure_relation('lessons', 'path_id', 'learning_paths', one_field='lessons')
    ensure_collection('lesson_translations')
    ensure_field('lesson_translations', 'lesson_id', 'integer',
        meta={'interface': 'select-dropdown-m2o', 'special': ['m2o'], 'required': True}, schema={'is_nullable': False})
    ensure_field('lesson_translations', 'language_code', 'string', meta=dict(LANG_META), schema={'is_nullable': False})
    ensure_field('lesson_translations', 'title', 'text', meta={'interface': 'input', 'required': True}, schema={'is_nullable': False})
    ensure_field('lesson_translations', 'summary', 'text', meta={'interface': 'input-multiline'}, schema={})
    ensure_field('lesson_translations', 'takeaways', 'json',
        meta={'interface': 'list', 'options': {'template': '{{item}}'}}, schema={})
    ensure_field('lesson_translations', 'blocks', 'json',
        meta={'interface': 'input-code', 'options': {'language': 'json'}, 'width': 'full',
              'note': 'بلوک‌های درس: p/h2/h3/ul/ol/note/formula/terms/table'}, schema={})
    ensure_relation('lesson_translations', 'lesson_id', 'lessons', one_field='translations')
    ensure_alias('lessons', 'translations', None)

    ensure_collection('glossary_terms', {'sort_field': 'sort', 'icon': 'translate', 'note': 'واژه‌نامهٔ مركز آموزش'})
    ensure_field('glossary_terms', 'slug', 'string',
        meta={'interface': 'input', 'unique': True, 'readonly': True}, schema={'is_unique': True, 'is_nullable': False, 'max_length': 64})
    ensure_field('glossary_terms', 'sort', 'integer', meta={'interface': 'input', 'hidden': True}, schema={'default_value': 0})
    ensure_field('glossary_terms', 'lessons', 'json', meta={'interface': 'input-code', 'options': {'language': 'json'}}, schema={})
    ensure_field('glossary_terms', 'tool', 'string', meta={'interface': 'input'}, schema={})
    ensure_field('glossary_terms', 'status', 'string',
        meta={'interface': 'select-dropdown', 'options': {'choices': [
            {'text': 'Published', 'value': 'published'}, {'text': 'Draft', 'value': 'draft'}, {'text': 'Archived', 'value': 'archived'},
        ]}, 'special': ['status']}, schema=STATUS_SCHEMA)
    ensure_collection('glossary_term_translations')
    ensure_field('glossary_term_translations', 'glossary_term_id', 'integer',
        meta={'interface': 'select-dropdown-m2o', 'special': ['m2o'], 'required': True}, schema={'is_nullable': False})
    ensure_field('glossary_term_translations', 'language_code', 'string', meta=dict(LANG_META), schema={'is_nullable': False})
    ensure_field('glossary_term_translations', 'term', 'text', meta={'interface': 'input', 'required': True}, schema={'is_nullable': False})
    ensure_field('glossary_term_translations', 'short', 'text', meta={'interface': 'input'}, schema={})
    ensure_field('glossary_term_translations', 'definition', 'text', meta={'interface': 'input-multiline'}, schema={})
    ensure_relation('glossary_term_translations', 'glossary_term_id', 'glossary_terms', one_field='translations')
    ensure_alias('glossary_terms', 'translations', None)

    # ---------------- website expansion: Tools Center -----------------------
    # Only the bilingual PROSE of a calculator lives here. The input fields,
    # the arithmetic and the result keys stay in code (features/tools), because
    # they are covered by automated tests and must never drift from the maths.
    ensure_collection('tools', {'sort_field': 'sort', 'icon': 'calculate', 'note': 'متن ابزارهای محاسباتی (فرمول و ورودی‌ها در کد)'})
    ensure_field('tools', 'slug', 'string',
        meta={'interface': 'input', 'unique': True, 'readonly': True}, schema={'is_unique': True, 'is_nullable': False, 'max_length': 64})
    ensure_field('tools', 'category', 'string',
        meta={'interface': 'select-dropdown', 'options': {'choices': [
            {'text': 'Sizing', 'value': 'sizing'}, {'text': 'Risk', 'value': 'risk'}, {'text': 'Analysis', 'value': 'analysis'},
        ]}, 'required': True}, schema={'default_value': 'risk'})
    ensure_field('tools', 'sort', 'integer', meta={'interface': 'input', 'hidden': True}, schema={'default_value': 0})
    ensure_field('tools', 'status', 'string',
        meta={'interface': 'select-dropdown', 'options': {'choices': [
            {'text': 'Published', 'value': 'published'}, {'text': 'Draft', 'value': 'draft'}, {'text': 'Archived', 'value': 'archived'},
        ]}, 'special': ['status']}, schema=STATUS_SCHEMA)
    ensure_collection('tool_translations')
    ensure_field('tool_translations', 'tool_id', 'integer',
        meta={'interface': 'select-dropdown-m2o', 'special': ['m2o'], 'required': True}, schema={'is_nullable': False})
    ensure_field('tool_translations', 'language_code', 'string', meta=dict(LANG_META), schema={'is_nullable': False})
    for f, it in [('name', 'input'), ('tagline', 'input'), ('about', 'input-multiline'),
                  ('method', 'input-multiline'), ('limitations', 'input-multiline')]:
        ensure_field('tool_translations', f, 'text', meta={'interface': it}, schema={})
    ensure_field('tool_translations', 'assumptions', 'json',
        meta={'interface': 'list', 'options': {'template': '{{item}}'}}, schema={})
    ensure_relation('tool_translations', 'tool_id', 'tools', one_field='translations')
    ensure_alias('tools', 'translations', None)

    # ---------------- website expansion: Growth Partner ---------------------
    # A singleton so the program can be flipped from pre-launch to live by an
    # editor; the copy is translated per locale like home_content.
    if 'referral_content' in existing:
        print('collection referral_content: exists')
    else:
        req('POST', f'{base}/collections', token, {
            'collection': 'referral_content',
            'meta': {'icon': 'volunteer_activism', 'note': 'صفحهٔ همیاری و معرفی — وضعیت برنامه + محتوا', 'singleton': True},
            'schema': {},
        })
        print('collection referral_content: created')
    ensure_field('referral_content', 'status', 'string',
        meta={'interface': 'select-dropdown', 'options': {'choices': [
            {'text': 'Published', 'value': 'published'}, {'text': 'Draft', 'value': 'draft'}, {'text': 'Archived', 'value': 'archived'},
        ]}, 'special': ['status']}, schema=STATUS_SCHEMA)
    ensure_field('referral_content', 'program_state', 'string',
        meta={'interface': 'select-dropdown', 'required': True, 'note': 'prelaunch = no reward terms published; live = program approved',
              'options': {'choices': [
            {'text': 'Pre-launch', 'value': 'prelaunch'}, {'text': 'Live', 'value': 'live'},
        ]}}, schema={'default_value': 'prelaunch'})
    ensure_collection('referral_content_translations')
    ensure_field('referral_content_translations', 'referral_content_id', 'integer',
        meta={'interface': 'select-dropdown-m2o', 'special': ['m2o'], 'required': True}, schema={'is_nullable': False})
    ensure_field('referral_content_translations', 'language_code', 'string', meta=dict(LANG_META), schema={'is_nullable': False})
    for f, it in [('hero_eyebrow', 'input'), ('hero_title', 'input'), ('hero_accent', 'input'),
                  ('hero_intro', 'input-multiline'), ('status_notice', 'input-multiline'),
                  ('dashboard_title', 'input'), ('dashboard_intro', 'input-multiline'),
                  ('cta_title', 'input'), ('cta_text', 'input-multiline'),
                  ('cta_primary', 'input'), ('cta_secondary', 'input'),
                  ('seo_title', 'input'), ('seo_description', 'input-multiline')]:
        ensure_field('referral_content_translations', f, 'text', meta={'interface': it}, schema={})
    for jf in ['benefits', 'stages', 'sections', 'faq', 'pending_decisions', 'dashboard_columns']:
        ensure_field('referral_content_translations', jf, 'json',
            meta={'interface': 'input-code', 'options': {'language': 'json'}, 'width': 'full'}, schema={})
    ensure_relation('referral_content_translations', 'referral_content_id', 'referral_content', one_field='translations')
    ensure_alias('referral_content', 'translations', None)

    # footer destinations whitelist: the four new public sections
    update_field_meta('footer_links', 'destination', {'options': {'choices': [
        {'text': 'Challenges page', 'value': 'challenges'},
        {'text': 'Markets page', 'value': 'markets'},
        {'text': 'Rulebook page', 'value': 'rulebook'},
        {'text': 'Transparency page', 'value': 'transparency'},
        {'text': 'FAQ page', 'value': 'faq'},
        {'text': 'Growth Partner page', 'value': 'referral'},
        {'text': 'Tools Center', 'value': 'tools'},
        {'text': 'Learning Center', 'value': 'learn'},
        {'text': 'Challenges → accounts section', 'value': 'accounts-section'},
        {'text': 'Challenges → team section', 'value': 'team-section'},
        {'text': 'Challenges → FAQ section', 'value': 'faq-section'},
        {'text': 'GitHub repository', 'value': 'github'},
    ], 'allow_multiple': False}})
    # pages template list gains the website pages
    update_field_meta('pages', 'template', {'options': {'choices': [
        {'text': 'Landing', 'value': 'landing'}, {'text': 'Terminal', 'value': 'terminal'},
        {'text': 'Website page', 'value': 'website'},
    ], 'allow_multiple': False}})
    # the whitepaper is reachable from the footer document links (not a footer_links destination)

    # ---------------- Openfund Whitepaper (living publication) --------------
    # One document, ordered chapters made of typed JSON blocks (per locale,
    # paired by index like lesson blocks), chart datasets whose NUMBERS live
    # on the parent row (labels are translated), and source references.
    # New rows default to draft: nothing is public until an editor publishes.
    # The public client validates every block (src/cms/whitepaper/schema.ts)
    # and falls back to the repository edition if an edition is incomplete.
    WP_STATUS_META = {'interface': 'select-dropdown', 'options': {'choices': [
        {'text': 'Published', 'value': 'published'}, {'text': 'Draft', 'value': 'draft'}, {'text': 'Archived', 'value': 'archived'},
    ]}, 'special': ['status'], 'width': 'half'}
    WP_DRAFT = {'default_value': 'draft', 'is_nullable': False}

    def wp_translations(parent, fk, fields):
        name = f'{parent[:-1] if parent.endswith("s") else parent}_translations'
        ensure_collection(name, {'hidden': True})
        ensure_field(name, fk, 'integer',
            meta={'interface': 'select-dropdown-m2o', 'special': ['m2o'], 'required': True, 'hidden': True}, schema={'is_nullable': False})
        ensure_field(name, 'language_code', 'string', meta=dict(LANG_META), schema={'is_nullable': False})
        for field, ftype, meta in fields:
            ensure_field(name, field, ftype, meta=meta, schema={})
        ensure_relation(name, fk, parent, one_field='translations')
        ensure_alias(parent, 'translations', None, meta={
            'special': ['o2m'], 'interface': 'list-o2m', 'options': {'template': '{{language_code}}'}})
        return name

    ensure_collection('whitepaper_documents', {'icon': 'description', 'display_template': '{{slug}} v{{version}}',
        'note': 'Openfund Whitepaper — document metadata, version and SEO (one row per publication)'})
    ensure_field('whitepaper_documents', 'slug', 'string',
        meta={'interface': 'input', 'required': True, 'note': 'openfund-whitepaper (the public page reads this slug)'},
        schema={'is_unique': True, 'is_nullable': False, 'max_length': 64})
    ensure_field('whitepaper_documents', 'version', 'string',
        meta={'interface': 'input', 'required': True, 'width': 'half', 'note': 'Semantic edition, e.g. 1.0'}, schema={'max_length': 16})
    ensure_field('whitepaper_documents', 'published_on', 'date', meta={'interface': 'datetime', 'required': True, 'width': 'half'}, schema={})
    ensure_field('whitepaper_documents', 'updated_on', 'date', meta={'interface': 'datetime', 'width': 'half', 'note': 'Latest editorial revision'}, schema={})
    ensure_field('whitepaper_documents', 'status', 'string', meta=WP_STATUS_META, schema=WP_DRAFT)
    wp_translations('whitepaper_documents', 'whitepaper_document_id', [
        ('title', 'text', {'interface': 'input', 'required': True}),
        ('subtitle', 'text', {'interface': 'input', 'required': True}),
        ('abstract', 'text', {'interface': 'input-multiline', 'required': True}),
        ('revision_note', 'text', {'interface': 'input-multiline', 'note': 'What changed in this edition'}),
        ('seo_title', 'text', {'interface': 'input'}),
        ('seo_description', 'text', {'interface': 'input-multiline'}),
    ])

    ensure_collection('whitepaper_chapters', {'icon': 'menu_book', 'sort_field': 'sort', 'display_template': '{{sort}}. {{slug}}',
        'note': 'Whitepaper chapters — ordered; blocks are typed JSON validated before rendering'})
    ensure_field('whitepaper_chapters', 'document', 'integer',
        meta={'interface': 'select-dropdown-m2o', 'special': ['m2o'], 'required': True, 'width': 'half'}, schema={'is_nullable': False})
    ensure_relation('whitepaper_chapters', 'document', 'whitepaper_documents', one_field='chapters')
    ensure_alias('whitepaper_documents', 'chapters', None, meta={'special': ['o2m'], 'interface': 'list-o2m', 'options': {'template': '{{sort}}. {{slug}}'}})
    ensure_field('whitepaper_chapters', 'slug', 'string',
        meta={'interface': 'input', 'required': True, 'width': 'half', 'note': 'URL anchor (#slug); lowercase letters, digits and hyphens'},
        schema={'is_unique': True, 'is_nullable': False, 'max_length': 64})
    ensure_field('whitepaper_chapters', 'sort', 'integer', meta={'interface': 'input', 'hidden': True}, schema={'default_value': 0})
    ensure_field('whitepaper_chapters', 'status', 'string', meta=WP_STATUS_META, schema=WP_DRAFT)
    wp_translations('whitepaper_chapters', 'whitepaper_chapter_id', [
        ('kicker', 'text', {'interface': 'input', 'required': True, 'note': 'Short chapter name used in the table of contents'}),
        ('title', 'text', {'interface': 'input', 'required': True}),
        ('summary', 'text', {'interface': 'input-multiline', 'required': True}),
        ('blocks', 'json', {'interface': 'input-code', 'options': {'language': 'json'}, 'width': 'full',
            'note': 'Blocks: lead/p/h3/list/quote/callout/features/stats/definitions/table/flow/architecture/mapping/timeline/chart/pricing/image/faq/refs — same order and types in fa and en; see docs/website/WHITEPAPER.md'}),
    ])

    ensure_collection('whitepaper_datasets', {'icon': 'bar_chart', 'sort_field': 'sort', 'display_template': '{{key}} ({{kind}})',
        'note': 'Whitepaper chart datasets — numbers here, translated labels in translations'})
    ensure_field('whitepaper_datasets', 'key', 'string',
        meta={'interface': 'input', 'required': True, 'width': 'half', 'note': 'Referenced by chart blocks'}, schema={'is_unique': True, 'is_nullable': False, 'max_length': 64})
    ensure_field('whitepaper_datasets', 'kind', 'string', meta={'interface': 'select-dropdown', 'required': True, 'width': 'half', 'options': {'choices': [
        {'text': 'Waterfall', 'value': 'waterfall'}, {'text': 'Bars', 'value': 'bars'}, {'text': 'Stacked', 'value': 'stacked'}]}}, schema={'default_value': 'bars'})
    ensure_field('whitepaper_datasets', 'unit', 'string', meta={'interface': 'select-dropdown', 'required': True, 'width': 'half', 'options': {'choices': [
        {'text': 'US dollars', 'value': 'usd'}, {'text': 'Percent', 'value': 'pct'}]}}, schema={'default_value': 'usd'})
    ensure_field('whitepaper_datasets', 'data', 'json', meta={'interface': 'input-code', 'options': {'language': 'json'}, 'width': 'full',
        'note': '{"segments": [keys], "points": [{"key", "value" | "values", "role": start|delta|subtotal}]} — numbers only'}, schema={})
    ensure_field('whitepaper_datasets', 'sources', 'json', meta={'interface': 'tags', 'note': 'Reference keys supporting the figures'}, schema={})
    ensure_field('whitepaper_datasets', 'sort', 'integer', meta={'interface': 'input', 'hidden': True}, schema={'default_value': 0})
    ensure_field('whitepaper_datasets', 'status', 'string', meta=WP_STATUS_META, schema=WP_DRAFT)
    wp_translations('whitepaper_datasets', 'whitepaper_dataset_id', [
        ('title', 'text', {'interface': 'input', 'required': True}),
        ('caption', 'text', {'interface': 'input-multiline'}),
        ('note', 'text', {'interface': 'input-multiline', 'note': 'Assumptions and limits (shown under the chart)'}),
        ('labels', 'json', {'interface': 'input-code', 'options': {'language': 'json'}, 'note': '{"points": {key: label}, "segments": {key: label}}'}),
    ])

    ensure_collection('whitepaper_references', {'icon': 'format_quote', 'sort_field': 'sort', 'display_template': '{{key}} — {{title}}',
        'note': 'Whitepaper sources — https only, with publication and access dates'})
    ensure_field('whitepaper_references', 'key', 'string', meta={'interface': 'input', 'required': True, 'width': 'half'}, schema={'is_unique': True, 'is_nullable': False, 'max_length': 64})
    ensure_field('whitepaper_references', 'kind', 'string', meta={'interface': 'select-dropdown', 'required': True, 'width': 'half', 'options': {'choices': [
        {'text': 'Repository', 'value': 'repository'}, {'text': 'Documentation', 'value': 'documentation'}, {'text': 'Release', 'value': 'release'},
        {'text': 'Provider', 'value': 'provider'}, {'text': 'Industry', 'value': 'industry'}]}}, schema={'default_value': 'documentation'})
    ensure_field('whitepaper_references', 'title', 'string', meta={'interface': 'input', 'required': True}, schema={'max_length': 255})
    ensure_field('whitepaper_references', 'publisher', 'string', meta={'interface': 'input', 'width': 'half'}, schema={'max_length': 128})
    ensure_field('whitepaper_references', 'url', 'string', meta={'interface': 'input', 'required': True, 'note': 'https:// only'}, schema={'max_length': 512})
    ensure_field('whitepaper_references', 'published_on', 'string', meta={'interface': 'input', 'width': 'half', 'note': 'As stated by the source'}, schema={'max_length': 128})
    ensure_field('whitepaper_references', 'accessed_on', 'date', meta={'interface': 'datetime', 'required': True, 'width': 'half'}, schema={})
    ensure_field('whitepaper_references', 'sort', 'integer', meta={'interface': 'input', 'hidden': True}, schema={'default_value': 0})
    ensure_field('whitepaper_references', 'status', 'string', meta=WP_STATUS_META, schema=WP_DRAFT)
    wp_translations('whitepaper_references', 'whitepaper_reference_id', [
        ('note', 'text', {'interface': 'input-multiline', 'required': True}),
    ])

    # ---------------- governance editorial content (Hybrid Governance v1.0) ----
    # EDITORIAL ONLY. Directus holds milestone wording and short content blocks;
    # it never holds councils, proposals, votes, eligibility or any governance
    # authority (those live in apps/backend, gov_* tables, no Directus access).
    update_field_meta('footer_links', 'destination', {'options': {'choices': [
        {'text': 'Challenges page', 'value': 'challenges'},
        {'text': 'Markets page', 'value': 'markets'},
        {'text': 'Rulebook page', 'value': 'rulebook'},
        {'text': 'Transparency page', 'value': 'transparency'},
        {'text': 'Governance page', 'value': 'governance'},
        {'text': 'FAQ page', 'value': 'faq'},
        {'text': 'Growth Partner page', 'value': 'referral'},
        {'text': 'Tools Center', 'value': 'tools'},
        {'text': 'Learning Center', 'value': 'learn'},
        {'text': 'Challenges → accounts section', 'value': 'accounts-section'},
        {'text': 'Challenges → team section', 'value': 'team-section'},
        {'text': 'Challenges → FAQ section', 'value': 'faq-section'},
        {'text': 'GitHub repository', 'value': 'github'},
    ], 'allow_multiple': False}})
    ensure_collection('governance_milestones', {'sort_field': 'sort', 'icon': 'flag', 'note': 'Governance roadmap wording. Editorial only — no governance authority.'})
    ensure_field('governance_milestones', 'sort', 'integer', meta={'interface': 'input', 'hidden': True}, schema={'default_value': 0})
    ensure_field('governance_milestones', 'key', 'string', meta={'interface': 'input', 'required': True, 'unique': True}, schema={'is_unique': True, 'is_nullable': False})
    ensure_field('governance_milestones', 'milestone_status', 'string',
        meta={'interface': 'select-dropdown', 'options': {'choices': [
            {'text': 'Planned', 'value': 'planned'}, {'text': 'In progress', 'value': 'in_progress'},
            {'text': 'Built (not yet in production use)', 'value': 'implemented'}, {'text': 'Not planned', 'value': 'not_planned'},
        ]}, 'required': True}, schema={'default_value': 'planned'})
    ensure_field('governance_milestones', 'status', 'string',
        meta={'interface': 'select-dropdown', 'options': {'choices': [
            {'text': 'Published', 'value': 'published'}, {'text': 'Draft', 'value': 'draft'}, {'text': 'Archived', 'value': 'archived'},
        ]}, 'special': ['status']}, schema={'default_value': 'draft', 'has_auto_increment': False})
    ensure_collection('governance_milestone_translations')
    ensure_field('governance_milestone_translations', 'governance_milestone_id', 'integer',
        meta={'interface': 'select-dropdown-m2o', 'special': ['m2o'], 'required': True}, schema={'is_nullable': False})
    ensure_field('governance_milestone_translations', 'language_code', 'string', meta=dict(LANG_META), schema={'is_nullable': False})
    ensure_field('governance_milestone_translations', 'title', 'text', meta={'interface': 'input', 'required': True}, schema={'is_nullable': False})
    ensure_field('governance_milestone_translations', 'body', 'text', meta={'interface': 'input-multiline', 'required': True}, schema={'is_nullable': False})
    ensure_relation('governance_milestone_translations', 'governance_milestone_id', 'governance_milestones', one_field='translations')
    ensure_alias('governance_milestones', 'translations', None)

    ensure_collection('governance_content_blocks', {'icon': 'article', 'note': 'Short governance text blocks (overview_intro, whitepaper_summary). Editorial only.'})
    ensure_field('governance_content_blocks', 'key', 'string',
        meta={'interface': 'select-dropdown', 'options': {'choices': [
            {'text': 'Governance page introduction', 'value': 'overview_intro'},
            {'text': 'Whitepaper governance summary', 'value': 'whitepaper_summary'},
        ]}, 'required': True, 'unique': True}, schema={'is_unique': True, 'is_nullable': False})
    ensure_field('governance_content_blocks', 'status', 'string',
        meta={'interface': 'select-dropdown', 'options': {'choices': [
            {'text': 'Published', 'value': 'published'}, {'text': 'Draft', 'value': 'draft'}, {'text': 'Archived', 'value': 'archived'},
        ]}, 'special': ['status']}, schema={'default_value': 'draft', 'has_auto_increment': False})
    ensure_collection('governance_content_block_translations')
    ensure_field('governance_content_block_translations', 'governance_content_block_id', 'integer',
        meta={'interface': 'select-dropdown-m2o', 'special': ['m2o'], 'required': True}, schema={'is_nullable': False})
    ensure_field('governance_content_block_translations', 'language_code', 'string', meta=dict(LANG_META), schema={'is_nullable': False})
    ensure_field('governance_content_block_translations', 'body', 'text', meta={'interface': 'input-multiline', 'required': True}, schema={'is_nullable': False})
    ensure_relation('governance_content_block_translations', 'governance_content_block_id', 'governance_content_blocks', one_field='translations')
    ensure_alias('governance_content_blocks', 'translations', None)

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
        ('faq_categories', {'status': {'_eq': 'published'}}),
        ('faq_category_translations', None),
        ('learning_paths', {'status': {'_eq': 'published'}}),
        ('learning_path_translations', None),
        ('lessons', {'status': {'_eq': 'published'}}),
        ('lesson_translations', None),
        ('glossary_terms', {'status': {'_eq': 'published'}}),
        ('glossary_term_translations', None),
        ('tools', {'status': {'_eq': 'published'}}),
        ('tool_translations', None),
        ('referral_content', {'status': {'_eq': 'published'}}),
        ('referral_content_translations', None),
        ('governance_milestones', {'status': {'_eq': 'published'}}),
        ('governance_milestone_translations', None),
        ('governance_content_blocks', {'status': {'_eq': 'published'}}),
        ('governance_content_block_translations', None),
        ('whitepaper_documents', {'status': {'_eq': 'published'}}),
        ('whitepaper_document_translations', None),
        ('whitepaper_chapters', {'status': {'_eq': 'published'}}),
        ('whitepaper_chapter_translations', None),
        ('whitepaper_datasets', {'status': {'_eq': 'published'}}),
        ('whitepaper_dataset_translations', None),
        ('whitepaper_references', {'status': {'_eq': 'published'}}),
        ('whitepaper_reference_translations', None),
    ]
    translation_parents = {
        'ui_message_translations': ('ui_message_id', 'published'),
        'navigation_item_translations': ('navigation_item_id', 'published'),
        'page_translations': ('page_id', 'published'),
        'home_content_translations': ('home_content_id', 'published'),
        'faq_translations': ('faq_id', 'published'),
        'trading_rule_translations': ('trading_rule_id', 'published'),
        'legal_document_translations': ('legal_document_id', 'published'),
        'footer_link_translations': ('footer_link_id', 'published'),
        'faq_category_translations': ('faq_category_id', 'published'),
        'learning_path_translations': ('learning_path_id', 'published'),
        'lesson_translations': ('lesson_id', 'published'),
        'glossary_term_translations': ('glossary_term_id', 'published'),
        'tool_translations': ('tool_id', 'published'),
        'referral_content_translations': ('referral_content_id', 'published'),
        'governance_milestone_translations': ('governance_milestone_id', 'published'),
        'governance_content_block_translations': ('governance_content_block_id', 'published'),
        'whitepaper_document_translations': ('whitepaper_document_id', 'published'),
        'whitepaper_chapter_translations': ('whitepaper_chapter_id', 'published'),
        'whitepaper_dataset_translations': ('whitepaper_dataset_id', 'published'),
        'whitepaper_reference_translations': ('whitepaper_reference_id', 'published'),
    }
    for coll, cond in wanted:
        if coll in translation_parents:
            parent_field, status = translation_parents[coll]
            cond = {parent_field: {'status': {'_eq': status}}}
        if (coll, 'read') in have:
            current = next(x for x in perms if x['collection'] == coll and x['action'] == 'read')
            if coll == 'ui_messages':
                fields = current.get('fields') or []
                if '*' not in fields and 'translations' not in fields:
                    req('PATCH', f"{base}/permissions/{current['id']}", token,
                        {'fields': [*fields, 'translations']})
                    print('public read: ui_messages translations alias added')
            if coll in translation_parents:
                old = current.get('permissions') or {}
                already = old == cond or (isinstance(old.get('_and'), list) and cond in old['_and'])
                if not already:
                    narrowed = cond if not old else {'_and': [old, cond]}
                    req('PATCH', f"{base}/permissions/{current['id']}", token,
                        {'permissions': narrowed})
                    print(f'public read: {coll} restricted to published parent')
            continue
        req('POST', f'{base}/permissions', token, {
            'policy': pubpol['id'], 'collection': coll, 'action': 'read',
            'fields': ['*'], 'permissions': cond or {},
        })
        print(f'public read: {coll}')
    print('schema OK')

if __name__ == '__main__':
    main()
