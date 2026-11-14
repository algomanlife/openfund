<div dir="rtl">

# راهنمای راه‌اندازی دروازه ایران Openfund روی لیارا

این راهنما برای مالک پروژه نوشته شده و همه کارهایی را که به حساب لیارا، Cloudflare، GitHub یا Render نیاز دارند، قدم‌به‌قدم توضیح می‌دهد. مرجع فنی (انگلیسی): [LIARA_IRAN.md](LIARA_IRAN.md) و [ADR 0031](../decisions/0031-iran-edge-on-liara.md).

> **قانون امنیتی:** هیچ کلید، توکن یا رمزی را در Issue، Pull Request، لاگ، کامیت یا چت عمومی قرار ندهید. توکن لیارا فقط در **Environment Secret** گیت‌هاب ذخیره می‌شود. کلید IP فقط در بخش متغیرهای لیارا و Render قرار می‌گیرد.

## ۰. این چیست و چه نیست

- روی لیارا فقط یک **دروازه** (reverse proxy) با nginx اجرا می‌شود. این دروازه درخواست‌های کاربران را به همان سرویس Openfund روی Render می‌فرستد.
- این دروازه **یک استقرار مستقل ایرانی از Openfund نیست**. بک‌اند، پایگاه داده، موتور معاملات، پرداخت‌ها، CMS و داده بازار همگی خارج از ایران هستند.
- اگر ارتباط بین‌المللی لیارا با Render قطع شود، این نشانی هم کار نمی‌کند.
- نسخه برنامه همیشه همان نسخه‌ای است که Render اجرا می‌کند (امروز 0.5.0، کامیت `d0e0909`).
- متن پیام فارسی سایت در همین PR اصلاح شده است. وعده دسترسی هنگام قطعی، منابع قیمت داخلی و توقف فروش حذف شده است. متن جدید تا انتشار بعدی روی سایت دیده نمی‌شود.
- **توجه:** پیام فعلی سایت همین حالا به `iran.openfund.cloud` لینک می‌دهد، اما این دامنه هنوز رکورد DNS ندارد. اگر نمی‌خواهید کاربران به لینک خراب برسند، تا پایان پذیرش مقدار `IRAN_ACCESS_NOTICE_APPROVED` را در `apps/web-react/src/config/iranAccess.ts` به `false` تغییر دهید. این تصمیم با شماست.

## ۱. ساخت دو برنامه در لیارا (آزمایشی و اصلی)

| مورد | آزمایشی (staging) | اصلی (production) |
| :--- | :--- | :--- |
| آدرس | <https://console.liara.ir> | همان |
| مسیر | منوی برنامه‌ها ← «ایجاد برنامه» | همان |
| پلتفرم | **Docker** | **Docker** |
| شناسه (`LIARA_APP_NAME`) | پیشنهاد: `openfund-iran-staging` | پیشنهاد: `openfund-iran` |
| پلن | کوچک‌ترین پلن سخت‌افزاری | کوچک‌ترین پلن سخت‌افزاری، قابل افزایش |
| دیسک، دیتابیس، شبکه خصوصی | لازم نیست | لازم نیست |
| دامنه سفارشی | **ندارد** (فقط `liara.run`) | `iran.openfund.cloud` (مرحله ۸) |
| محرمانه؟ | خیر | خیر |

**بررسی موفقیت:** هر دو برنامه در فهرست دیده می‌شوند و آدرس‌های پیش‌فرض آن‌ها `https://openfund-iran-staging.liara.run` و `https://openfund-iran.liara.run` است.

**در صورت خطا:** اگر شناسه تکراری بود، شناسه دیگری انتخاب کنید و در همه مراحل بعد همان را به کار ببرید.

هر دو برنامه به **همان** سرویس Render وصل می‌شوند، چون فقط یک بک‌اند وجود دارد. برنامه آزمایشی فقط مسیر لیارا را بدون دامنه و بدون کاربر واقعی می‌آزماید.

