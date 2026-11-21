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
  const trigger = page.locator(TRIGGER).first()
  await trigger.waitFor({ state: 'attached' })
  if (await trigger.getAttribute('data-locale') === code) return
  await trigger.evaluate(el => el.click())
  await page.locator(`.of-language-panel [role=option][data-locale="${code}"]`).click()
}

async function toggleLocale(page) {
  await chooseLocale(page, (await currentLocale(page)) === 'fa' ? 'en' : 'fa')
}

module.exports = { TRIGGER, currentLocale, chooseLocale, toggleLocale }
