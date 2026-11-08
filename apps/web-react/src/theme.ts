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
  document.querySelectorAll<HTMLElement>('#theme-toggle').forEach(button => {
    button.textContent = theme === 'dark' ? '◐' : '◑'
  })
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
