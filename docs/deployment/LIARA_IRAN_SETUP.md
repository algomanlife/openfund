<div dir="rtl">

# راهنمای راه‌اندازی نسخه ایران Openfund روی لیارا

این راهنما برای مالک پروژه نوشته شده و همه کارهایی را که به حساب لیارا، Cloudflare، GitHub یا Render نیاز دارند، قدم‌به‌قدم توضیح می‌دهد. مرجع فنی (انگلیسی): [LIARA_IRAN.md](LIARA_IRAN.md) و [ADR 0031](../decisions/0031-iran-edge-on-liara.md).

> **قانون امنیتی:** هیچ کلید، توکن یا رمزی را در Issue، Pull Request، لاگ، کامیت یا چت عمومی قرار ندهید. تنها جای مجاز برای توکن لیارا، **Environment Secret** در GitHub است.

## ۰. معماری فاز اول، به زبان ساده

- روی لیارا فقط یک برنامه کوچک nginx اجرا می‌شود (پوشه `infra/liara-iran`). این برنامه درخواست‌های `iran.openfund.cloud` را به همان سرویس Openfund روی Render می‌فرستد.
- پایگاه داده، موتور معاملات، پرداخت‌ها و همه کلیدهای محرمانه فقط روی Render می‌مانند. روی لیارا **هیچ** داده یا کلید محرمانه‌ای نیست.
- نسخه برنامه همیشه همان نسخه‌ای است که Render اجرا می‌کند (امروز 0.5.0، کامیت `d0e0909`).
- فقط فایل‌های ثابت (JS/CSS هش‌دار) در لیارا کش می‌شوند.

**محدودیت مهم:** اگر ارتباط لیارا با Render (اینترنت بین‌الملل) قطع شود، این نسخه هم کار نمی‌کند. پیام فارسی فعلی سایت («دسترسی پایدار به Openfund در ایران») وعده‌ای بیش از این فاز می‌دهد: دسترسی هنگام اختلال اینترنت بین‌الملل و منابع قیمت داخلی. پیش از فعال‌کردن مسیریابی کشوری، متن آن را اصلاح یا موقتاً پنهان کنید (`apps/web-react/src/config/iranAccess.ts`).

## ۱. ساخت برنامه در لیارا

| مورد | مقدار |
| :--- | :--- |
| آدرس | <https://console.liara.ir> |
| مسیر | منوی برنامه‌ها ← «ایجاد برنامه» |
| پلتفرم | **Docker** |
| شناسه برنامه (نام) | پیشنهاد: `openfund-iran` (این همان `LIARA_APP_NAME` است) |
| پلن | کوچک‌ترین پلن سخت‌افزاری کافی است (nginx منابع کمی می‌خواهد). بعداً از «تغییر پلن» قابل افزایش است. |
| شبکه خصوصی / دیسک / دیتابیس | **لازم نیست.** هیچ دیسک یا دیتابیسی نسازید. |
| محرمانه؟ | خیر |

**بررسی موفقیت:** برنامه در فهرست برنامه‌ها دیده می‌شود و آدرس پیش‌فرض آن `https://openfund-iran.liara.run` است (اگر شناسه دیگری انتخاب کرده‌اید، همان شناسه).

**در صورت خطا:** اگر شناسه تکراری بود، شناسه دیگری انتخاب کنید و همان را در همه مراحل بعد به کار ببرید.

مستندات: <https://docs.liara.ir/paas/docker/how-tos/create-app/>

## ۲. پورت و متغیرهای محیطی برنامه

| مورد | مقدار |
| :--- | :--- |
| مسیر | برنامه `openfund-iran` ← «تنظیمات» ← بخش «متغیرها» |
| `OPENFUND_UPSTREAM_HOST` | میزبان سرویس Render، بدون `https://` و بدون مسیر. مقدار فعلی: `openfund-our6.onrender.com`. آن را در داشبورد Render، صفحه سرویس `openfund`، بالای صفحه ببینید. |
| `EDGE_PORT` | `8080` |
| محرمانه؟ | **خیر.** هیچ‌کدام محرمانه نیستند و هیچ متغیر محرمانه‌ای اینجا لازم نیست. |
| دکمه | «ثبت تغییرات» |

پورت برنامه در فایل `infra/liara-iran/liara.json` روی `8080` تنظیم شده و هنگام استقرار هم با `--port 8080` ارسال می‌شود.

