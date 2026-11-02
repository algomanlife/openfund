import { text } from '../information/content'
import type { Locale } from '../information/content'
import type { ToolError } from '../../cms/contentTypes'

/** coded validation messages, localized at render time (the engine stays locale-free) */
const MESSAGES: Record<ToolError['code'], ReturnType<typeof text>> = {
  required: text('This field is required.', 'این فیلد لازم است.'),
  invalid: text('Enter a valid number.', 'یک عدد معتبر وارد کن.'),
  positive: text('Must be greater than zero.', 'باید بزرگ‌تر از صفر باشد.'),
  non_negative: text('Cannot be negative.', 'نمی‌تواند منفی باشد.'),
  min: text('Below the allowed minimum.', 'کمتر از حد مجاز است.'),
  max: text('Above the allowed maximum.', 'بیشتر از حد مجاز است.'),
  range: text('The two values are in the wrong order.', 'دو مقدار ترتیب درستی ندارند.'),
  order: text('This price is on the wrong side of your entry.', 'این قیمت در سمت اشتباهِ ورود تو است.'),
  empty: text('Nothing to compute yet.', 'هنوز چیزی برای محاسبه نیست.'),
  unbalanced: text('These inputs do not describe a valid position.', 'این ورودی‌ها یک موقعیت معتبر نمی‌سازند.'),
}

export function toolErrorMessage(error: ToolError, locale: Locale): string {
  const base = MESSAGES[error.code][locale]
  const param = error.params?.min ?? error.params?.max
  if (param !== undefined && (error.code === 'min' || error.code === 'max')) {
    return `${base} (${param})`
  }
  return base
}

/** verdict-style string results from the engine, localized here */
const VERDICTS: Record<string, ReturnType<typeof text>> = {
  ok: text('Inside the limits', 'داخل سقف‌ها'),
  caution: text('Getting close to a limit', 'به سقف نزدیک می‌شوی'),
  critical: text('A stop-out is one trade away', 'یک معامله تا نقض فاصله دارد'),
  breach: text('A limit would be breached', 'یکی از سقف‌ها نقض می‌شود'),
  compliant: text('Within the consistency limit', 'داخل حد تداوم'),
  exceeded: text('Outside the consistency limit', 'بیرون حد تداوم'),
}

export function verdictLabel(value: string, locale: Locale): string | null {
  return VERDICTS[value]?.[locale] ?? null
}

/** notes emitted by the engine, localized here */
const NOTES: Record<string, ReturnType<typeof text>> = {
  'margin-exceeds-equity': text('The margin requirement is larger than your equity.', 'وجه تضمین لازم از سرمایهٔ تو بیشتر است.'),
  'below-maintenance-floor': text('This margin is already under the maintenance requirement.', 'این مارجین از قبل زیر الزام نگهداری است.'),
  'trailing-mode': text('The total allowance trails the highest recorded level; it locks at breakeven after the published profit threshold.', 'سقف کل از بالاترین سطح ثبت‌شده پیروی می‌کند و پس از آستانهٔ سودِ منتشرشده در سربه‌سر قفل می‌شود.'),
  'no-edge': text('Your inputs describe a zero or negative edge, so the model reports certain ruin over a long sequence.', 'ورودی‌هایت لبهٔ صفر یا منفی می‌سازند؛ مدل برای توالی بلند، ویرانی حتمی گزارش می‌کند.'),
  'includes-planned-day': text('The verdict includes the planned day you entered.', 'حکم، روزِ برنامه‌ریزی‌شدهٔ واردشده را هم حساب کرده است.'),
}

export function toolNote(note: string, locale: Locale): string | null {
  return NOTES[note]?.[locale] ?? null
}
