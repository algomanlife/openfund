/* Open Trade localization. Reuses the Openfund web terminal's locale list,
 * direction rules and reviewed dictionaries (apps/web-react/src/i18n) instead
 * of a second translation system. Desktop call sites keep the established
 * `t(english, persian)` pair; Arabic, Russian and Simplified Chinese are
 * looked up by the English source in the reviewed web dictionaries. A string
 * without a reviewed translation is shown in English and reported (never
 * machine-translated at runtime). Desktop-only strings live in
 * `i18n-desktop/reviewed/<locale>.json` once a fluent reviewer approves them;
 * `i18n-desktop/drafts/` holds unreviewed drafts that are never loaded.
 * tests/i18n.test.mjs fails if a desktop string is in neither place. */
import {
  LOCALES,
  LOCALE_NAMES,
  dirOf,
  intlLocale,
  isLocale,
  type AppLocale,
} from "../../web-react/src/i18n/locales";
import {
  ensureLocaleContent,
  missesFor,
  translateSource,
} from "../../web-react/src/i18n/messages";

import reviewedAr from "./i18n-desktop/reviewed/ar.json";
import reviewedRu from "./i18n-desktop/reviewed/ru.json";
import reviewedZh from "./i18n-desktop/reviewed/zh-CN.json";

const REVIEWED: Record<"ar" | "ru" | "zh-CN", Record<string, string>> = {
  ar: reviewedAr,
  ru: reviewedRu,
  "zh-CN": reviewedZh,
};

export { LOCALES, LOCALE_NAMES, dirOf, intlLocale, isLocale, type AppLocale };
export const LOCALE_KEY = "ot-locale";

/** Explicit saved choice, then the operating-system language, then English. */
export function initialLocale(
  stored: string | null,
  languages: readonly string[] = [],
): AppLocale {
  if (isLocale(stored)) return stored;
  for (const tag of languages) {
    const lower = String(tag).toLowerCase();
    if (lower.startsWith("fa")) return "fa";
    if (lower.startsWith("ar")) return "ar";
    if (lower.startsWith("ru")) return "ru";
    if (lower === "zh" || lower.startsWith("zh-cn") || lower.startsWith("zh-hans") || lower.startsWith("zh-sg"))
      return "zh-CN";
    if (lower.startsWith("en")) return "en";
  }
  return "en";
}

export type Translate = (english: string, persian: string) => string;

export function translator(locale: AppLocale): Translate {
  if (locale === "en") return (english) => english;
  if (locale === "fa") return (_english, persian) => persian;
  const own = REVIEWED[locale];
  return (english) => own[english] ?? translateSource(locale, english);
}

/** Interpolated string: both sources use `${name}` placeholders. */
export function format(t: Translate, english: string, persian: string, values: Record<string, string | number>) {
  return t(english, persian).replace(/\$\{([^}]+)\}/g, (m, k: string) =>
    Object.hasOwn(values, k) ? String(values[k]) : m,
  );
}

/** Load the locale's reviewed editorial dictionary, then apply document direction. */
export async function applyLocale(locale: AppLocale) {
  await ensureLocaleContent(locale).catch(() => {});
  const root = document.documentElement;
  root.lang = locale;
  root.dir = dirOf(locale);
  root.dataset.locale = locale;
}

export const untranslated = (locale: AppLocale) =>
  locale === "fa" || locale === "en" ? [] : missesFor(locale);