**بررسی موفقیت:** هر دو متغیر در فهرست متغیرها دیده می‌شوند.

**در صورت خطا:** اگر بعد از استقرار در لاگ پیام `OPENFUND_UPSTREAM_HOST is required` یا `must be a bare lowercase host` دیدید، مقدار را بدون `https://` و با حروف کوچک وارد کنید.

مستندات: <https://docs.liara.ir/paas/details/envs/>

## ۳. ساخت توکن API لیارا

| مورد | مقدار |
| :--- | :--- |
| آدرس | <https://console.liara.ir/API> |
| مسیر | منوی «API» ← انتخاب مدت اعتبار ← «ساخت کلید جدید» |
| محرمانه؟ | **بله.** فقط در GitHub Secret (مرحله ۴) قرار بگیرد. |

**بررسی موفقیت:** کلید یک بار نمایش داده می‌شود. آن را مستقیم در مرحله ۴ وارد کنید و جای دیگری ذخیره نکنید.

**در صورت خطا یا افشا:** کلید را از همان صفحه حذف و کلید تازه بسازید، سپس Secret را در GitHub به‌روز کنید.

مستندات: <https://docs.liara.ir/references/api/about/>

## ۴. تنظیم GitHub (Environment، Secret، Variable)

مسیر: <https://github.com/algomanlife/openfund/settings/environments> ← «New environment»

| مورد | مقدار | محرمانه؟ |
| :--- | :--- | :--- |
| نام Environment | `liara-iran` | — |
| Required reviewers | حساب خودتان (مالک) | — |
| Deployment branches and tags | «Selected branches» ← فقط `main` | — |
| Environment secret `LIARA_API_TOKEN` | توکن مرحله ۳ | **بله** |
| Environment variable `LIARA_APP_NAME` | `openfund-iran` | خیر |
| Environment variable `LIARA_PUBLIC_URL` | فعلاً `https://openfund-iran.liara.run`. پس از اتصال دامنه: `https://iran.openfund.cloud` | خیر |

سپس در <https://github.com/algomanlife/openfund/settings/variables/actions> ← «New repository variable»:

| نام | مقدار | محرمانه؟ |
| :--- | :--- | :--- |
| `OPENFUND_UPSTREAM_HOST` | همان مقدار مرحله ۲ (`openfund-our6.onrender.com`) | خیر |

**بررسی موفقیت:** صفحه Environment، یک Secret و دو Variable را نشان می‌دهد.

**در صورت خطا:** اگر اجرای Workflow با پیام `liara-iran environment is missing` متوقف شد، نام‌های ذکرشده در پیام را دقیقاً با همین املا اضافه کنید.

## ۵. اولین استقرار

1. Pull Request شاخه `infra/liara-iran-mirror` را بازبینی و ادغام کنید. Workflow مربوط به PR فقط می‌سازد و تست می‌کند، چیزی مستقر نمی‌کند.
2. شناسه کامل (۴۰ کاراکتری) کامیت ادغام‌شده روی `main` را از صفحه کامیت‌ها کپی کنید.
3. <https://github.com/algomanlife/openfund/actions/workflows/deploy-liara-iran.yml> ← «Run workflow» ← شاخه `main`:
   - `edge_commit`: شناسه کامل کامیت
   - `expect_app_commit`: خالی بگذارید، یا شناسه‌ای که `https://openfund.cloud/version` نشان می‌دهد
   - `confirm`: `DEPLOY-IRAN-EDGE`
4. پس از پایان مرحله `validate`، GitHub تأیید شما را برای Environment `liara-iran` می‌خواهد. «Review deployments» ← «Approve».

**بررسی موفقیت:**

- مرحله `Verify the deployed edge` باید `VERIFIED: 12/12` نشان دهد.
- در Summary اجرای Workflow، نتیجه `verified` و نسخه و کامیت برنامه دیده می‌شود.
- فایل وضعیت با نام `liara-edge-status-<run>` ضمیمه شده است.

**در صورت خطا:**

