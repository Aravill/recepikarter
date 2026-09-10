export type Theme = 'light' | 'dark'

// Also referenced by the blocking anti-flash script in nuxt.config.ts and by
// app/plugins/theme.client.ts — keep all three in sync if this changes.
export const THEME_STORAGE_KEY = 'recepikarter-theme'

function applyThemeAttr(value: Theme) {
  document.documentElement.setAttribute('data-theme', value)
}

// SSR-safe shared theme state (useState, not a plain module-level ref —
// this app is server-rendered on a single long-lived Node process, so a
// plain ref would leak the last-set theme across requests/visitors).
export function useTheme() {
  const theme = useState<Theme>('theme', () => 'light')

  function setTheme(value: Theme) {
    theme.value = value
    if (import.meta.client) {
      applyThemeAttr(value)
      localStorage.setItem(THEME_STORAGE_KEY, value)
    }
  }

  // Reports whether this call specifically switched light -> dark, so
  // callers can show the export-stays-light notice only on that activating
  // click, not any time dark happens to already be the active theme.
  function toggleTheme(): { activatedDark: boolean } {
    const activatedDark = theme.value === 'light'
    setTheme(activatedDark ? 'dark' : 'light')
    return { activatedDark }
  }

  return { theme, setTheme, toggleTheme }
}