مستندات: <https://docs.liara.ir/paas/docker/how-tos/create-app/>

## ۲. متغیرهای محیطی هر برنامه لیارا

مسیر: برنامه ← «تنظیمات» ← «متغیرها» ← «ثبت تغییرات».

| نام | مقدار | محرمانه؟ |
| :--- | :--- | :--- |
| `OPENFUND_UPSTREAM_HOST` | میزبان سرویس Render، بدون `https://`. مقدار فعلی: `openfund-our6.onrender.com` (داشبورد Render ← سرویس `openfund`، بالای صفحه) | خیر |
| `EDGE_PORT` | `8080` | خیر |
| `OPENFUND_EDGE_CLIENT_IP_KEY` | **فعلاً خالی بگذارید.** در مرحله ۱۰ پر می‌شود. | **بله** |

**در صورت خطا:** اگر در لاگ پیام `OPENFUND_UPSTREAM_HOST is required`، `must be a bare lowercase host` یا `OPENFUND_EDGE_CLIENT_IP_KEY must be` دیدید، همان مقدار را اصلاح کنید.

مستندات: <https://docs.liara.ir/paas/details/envs/>

## ۳. ساخت توکن API لیارا

| مورد | مقدار |
| :--- | :--- |
| آدرس | <https://console.liara.ir/API> |
| مسیر | منوی «API» ← انتخاب مدت اعتبار ← «ساخت کلید جدید» |
| محرمانه؟ | **بله** |

**بررسی موفقیت:** کلید یک بار نمایش داده می‌شود. آن را مستقیم در مرحله ۴ وارد کنید.

**در صورت افشا:** کلید را حذف و کلید تازه بسازید، سپس Secret را در GitHub به‌روز کنید.

مستندات: <https://docs.liara.ir/references/api/about/>

## ۴. تنظیم GitHub

مسیر: <https://github.com/algomanlife/openfund/settings/environments> ← «New environment». دو Environment بسازید:

| مورد | `liara-iran-staging` | `liara-iran` | محرمانه؟ |
| :--- | :--- | :--- | :--- |
| Required reviewers | حساب خودتان | حساب خودتان | — |
| Deployment branches | فقط `main` | فقط `main` | — |
| Secret `LIARA_API_TOKEN` | توکن مرحله ۳ | توکن مرحله ۳ | **بله** |
| Variable `LIARA_APP_NAME` | `openfund-iran-staging` | `openfund-iran` | خیر |
| Variable `LIARA_PUBLIC_URL` | `https://openfund-iran-staging.liara.run` | فعلاً `https://openfund-iran.liara.run`، بعد از SSL: `https://iran.openfund.cloud` | خیر |

سپس در <https://github.com/algomanlife/openfund/settings/variables/actions> متغیر مخزن `OPENFUND_UPSTREAM_HOST` را برابر `openfund-our6.onrender.com` اضافه کنید (محرمانه نیست).

**در صورت خطا:** پیام `environment is missing` نام دقیق موارد جاافتاده را نشان می‌دهد.

## ۵. استقرار آزمایشی (staging)

1. پس از بازبینی و تأیید صریح شما، PR شماره ۱۱۴ ادغام می‌شود. ادغام چیزی را مستقر نمی‌کند.
2. شناسه کامل ۴۰ کاراکتری کامیت روی `main` را کپی کنید.
3. <https://github.com/algomanlife/openfund/actions/workflows/deploy-liara-iran.yml> ← «Run workflow» ← شاخه `main`:
   - `target`: `staging`
   - `edge_commit`: شناسه کامل
   - `staging_run_id`: خالی
   - `confirm`: `DEPLOY-IRAN-EDGE`
4. پس از سبز شدن `validate` و `edge-auth`، درخواست تأیید Environment `liara-iran-staging` را بپذیرید.

**بررسی موفقیت:**

- مرحله `Verify the deployed edge` نتیجه `VERIFIED` می‌دهد.
- در Summary، شناسه این اجرا (run id) برای مرحله ۹ نوشته شده است.