| علامت | علت محتمل | اقدام |
| :--- | :--- | :--- |
| `Commit is not on main` | شناسه اشتباه است | شناسه کامیت ادغام‌شده روی `main` را وارد کنید |
| خطا در `liara deploy` | توکن یا نام برنامه نادرست است | مراحل ۳ و ۴ را بررسی کنید. لیارا نسخه قبلی را فعال نگه می‌دارد. |
| `origin readiness` با کد 502 یا 504 | لیارا به Render دسترسی ندارد | مرحله ۶ (لاگ‌ها) را ببینید. این مهم‌ترین آزمون فاز اول است. نتیجه را گزارش کنید و ادامه ندهید. |
| فقط آزمون `edge release identity` شکست خورد | استقرار هنوز کامل نشده | چند دقیقه بعد Workflow را دوباره اجرا کنید |

## ۶. مشاهده لاگ‌ها

- پنل: برنامه `openfund-iran` ← «تاریخچه» (لاگ هر استقرار)، و «رویدادها» و «گزارشات» (لاگ اجرا).
- خط فرمان (روی رایانه خودتان): نصب با `npm install -g @liara/cli`، سپس `liara login` و بعد `liara logs --app openfund-iran --since "1 hour ago"`.
- خط `openfund-edge: proxying to https://... on :8080` یعنی شروع درست. لاگ‌های دسترسی شامل IP، کوکی و پارامترهای آدرس نیستند.

مستندات: <https://docs.liara.ir/references/cli/see-app-logs/>

## ۷. آزمون با آدرس پیش‌فرض لیارا

1. `https://openfund-iran.liara.run/__edge/live` باید `{"ok":true,"edge":"liara-iran"}` برگرداند.
2. `https://openfund-iran.liara.run/__edge/ready` باید `{"ok":true,...}` برگرداند. این یعنی Render از داخل لیارا در دسترس است.
3. `https://openfund-iran.liara.run/version` باید همان کامیت `https://openfund.cloud/version` را نشان دهد.
4. صفحه اصلی، صفحه چالش‌ها، داشبورد و ترمینال را با یک اینترنت ایرانی (موبایل و دسکتاپ، فارسی و انگلیسی) باز کنید.
5. ورود با کیف پول **فعلاً خطای `invalid_domain` می‌دهد**. این رفتار مورد انتظار است تا مرحله ۱۰ انجام شود.

## ۸. اتصال `iran.openfund.cloud` و تنظیم DNS در Cloudflare

**الف) در لیارا:** برنامه `openfund-iran` ← «دامنه‌ها» ← «افزودن دامنه» ← `iran.openfund.cloud` ← «ایجاد دامنه».

لیارا سه رکورد نشان می‌دهد. **مقادیر را دقیقاً از همان صفحه کپی کنید**، چون در مستندات منتشر نشده‌اند:

1. رکورد CNAME برای `iran` (مقصدی که لیارا نشان می‌دهد)
2. رکورد TXT برای تأیید مالکیت
3. رکورد CNAME مربوط به `_acme-challenge` برای صدور و تمدید SSL

**ب) در Cloudflare:** <https://dash.cloudflare.com> ← دامنه `openfund.cloud` ← «DNS» ← «Records» ← «Add record»:

| Type | Name | Target / Content | Proxy status | محرمانه؟ |
| :--- | :--- | :--- | :--- | :--- |
| CNAME | `iran` | مقصد CNAME از صفحه لیارا | **DNS only (ابر خاکستری)** | خیر |
| TXT | نامی که لیارا نشان می‌دهد | مقدار TXT از صفحه لیارا | — | خیر |
| CNAME | `_acme-challenge.iran` (یا نامی که لیارا نشان می‌دهد) | مقصد از صفحه لیارا | **DNS only** | خیر |

**هشدارها:**

- رکوردهای `openfund.cloud` و `www` را **تغییر ندهید**.
- **Universal SSL** را در Cloudflare **غیرفعال نکنید**. سایت اصلی به آن وابسته است.
- رکوردهای `iran` باید DNS only باشند تا کاربران ایرانی مستقیم به لیارا وصل شوند.

**بررسی موفقیت:** در لیارا دکمه «بررسی وضعیت رکوردها» را بزنید. علامت‌ها باید سبز شوند. انتشار DNS ممکن است تا چند ساعت طول بکشد.

**در صورت خطا:** نام و مقدار را دوباره با صفحه لیارا مقایسه کنید (Cloudflare نام دامنه را خودش اضافه می‌کند، پس `iran` کافی است). اگر پس از ۲۴ ساعت سبز نشد، به پشتیبانی لیارا تیکت بزنید.

مستندات: <https://docs.liara.ir/paas/domains/add-subdomains/> و <https://docs.liara.ir/paas/domains/add-domain/>

