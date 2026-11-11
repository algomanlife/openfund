/* ============================================================
   Openfund — numeric input normalization (UI boundary only)

   Converts what a person types or pastes into a price field into a plain
   ASCII decimal string BEFORE the existing validation and trading logic
   see it. Nothing here rounds, rescales or validates prices; the decimal
   text is kept digit-for-digit so no floating-point step changes it.

   Accepted digits: ASCII 0-9, Extended Arabic-Indic (Persian) digits
   U+06F0…U+06F9 and Arabic-Indic digits U+0660…U+0669. Decimal separators:
   '.', the Arabic decimal separator U+066B, and ',' when
   the interface language writes decimals with a comma (ru) — elsewhere ','
   is a thousands separator. Thousands separators U+066C, spaces,
   NBSP/thin spaces and (non-comma-decimal locales) ',' are dropped, but
   only between digits of the integer part. Bidi control marks pasted from
   RTL text are ignored. Anything else (letters, signs, exponents, a second
   decimal separator) is rejected — never silently "fixed".

   API (window.OpenfundNumericInput):
     normalizeDigits(text) → text with Persian/Arabic digits as ASCII
     parseDecimal(raw, { lang }) →
       { ok: true, empty: true }                    blank input
       { ok: true, text: '3995.5', value: 3995.5 }  valid
       { ok: false, error: 'invalid_number' }       rejected
   ============================================================ */
(function (global) {
  'use strict';
  const FA0 = 0x06F0, AR0 = 0x0660;
  const BIDI = /[‎‏‪-‮⁦-⁩؜]/g;
  const SPACES = /[\s   ]/;

  function normalizeDigits(text) {
    let out = '';
    for (const ch of String(text == null ? '' : text)) {
      const c = ch.codePointAt(0);
      if (c >= FA0 && c <= FA0 + 9) out += String(c - FA0);
      else if (c >= AR0 && c <= AR0 + 9) out += String(c - AR0);
      else out += ch;
    }
    return out;
  }

  const commaDecimal = lang => /^ru\b/i.test(String(lang || ''));

  function parseDecimal(raw, opts) {
    const lang = opts && opts.lang;
    let s = normalizeDigits(String(raw == null ? '' : raw)).replace(BIDI, '').trim();
    if (!s) return { ok: true, empty: true };
    const decimalComma = commaDecimal(lang);
    let intPart = '', frac = null;
    for (let i = 0; i < s.length; i++) {
      const ch = s[i];
      if (ch >= '0' && ch <= '9') { if (frac === null) intPart += ch; else frac += ch; continue; }
      const isDecimal = ch === '.' || ch === '٫' || (decimalComma && ch === ',');
      if (isDecimal) {
        if (frac !== null) return { ok: false, error: 'invalid_number' };
        frac = '';
        continue;
      }
      const isGroup = ch === '٬' || SPACES.test(ch) || (!decimalComma && ch === ',');
      /* a grouping mark is only legal between two integer digits */
      if (isGroup && frac === null && /[0-9]/.test(intPart.slice(-1)) && /[0-9]/.test(normalizeDigits(s[i + 1] || ''))) continue;
      return { ok: false, error: 'invalid_number' };
    }
    if (!intPart && !frac) return { ok: false, error: 'invalid_number' };
    const text = (intPart || '0') + (frac ? '.' + frac : '');
    const value = Number(text);
    if (!Number.isFinite(value)) return { ok: false, error: 'invalid_number' };
    return { ok: true, text, value };
  }

  global.OpenfundNumericInput = { normalizeDigits, parseDecimal };
})(typeof window !== 'undefined' ? window : globalThis);