**در صورت خطا:**

| علامت | اقدام |
| :--- | :--- |
| `Commit is not on main` | شناسه کامیت ادغام‌شده را وارد کنید |
| خطا در `liara deploy` | توکن و نام برنامه را بررسی کنید. لیارا نسخه قبلی را فعال نگه می‌دارد. |
| `origin readiness` با کد 502 یا 504 | لیارا به Render دسترسی ندارد. لاگ‌ها (مرحله ۶) را ببینید و ادامه ندهید. این مهم‌ترین آزمون است. |

## ۶. لاگ‌ها

- پنل: برنامه ← «تاریخچه» (لاگ استقرار)، و «رویدادها» و «گزارشات» (لاگ اجرا).
- خط فرمان روی رایانه خودتان:

  ```bash
  liara logs --app openfund-iran-staging --since "1 hour ago"
  ```

- خط `openfund-edge: proxying to https://...` یعنی شروع درست. لاگ دسترسی شامل IP، کوکی و پارامتر آدرس نیست.

مستندات: <https://docs.liara.ir/references/cli/see-app-logs/>

## ۷. پذیرش نسخه آزمایشی (با اینترنت ایرانی)

روی `https://openfund-iran-staging.liara.run` بررسی کنید. هر مورد را فقط پس از اجرای واقعی علامت بزنید:

- [ ] `/__edge/live` و `/__edge/ready` پاسخ `ok: true` می‌دهند
- [ ] `/version` همان کامیت `https://openfund.cloud/version` را نشان می‌دهد
- [ ] **مهم:** `/__edge/whoami` همان IP عمومی اینترنت شما را نشان می‌دهد (مقایسه با یک سرویس نمایش IP). اگر متفاوت بود، مرحله ۱۰ را انجام ندهید و گزارش دهید.
- [ ] صفحه اصلی، چالش‌ها، داشبورد و ترمینال؛ فارسی و انگلیسی؛ موبایل و دسکتاپ
- [ ] ترمینال حداقل ۱۰ دقیقه باز بماند و قیمت‌ها قطع نشوند (آزمون جریان SSE پشت پراکسی لیارا)
- [ ] محتوای CMS و قیمت‌های Gains بارگذاری شوند. این‌ها مستقیم از خارج می‌آیند، نه از لیارا.
- [ ] زمان بارگذاری با `openfund.cloud` مقایسه شود
- [ ] ورود با کیف پول روی این نشانی فعلاً خطای `invalid_domain` می‌دهد، مگر اینکه نشانی آزمایشی را موقتاً به `ALLOWED_DOMAINS` اضافه کرده باشید (مرحله ۱۰)

**هیچ پرداخت واقعی بدون تصمیم صریح شما انجام نشود.**

## ۸. اتصال `iran.openfund.cloud` به برنامه اصلی و تنظیم DNS

**الف) لیارا:** برنامه `openfund-iran` ← «دامنه‌ها» ← «افزودن دامنه» ← `iran.openfund.cloud` ← «ایجاد دامنه». لیارا سه رکورد نشان می‌دهد. **مقادیر را دقیقاً از همان صفحه کپی کنید.**

**ب) Cloudflare:** <https://dash.cloudflare.com> ← `openfund.cloud` ← «DNS» ← «Records» ← «Add record»:

| Type | Name | مقدار | Proxy status |
| :--- | :--- | :--- | :--- |
| CNAME | `iran` | مقصد CNAME از صفحه لیارا | **DNS only** |
| TXT | نامی که لیارا نشان می‌دهد | مقدار TXT از صفحه لیارا | — |
| CNAME | `_acme-challenge.iran` (یا نامی که لیارا نشان می‌دهد) | مقصد از صفحه لیارا | **DNS only** |

هیچ‌کدام از این مقادیر محرمانه نیست.

**هشدارها:**

- رکوردهای `openfund.cloud` و `www` را تغییر ندهید.
- **Universal SSL** را خاموش نکنید.