## ۹. فعال‌سازی SSL

- مسیر: برنامه ← «دامنه‌ها» ← `iran.openfund.cloud` ← «تهیه گواهی SSL».
- گواهی رایگان است و لیارا آن را خودکار تمدید می‌کند (از طریق رکورد `_acme-challenge`).
- **بررسی موفقیت:** `https://iran.openfund.cloud/__edge/live` بدون هشدار مرورگر باز شود.
- **در صورت خطا:** مطمئن شوید رکورد `_acme-challenge` وجود دارد و DNS only است. Universal SSL را خاموش نکنید و در صورت ادامه مشکل با پشتیبانی لیارا تماس بگیرید.
- پس از فعال شدن، `LIARA_PUBLIC_URL` را در Environment گیت‌هاب به `https://iran.openfund.cloud` تغییر دهید.
- در صورت تمایل، از «تنظیمات» ← «زیردامنه پیش‌فرض» آدرس `liara.run` را غیرفعال کنید.

مستندات: <https://docs.liara.ir/paas/domains/enable-ssl/> و <https://docs.liara.ir/paas/domains/acme-challenge-record/>

## ۱۰. فعال کردن ورود با کیف پول روی دامنه ایران (تغییر تولید، نیازمند تأیید شما)

بک‌اند فقط پیام SIWE دامنه‌های فهرست `ALLOWED_DOMAINS` را می‌پذیرد. این مقدار در `render.yaml` تعریف شده و باید **در یک PR جداگانه** تغییر کند. تغییر فقط در داشبورد Render با همگام‌سازی بعدی Blueprint پاک می‌شود.

```yaml
      - key: ALLOWED_DOMAINS
        value: "openfund-our6.onrender.com,openfi.cloud,openfund.cloud,iran.openfund.cloud"
```

- برای دوره آزمایش می‌توانید `openfund-iran.liara.run` را هم موقتاً اضافه کنید و بعد حذف کنید.
- پس از ادغام، همگام‌سازی Blueprint را طبق [RENDER.md](RENDER.md) انجام دهید.
- `npm run validate:blueprint` باید سبز بماند.
- **بررسی موفقیت:** روی `https://iran.openfund.cloud` اتصال کیف پول و امضا (شبکه Arbitrum One) کار کند.
- **توجه:** نشست‌ها برای هر دامنه جدا هستند. کاربر روی دامنه ایران دوباره وارد می‌شود.

## ۱۱. چک‌لیست پذیرش (پیش از هر مسیریابی)

با اینترنت ایرانی روی `https://iran.openfund.cloud` همه موارد زیر را بررسی کنید. هر مورد را فقط پس از اجرای واقعی «انجام شد» علامت بزنید:

- [ ] صفحه اصلی، چالش‌ها، پرداخت (Checkout، بدون پرداخت واقعی)، داشبورد، ترمینال
- [ ] فارسی RTL و انگلیسی LTR، موبایل و دسکتاپ
- [ ] اتصال کیف پول و ورود، خروج، و ماندن نشست پس از رفرش
- [ ] جریان زنده ترمینال (قیمت، کندل‌ها، فوت‌پرینت Hyperliquid)
- [ ] محتوای CMS (این محتوا مستقیم از `openfund-cms.onrender.com` بارگذاری می‌شود)
- [ ] `node scripts/liara/verify-edge.mjs --edge https://iran.openfund.cloud --upstream https://openfund-our6.onrender.com` نتیجه `VERIFIED` بدهد
- [ ] تأخیر قابل‌قبول باشد (زمان بارگذاری صفحه را با `openfund.cloud` مقایسه کنید)
- [ ] یک بار بازگشت (مرحله ۱۴) آزمایش شده باشد

**هر پرداخت واقعی فقط با تصمیم صریح شما انجام شود.**

## ۱۲. فعال‌سازی مسیریابی کشوری (فقط پس از پذیرش و تأیید صریح شما)

این روش بازدیدکننده ایرانی‌ای را که `openfund.cloud` را باز می‌کند، با تغییر مسیر 302 به `iran.openfund.cloud` می‌فرستد. فقط برای کاربرانی کار می‌کند که به Cloudflare دسترسی دارند.

- مسیر: <https://dash.cloudflare.com> ← `openfund.cloud` ← «Rules» ← «Redirect Rules» ← «Create rule»
- نام قانون: `Iran visitors to Liara edge`
- «Edit expression» و این عبارت:

