/* Language selector helpers for browser tests. The selector is a button that
 * opens a listbox (src/i18n/LanguageSelect.tsx); its current locale is in
 * data-locale. The first selector may sit in a closed drawer on narrow
 * layouts, so it is opened with an element click; the panel is portalled to
 * <body> and always visible once open. */
const TRIGGER = 'button.of-language-select'

async function currentLocale(page) {
  return page.locator(TRIGGER).first().getAttribute('data-locale')
}

async function chooseLocale(page, code) {
  /* The header can re-render while the panel is open (a client-side redirect
     or a hydration pass), which detaches the option. Reopen and retry until
     the selector reports the chosen locale, as a person would. */
  for (let attempt = 1; ; attempt++) {
    const trigger = page.locator(TRIGGER).first()
    await trigger.waitFor({ state: 'attached' })
    if (await trigger.getAttribute('data-locale') === code) return
    try {
      await trigger.evaluate(el => el.click())
      await page.locator(`.of-language-panel [role=option][data-locale="${code}"]`).click({ timeout: 5000 })
      await page.waitForFunction(([sel, c]) => document.querySelector(sel)?.getAttribute('data-locale') === c, [TRIGGER, code], { timeout: 10000 })
      return
    } catch (error) {
      if (attempt >= 3) throw error
      await page.waitForLoadState('domcontentloaded').catch(() => {})
      await page.waitForTimeout(500)
    }
  }
}

async function toggleLocale(page) {
  await chooseLocale(page, (await currentLocale(page)) === 'fa' ? 'en' : 'fa')
}

module.exports = { TRIGGER, currentLocale, chooseLocale, toggleLocale }
