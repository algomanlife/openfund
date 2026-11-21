/* Translation completeness for every desktop string.
 *  - fa and en are required at every t()/format() call site and table pair.
 *  - ar, ru and zh-CN must resolve through the reviewed web dictionaries
 *    (same lookup rules as the renderer: direct, `${name}` templates,
 *    capitalised display copy) or the reviewed desktop dictionary.
 *  - A string with neither must have an unreviewed draft, so nothing is
 *    forgotten; the unreviewed count is printed for the release record.
 *  - OPEN_TRADE_I18N_STRICT=1 additionally fails on any unreviewed string
 *    (the public-release gate). */
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { ar } from "../../web-react/src/i18n/messages/ar.ts";
import { ru } from "../../web-react/src/i18n/messages/ru.ts";
import { zhCN } from "../../web-react/src/i18n/messages/zh-CN.ts";
import {
  applyTranslationTemplate,
  compileTranslationTemplate,
} from "../../web-react/src/i18n/template.ts";

const here = (p) => fileURLToPath(new URL(p, import.meta.url));
const json = (p) => JSON.parse(readFileSync(here(p), "utf8"));
const source = readFileSync(here("../src/main.tsx"), "utf8");
const S = '("(?:[^"\\\\]|\\\\.)*")';
const PERSIAN = /[؀-ۿ]/;

export function desktopStrings(text = source) {
  const pairs = new Map();
  for (const re of [
    new RegExp(`\\bt\\(\\s*${S}\\s*,\\s*${S}`, "g"),
    new RegExp(`format\\(\\s*t\\s*,\\s*${S}\\s*,\\s*${S}`, "g"),
    new RegExp(`\\[\\s*(?:"\\w+"\\s*,\\s*)?${S}\\s*,\\s*${S}\\s*[,\\]]`, "g"),
  ])
    for (const m of text.matchAll(re)) {
      const en = JSON.parse(m[1]), fa = JSON.parse(m[2]);
      if (PERSIAN.test(fa)) pairs.set(en, fa);
    }
  return pairs;
}

const LOCALES = {
  ar: { messages: ar, content: "../../web-react/src/i18n/content/ar.json" },
  ru: { messages: ru, content: "../../web-react/src/i18n/content/ru.json" },
  "zh-CN": { messages: zhCN, content: "../../web-react/src/i18n/content/zh-CN.json" },
};
const NEUTRAL = /^(?:P&L|PnL|PROP|PERPETUAL|SL|TP)$/;

function resolver(locale) {
  const dict = { ...json(LOCALES[locale].content), ...LOCALES[locale].messages };
  const templates = Object.entries(dict).map(([k, v]) => compileTranslationTemplate(k, v)).filter(Boolean);
  const lower = new Map(Object.entries(dict).map(([k, v]) => [k.toLowerCase(), v]));
  const reviewed = json(`../src/i18n-desktop/reviewed/${locale}.json`);
  return (en) =>
    reviewed[en] ??
    dict[en] ??
    templates.map((t) => applyTranslationTemplate(t, en)).find((v) => v !== undefined) ??
    (en === en.toUpperCase() && /[A-Z]{3}/.test(en) ? lower.get(en.toLowerCase()) : undefined);
}

test("every desktop string has English and Persian source text", () => {
  const pairs = desktopStrings();
  assert.ok(pairs.size > 150, `expected the full desktop catalogue, found ${pairs.size}`);
  for (const [en, fa] of pairs) {
    assert.ok(en.trim(), "empty English source");
    assert.ok(PERSIAN.test(fa), `Persian missing for "${en}"`);
    const holes = (v) => [...v.matchAll(/\$\{([^}]+)\}/g)].map((m) => m[1]).sort().join();
    assert.equal(holes(fa), holes(en), `placeholders differ for "${en}"`);
  }
});

test("no hardcoded English label remains in visible desktop chrome", () => {
  for (const banned of [
    'aria-label="Settings"', 'aria-label="Select account"', ">Capture<",
    ">Save PNG<", ">Copy image<", "<option value=\"dark\">Dark", "Server region\n",
    '"0.0.2"', "feature/open-trade-desktop",
  ])
    assert.ok(!source.includes(banned), `hardcoded copy: ${banned}`);
});

for (const locale of Object.keys(LOCALES)) {
  test(`${locale}: every desktop string is reviewed or has a pending draft`, () => {
    const resolve = resolver(locale);
    const drafts = json(`../src/i18n-desktop/drafts/${locale}.json`);
    assert.equal(drafts._status, "draft-unreviewed");
    const unreviewed = [];
    for (const en of desktopStrings().keys()) {
      if (NEUTRAL.test(en) || resolve(en) !== undefined) continue;
      assert.ok(drafts.strings[en], `${locale}: no reviewed translation or draft for "${en}"`);
      unreviewed.push(en);
    }
    console.log(`# ${locale}: ${unreviewed.length} desktop strings await review`);
    if (process.env.OPEN_TRADE_I18N_STRICT === "1")
      assert.deepEqual(unreviewed, [], `${locale}: unreviewed strings block public release`);
  });
}

test("drafts keep placeholders and never ship at runtime", () => {
  const runtime = readFileSync(here("../src/i18n.ts"), "utf8");
  assert.ok(!/i18n-desktop\/drafts/.test(runtime.replace(/\/\*[\s\S]*?\*\//g, "")), "drafts must not be imported");
  for (const locale of Object.keys(LOCALES))
    for (const [en, value] of Object.entries(json(`../src/i18n-desktop/drafts/${locale}.json`).strings)) {
      const holes = (v) => [...v.matchAll(/\$\{([^}]+)\}/g)].map((m) => m[1]).sort().join();
      assert.equal(holes(value), holes(en), `${locale} draft placeholders for "${en}"`);
    }
});