```text
(ip.src.country eq "IR"
 and http.host in {"openfund.cloud" "www.openfund.cloud"}
 and http.request.method eq "GET"
 and any(http.request.headers["sec-fetch-mode"][*] eq "navigate")
 and not cf.client.bot
 and not http.request.uri.query contains "region=global")
```

- Then: «Dynamic»، با عبارت `concat("https://iran.openfund.cloud", http.request.uri.path)`، کد وضعیت **302**، گزینه «Preserve query string» روشن
- ابتدا قانون را **غیرفعال** ذخیره کنید و فقط پس از تأیید نهایی روشن کنید.

**چرا امن است:**

- فقط ناوبری کامل صفحه (`navigate`) هدایت می‌شود. درخواست‌های API، جریان زنده، فایل‌ها، `/version`، فراخوانی‌های DePay و مانیتورها هدایت نمی‌شوند.
- ربات‌های شناخته‌شده مستثنا هستند.
- با `https://openfund.cloud/?region=global` همیشه می‌توان نسخه اصلی را باز کرد.

**بررسی موفقیت:** از اینترنت ایرانی، باز کردن `https://openfund.cloud` به `iran.openfund.cloud` برود. از خارج از ایران تغییری نباشد.

**در صورت خطا:** اگر Cloudflare عبارت را نپذیرفت، احتمالاً فیلد `cf.client.bot` یا `http.request.headers` در پلن شما در دسترس نیست. بخش ربات را حذف کنید، اما بخش `sec-fetch-mode` را هرگز حذف نکنید. اگر آن هم پذیرفته نشد، مسیریابی را فعال نکنید.

## ۱۳. غیرفعال‌سازی فوری مسیریابی

همان مسیر «Rules» ← «Redirect Rules» ← کلید قانون `Iran visitors to Liara edge` را خاموش کنید. اثر آن در چند ثانیه اعمال می‌شود. چون کد 302 است، مرورگرها آن را برای همیشه کش نمی‌کنند.

## ۱۴. بازگشت به نسخه قبلی (Rollback)

| موقعیت | اقدام |
| :--- | :--- |
| استقرار جدید لیارا خراب است | Workflow مرحله ۵ را با `edge_commit` قبلی (که سالم بود) دوباره اجرا کنید. فهرست استقرارها در «تاریخچه» لیارا هست. |
| متغیر محیطی اشتباه | مرحله ۲ را اصلاح کنید و برنامه را از پنل ری‌استارت کنید |
| SSL یا DNS خراب | مسیریابی (مرحله ۱۳) را خاموش کنید، سپس رکوردها را با صفحه لیارا تطبیق دهید |
| لیارا به Render وصل نمی‌شود یا تأخیر زیاد است | مسیریابی را خاموش کنید. کاربران از `openfund.cloud` استفاده کنند. |
| خطای ورود (`invalid_domain`) | مرحله ۱۰ انجام نشده یا Blueprint همگام نشده است |
| مشکل خود برنامه Openfund | بازگشت روی Render طبق [ROLLBACK.md](ROLLBACK.md). نسخه ایران خودکار همان را نشان می‌دهد. |
| توقف کامل نسخه ایران | در پنل لیارا برنامه را خاموش کنید. هیچ داده‌ای از بین نمی‌رود. |

هیچ‌کدام از این اقدامات به حذف پایگاه داده یا تغییر رکوردهای معاملاتی نیاز ندارد.

## ۱۵. خلاصه وضعیت

| مرحله | وضعیت |
| :--- | :--- |
| کد، Docker، Workflow، اسکریپت آزمون | COMPLETE (روی شاخه، ادغام نشده) |
| ساخت برنامه، متغیرها، توکن، GitHub (مراحل ۱ تا ۴) | NEEDS OWNER ACTION |
| استقرار و آزمون واقعی روی لیارا (مراحل ۵ تا ۷) | NOT VERIFIED |
| دامنه و SSL (مراحل ۸ و ۹) | NEEDS OWNER ACTION |
| ورود با کیف پول (مرحله ۱۰) | BLOCKED (نیازمند تغییر `ALLOWED_DOMAINS` و تأیید شما) |
| مسیریابی کشوری | غیرفعال. فقط پس از پذیرش و تأیید صریح. |

</div>
