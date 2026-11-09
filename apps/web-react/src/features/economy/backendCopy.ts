import { text as t, type Localized } from '../information/content'

/* Definitions and provenance lines authored by the backend (apps/backend/economy.js).
   The backend returns English; the website shows each in the reader's language.
   Keys are the exact English strings the API returns. Technical table names
   inside the provenance lines are kept verbatim. */
const ENTRIES: Localized[] = [
  t('purchase_orders (status=paid, set only by verified on-chain payment), payment_adjustments', 'purchase_orders (وضعیت paid که فقط با پرداخت تأییدشدهٔ آن‌چین ثبت می‌شود)، payment_adjustments'),
  t('paid ÷ (paid + expired + cancelled orders); pending orders excluded', 'پرداخت‌شده ÷ (پرداخت‌شده + منقضی‌شده + لغوشده)؛ سفارش‌های در انتظار حذف شده‌اند'),
  t('openfund_challenges, challenge_events (evaluation engine state of record, read-only), withdrawal_requests', 'openfund_challenges، challenge_events (وضعیت ثبت‌شدهٔ موتور ارزیابی، فقط‌خواندنی)، withdrawal_requests'),
  t('Instant (stage 0) accounts plus accounts whose final evaluation stage passed', 'حساب‌های فوری (مرحلهٔ ۰) به‌علاوهٔ حساب‌هایی که مرحلهٔ نهایی ارزیابی را گذرانده‌اند'),
  t('Pass rate = passed ÷ (passed + failed + expired) for that stage. First payout rate = funded accounts with ≥1 paid withdrawal ÷ funded accounts.', 'نرخ قبولی = قبول‌شده ÷ (قبول‌شده + مردود + منقضی) برای همان مرحله. نرخ اولین برداشت = حساب‌های فاندد دارای دست‌کم یک برداشت پرداخت‌شده ÷ حساب‌های فاندد.'),
  t('withdrawal_requests (approved = reviewed obligation; paid = transfer recorded with payout reference)', 'withdrawal_requests (تأییدشده = تعهد بررسی‌شده؛ پرداخت‌شده = انتقال ثبت‌شده با مرجع پرداخت)'),
  t('Confirmed challenge payments whose on-chain receiver is the treasury address', 'پرداخت‌های تأییدشدهٔ چلنج که گیرندهٔ آن‌چین آن‌ها نشانی خزانه است'),
  t('Transfers recorded with an operator payout/settlement reference; not inferred from chain traffic', 'انتقال‌هایی که با مرجع پرداخت یا تسویهٔ اپراتور ثبت شده‌اند؛ از ترافیک زنجیره استنباط نمی‌شوند'),
  t('verified_expenses (status=verified; each row cites a provider API, invoice, receipt or contract reference)', 'verified_expenses (وضعیت verified؛ هر ردیف به API ارائه‌دهنده، فاکتور، رسید یا قرارداد ارجاع می‌دهد)'),
]

export const BACKEND_COPY: Record<string, Localized> = Object.fromEntries(ENTRIES.map(entry => [entry.en, entry]))