**بررسی موفقیت:** در لیارا «بررسی وضعیت رکوردها» علامت سبز نشان دهد.

**در صورت خطا:** نام‌ها و مقادیر را با صفحه لیارا تطبیق دهید (در Cloudflare نوشتن `iran` کافی است). اگر پس از ۲۴ ساعت سبز نشد، به پشتیبانی لیارا تیکت بزنید.

مستندات: <https://docs.liara.ir/paas/domains/add-subdomains/>

**SSL:** «دامنه‌ها» ← `iran.openfund.cloud` ← «تهیه گواهی SSL». تمدید خودکار است.

- **بررسی موفقیت:** `https://iran.openfund.cloud/__edge/live` بدون هشدار مرورگر باز شود.
- پس از فعال شدن، `LIARA_PUBLIC_URL` در Environment `liara-iran` را به `https://iran.openfund.cloud` تغییر دهید.

مستندات: <https://docs.liara.ir/paas/domains/enable-ssl/>

## ۹. استقرار اصلی (production)

همان Workflow را با این مقادیر اجرا کنید:

- `target`: `production`
- `edge_commit`: **همان** شناسه مرحله ۵
- `staging_run_id`: شناسه اجرای موفق مرحله ۵
- `confirm`: `DEPLOY-IRAN-EDGE`

Workflow فقط وقتی مستقر می‌کند که اجرای آزمایشی همان کامیت موفق و `verified` بوده باشد. سپس درخواست تأیید Environment `liara-iran` را بپذیرید.

**بررسی موفقیت:** `VERIFIED` و سپس چک‌لیست مرحله ۷ روی `https://iran.openfund.cloud`.

## ۱۰. تغییرات تولیدی در Render (هر کدام با PR جداگانه و تأیید صریح شما)

**الف) ورود با کیف پول:** `ALLOWED_DOMAINS` در `render.yaml` باید `iran.openfund.cloud` را داشته باشد. برای آزمایش ورود روی نسخه آزمایشی، می‌توانید `openfund-iran-staging.liara.run` را موقتاً اضافه و بعد حذف کنید. تغییر فقط در داشبورد با همگام‌سازی بعدی Blueprint پاک می‌شود.

```yaml
      - key: ALLOWED_DOMAINS
        value: "openfund-our6.onrender.com,openfi.cloud,openfund.cloud,iran.openfund.cloud"
```

**ب) IP واقعی کاربران:** بدون این کلید، بک‌اند همه کاربران دروازه را یک IP می‌بیند. در نتیجه محدودیت‌های نرخ (مثلاً ۶۰ ورود در دقیقه یا ۵ پیام پشتیبانی در ۱۰ دقیقه) میان همه کاربران ایران مشترک می‌شود و لاگ‌ها IP واقعی ندارند.

1. فقط پس از تأیید `/__edge/whoami` در مرحله ۷ ادامه دهید.
2. پس از انتشار نسخه‌ای از Openfund که این PR را دارد، یک کلید تصادفی بسازید:

   ```bash
   openssl rand -hex 32
   ```

3. همان مقدار را در دو جا وارد کنید (**محرمانه**):
   - Render: سرویس `openfund` ← «Environment» ← `EDGE_CLIENT_IP_KEY`
   - لیارا: هر دو برنامه ← «متغیرها» ← `OPENFUND_EDGE_CLIENT_IP_KEY`

**بررسی موفقیت:**

- لاگ لیارا پیام `trusted client-IP key configured` را نشان دهد.
- سرویس Render بدون خطا بالا بیاید. کلید نامعتبر باعث توقف سرویس می‌شود؛ در آن صورت کلید را حذف یا اصلاح کنید.

## ۱۱. مسیریابی کشوری (فقط پس از پذیرش و تأیید صریح شما)

این روش بازدیدکننده ایرانی‌ای را که `openfund.cloud` را باز می‌کند، با 302 به `iran.openfund.cloud` می‌فرستد. فقط برای کاربرانی کار می‌کند که به Cloudflare دسترسی دارند.

