export type Theme = 'light' | 'dark'

const choiceKey = 'of-theme-choice'
let sessionChoice: Theme | null = null

function storedChoice(): Theme | null {
  try {
    const choice = localStorage.getItem(choiceKey)
    return choice === 'light' || choice === 'dark' ? choice : sessionChoice
  } catch {
    return sessionChoice
  }
}

function systemTheme(): Theme {
  return window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}

export function preferredTheme(): Theme {
  return storedChoice() || systemTheme()
}

export function currentTheme(): Theme {
  return document.documentElement.dataset.theme === 'dark' ? 'dark' : 'light'
}

export function applyTheme(theme: Theme): void {
  if (document.documentElement.dataset.theme !== theme) document.documentElement.dataset.theme = theme
  // The classic terminal and existing regression checks read this resolved value.
  // It is not evidence that the user made an explicit choice.
  try { localStorage.setItem('of-theme', theme) } catch { /* Storage is optional. */ }
  document.querySelectorAll<HTMLElement>('#theme-toggle, .of-daynight').forEach(button => decorateThemeToggle(button, theme))
}

/* Day/night switch artwork (styles: theme-toggle.css). Static markup — the
   visual state follows html[data-theme], so no re-render is needed. */
const star = (i: number, x: number, y: number, r: number, sparkle = false) => sparkle
  ? `<g transform="translate(${x} ${y}) scale(${r})"><path class="of-dn-star" style="--i:${i}" d="M0 -1Q.12 -.12 1 0Q.12 .12 0 1Q-.12 .12 -1 0Q-.12 -.12 0 -1Z"/></g>`
  : `<circle class="of-dn-star" style="--i:${i}" cx="${x}" cy="${y}" r="${r}"/>`
const cloud = (n: number, circles: number[][]) =>
  `<svg class="of-dn-cloud c${n}" viewBox="0 0 530 243" aria-hidden="true">${circles.map(([cx, cy, r]) => `<circle cx="${cx}" cy="${cy}" r="${r}"/>`).join('')}</svg>`
export const DAY_NIGHT_MARKUP = '<span class="of-dn-pill" aria-hidden="true">'
  + '<span class="of-dn-layer of-dn-night"></span>'
  + `<svg class="of-dn-layer of-dn-stars" viewBox="0 0 530 243">${[
    star(0, 70, 70, 14, true), star(1, 160, 92, 10, true), star(2, 232, 72, 12, true), star(3, 250, 160, 15, true),
    star(4, 120, 175, 10, true), star(5, 48, 130, 4), star(6, 200, 130, 4), star(7, 296, 108, 3.5)].join('')}</svg>`
  + '<span class="of-dn-track"><span class="of-dn-halo"></span><span class="of-dn-knob"><span class="of-dn-sun"></span><span class="of-dn-moon"><i></i><i></i><i></i></span></span></span>'
  + cloud(1, [[230, 232, 42], [310, 205, 48], [388, 172, 54], [462, 110, 70], [528, 48, 72], [480, 262, 100], [540, 150, 60]])
  + cloud(2, [[180, 248, 40], [262, 228, 44], [345, 212, 46], [428, 180, 54], [505, 118, 66], [548, 62, 58], [500, 252, 90]])
  + cloud(3, [[118, 268, 42], [200, 254, 42], [285, 246, 44], [370, 238, 46], [452, 208, 52], [530, 150, 66], [510, 262, 85]])
  + '</span>'

/** Turns an existing theme button into the day/night switch (idempotent).
 *  role=switch + aria-checked report the state: checked = dark (night). */
export function decorateThemeToggle(button: Element, theme: Theme = currentTheme()): void {
  if (!button.querySelector('.of-dn-pill')) {
    button.innerHTML = DAY_NIGHT_MARKUP
    button.classList.add('of-daynight')
    button.removeAttribute('title')
  }
  button.setAttribute('role', 'switch')
  button.setAttribute('aria-checked', String(theme === 'dark'))
}

export function chooseTheme(theme: Theme): void {
  try {
    localStorage.setItem(choiceKey, theme)
    sessionChoice = null
  } catch { sessionChoice = theme }
  applyTheme(theme)
}

export function startThemeSync(): () => void {
  const media = window.matchMedia?.('(prefers-color-scheme: dark)')
  const sync = () => applyTheme(preferredTheme())
  const onStorage = (event: StorageEvent) => {
    if (event.key === choiceKey || event.key === null) sync()
  }
  media?.addEventListener('change', sync)
  window.addEventListener('storage', onStorage)
  sync()
  return () => {
    media?.removeEventListener('change', sync)
    window.removeEventListener('storage', onStorage)
  }
}
