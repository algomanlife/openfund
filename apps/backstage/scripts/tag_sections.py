#!/usr/bin/env python3
"""
Openfund backstage — content UX tagging (idempotent).

Tags ui_messages with `section` (page area) and `label` (friendly editor
name) so the Data Studio reads like a content manager instead of a raw
string table. Re-running only fills missing values — never overwrites.

Usage: python3 tag_sections.py
"""
import json
import os
import urllib.request

HERE = os.path.dirname(os.path.abspath(__file__))
REPO = os.path.abspath(os.path.join(HERE, '..', '..', '..'))
BASE = os.environ.get('DIRECTUS_URL', 'http://localhost:8055')

def req(method, path, token=None, body=None):
    data = json.dumps(body).encode() if body is not None else None
    r = urllib.request.Request(BASE + path, data=data, method=method)
    r.add_header('Content-Type', 'application/json')
    if token:
        r.add_header('Authorization', f'Bearer {token}')
    with urllib.request.urlopen(r, timeout=30) as resp:
        return json.loads(resp.read() or b'{}')

# ---- landing: key strings (exact fa source = the collection key) -----------
LANDING = [
    ('navigation', 'لینک منو — حساب‌های پراپ', 'حساب‌های پراپ'),
    ('navigation', 'لینک منو — بازارها', 'بازارها'),
    ('navigation', 'لینک منو — چطور کار می‌کند؟', 'چطور کار می‌کند؟'),
    ('navigation', 'لینک منو — تیم ما', 'تیم ما'),
    ('navigation', 'دکمه هدر — ورود به ترمینال', 'ورود به ترمینال'),
    ('hero', 'متن بالای تیتر', 'برای معامله‌گرانی که آمادهٔ قدم بعدی‌اند'),
    ('hero', 'تیتر اصلی (خط اول)', 'مهارت تو،'),
    ('hero', 'تیتر اصلی (خط دوم)', 'شایستهٔ فرصت بزرگ‌تری‌ست.'),
    ('hero', 'متن معرفی هیرو ۱', 'سرمایه نباید مرز توانایی تو باشد.'),
    ('hero', 'متن معرفی هیرو ۲', 'در اوپن‌فاند، عملکردت را در یک ارزیابی روشن نشان بده'),
    ('hero', 'متن معرفی هیرو ۳', 'و مسیر دسترسی به حساب تأمین سرمایه‌شده را آغاز کن.'),
    ('hero', 'دکمه اصلی هیرو', 'حساب مناسبم را پیدا کنم'),
    ('hero', 'لینک ثانویه هیرو', 'با مسیر آشنا شو'),
    ('intro', 'تیتر بخش معرفی', 'بازار، فرصت را یکسان تقسیم نمی‌کند.'),
    ('intro', 'تیتر ۲ بخش معرفی', 'پول تو، قواعد تو.'),
    ('markets', 'تیتر بخش بازارها', 'از رمزارز تا بازارهای جهانی؛'),
    ('markets', 'زیرتیتر بخش بازارها', 'نمایشی روشن از بازارها، با دادهٔ زنده'),
    ('markets', 'وضعیت دادهٔ جدول بازار', 'در حال دریافت بازارها'),
    ('accounts', 'تیتر بخش حساب‌ها', 'مسیر خودت را انتخاب کن'),
    ('accounts', 'برچسب پلن — استاندارد', 'استاندارد'),
    ('accounts', 'برچسب پلن — شروع', 'شروع'),
    ('accounts', 'برچسب پلن — تک‌مرحله‌ای', 'تک‌مرحله‌ای'),
    ('how', 'تیتر بخش چطور کار می‌کند', 'سه قدم تا حساب تأمین‌شده'),
    ('how', 'قدم ۱', 'ارزیابی را انتخاب کن'),
    ('how', 'قدم ۲', 'قواعد را رعایت کن'),
    ('how', 'قدم ۳', 'حساب واقعی را مدیریت کن'),
    ('team', 'تیتر بخش تیم', 'تیمی که پشت میز می‌نشیند، معامله نمی‌کند.'),
    ('rules', 'تیتر بخش قوانین', 'قوانین روشن، بدون سورپرایز'),
    ('footer', 'تیتر فوتر', 'اوپن‌فاند'),
    ('footer', 'توضیح فوتر ۱', 'سرمایه، در امتداد مهارت تو.'),
    ('footer', 'ردیف گیت‌هاب — تیتر', 'همیشه شفاف و منبع‌باز'),
    ('footer', 'ردیف گیت‌هاب — زیرمتن', 'برای توسعهٔ دست‌جمعی و نظارت مداوم کاربران'),
    ('footer', 'ردیف گیت‌هاب — فقط فارسی', 'اولین کسب‌وکار منبع‌باز ایرانی'),
    ('footer', 'آدرس ایران', 'ایران — فارس — شیراز، بلوار ارم، خیابان نارون، بین نارون و خاکشانسی'),
    ('footer', 'آدرس خارج', 'ایالات متحده — سان‌فرانسیسکو، خیابان برنان ۵۲۵، سوئیت ۳۰۰، کد پستی ۹۴۱۰۷'),
    ('footer', 'طراحی‌شده با عشق در…', 'طراحی‌شده با عشق'),
    ('footer', 'توسعه‌داده‌شده در…', 'توسعه‌داده‌شده در سان‌فرانسیسکو'),
    ('legal', 'تیتر بخش حقوقی', 'اطلاعات مهم و سلب مسئولیت'),
]

# ---- terminal: tag by key prefix ------------------------------------------
TERM_SECTIONS = [
    ('term_header', ('nav.',), 'منوی ترمینال'),
    ('term_trade', ('side.', 'tr.', 'ot.', 'lev.', 'col.', 'ord.', 'asm.', 'dlg.', 'confirm.', 'toast.', 'pos.', 'acct.', 'demo'), 'پنل معامله'),
    ('term_markets', ('dd.', 'cat.', 'st.', 'boot.', 'ms.'), 'مارکت سلکتور'),
    ('term_book', ('book.', 'trades.'), 'اوردربوک/تریدها'),
    ('term_status', ('sb.',), 'نوار وضعیت'),
]

def main():
    token = req('POST', '/auth/login', body={'email': 'admin@openfund.dev', 'password': 'openfund-admin-2026'})['data']['access_token']
    items = req('GET', '/items/ui_messages?fields=id,key,namespace,section,label&limit=-1', token)['data']
    by_key = {m['key']: m for m in items}
    patched = 0

    # landing
    for section, label, key in LANDING:
        m = by_key.get(key)
        if not m or m['namespace'] != 'landing':
            continue
        if not m.get('section') or not m.get('label'):
            req('PATCH', f'/items/ui_messages/{m["id"]}', token, {'section': section, 'label': label})
            patched += 1

    # terminal (by prefix)
    for m in items:
        if m['namespace'] != 'terminal' or m.get('section'):
            continue
        for section, prefixes, _ in TERM_SECTIONS:
            if any(m['key'].startswith(p) for p in prefixes):
                req('PATCH', f'/items/ui_messages/{m["id"]}', token, {'section': section})
                patched += 1
                break

    print(f'tagged {patched} ui_messages (sections/labels)')
    total = req('GET', '/items/ui_messages?fields=section&limit=-1&meta=filter_count', token)
    print('total messages:', total['meta']['filter_count'])

if __name__ == '__main__':
    main()