- مسیر: Cloudflare ← `openfund.cloud` ← «Rules» ← «Redirect Rules» ← «Create rule»
- نام قانون: `Iran visitors to Liara edge`
- عبارت:

```text
(ip.src.country eq "IR"
 and http.host in {"openfund.cloud" "www.openfund.cloud"}
 and http.request.method eq "GET"
 and any(http.request.headers["sec-fetch-mode"][*] eq "navigate")
 and not cf.client.bot
 and not http.request.uri.query contains "region=global")
```

- Then: «Dynamic»، `concat("https://iran.openfund.cloud", http.request.uri.path)`، کد **302**، «Preserve query string» روشن
- قانون را ابتدا **غیرفعال** ذخیره کنید.

**بررسی موفقیت:** از اینترنت ایرانی، `openfund.cloud` به `iran.openfund.cloud` برود. از خارج تغییری نباشد. با `?region=global` نسخه اصلی باز شود.

**در صورت خطا:** اگر عبارت پذیرفته نشد، بخش `cf.client.bot` را حذف کنید. بخش `sec-fetch-mode` را هرگز حذف نکنید. اگر باز هم پذیرفته نشد، مسیریابی را فعال نکنید.

## ۱۲. غیرفعال‌سازی فوری مسیریابی

Cloudflare ← «Rules» ← «Redirect Rules» ← کلید قانون `Iran visitors to Liara edge` را خاموش کنید. اثر آن در چند ثانیه اعمال می‌شود.

## ۱۳. بازگشت (Rollback)

| موقعیت | اقدام |
| :--- | :--- |
| استقرار جدید خراب است | Workflow را با `edge_commit` سالم قبلی اجرا کنید (ابتدا آزمایشی). «تاریخچه» لیارا همه استقرارها را نشان می‌دهد. |
| متغیر اشتباه | مرحله ۲ را اصلاح و برنامه را ری‌استارت کنید |
| کلید IP مشکل ایجاد کرده | کلید را از Render و لیارا حذف کنید. رفتار به حالت قبل برمی‌گردد. |
| SSL یا DNS خراب | مسیریابی را خاموش کنید و رکوردها را با صفحه لیارا تطبیق دهید |
| لیارا به Render وصل نمی‌شود یا تأخیر زیاد است | مسیریابی را خاموش کنید. کاربران از `openfund.cloud` استفاده کنند. |
| `invalid_domain` هنگام ورود | مرحله ۱۰-الف انجام نشده یا Blueprint همگام نشده است |
| مشکل خود برنامه | بازگشت روی Render طبق [ROLLBACK.md](ROLLBACK.md). دروازه خودکار همان نسخه را نشان می‌دهد. |
| توقف کامل | برنامه لیارا را خاموش کنید. هیچ داده‌ای از بین نمی‌رود. |

## ۱۴. وضعیت

| مرحله | وضعیت |
| :--- | :--- |
| کد دروازه، Docker، Workflow آزمایشی و اصلی، آزمون‌ها | COMPLETE (روی شاخه، ادغام نشده) |
| آزمون ورود، کوکی، CSRF و IP با بک‌اند واقعی (محلی و CI) | COMPLETE |
| اصلاح متن پیام ایران | COMPLETE در کد. پس از انتشار بعدی دیده می‌شود. |
| مراحل ۱ تا ۴ (لیارا، توکن، GitHub) | NEEDS OWNER ACTION |
| مراحل ۵ تا ۷ (استقرار و پذیرش آزمایشی) | NOT VERIFIED |
| مراحل ۸ و ۹ (دامنه، SSL، استقرار اصلی) | NEEDS OWNER ACTION |
| مرحله ۱۰ (`ALLOWED_DOMAINS` و کلید IP) | BLOCKED (نیازمند PR جداگانه، انتشار و تأیید شما) |
| مسیریابی کشوری | غیرفعال |

</div>
