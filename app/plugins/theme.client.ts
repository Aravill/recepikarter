// The blocking inline script in nuxt.config.ts (app.head.script) already
// set data-theme on <html> before first paint, straight from localStorage,
// so there's no flash. This just syncs the reactive useState('theme') to
// match, so the toggle icon (bulb on/off) reflects the persisted theme
// instead of always starting from the SSR default.
//
// Deferred to onNuxtReady (after hydration) rather than run eagerly during
// plugin setup: changing theme.value before the app mounts would make the
// client's first render of ThemeToggle's icon disagree with what the server
// already sent down, which Vue reports as a hydration mismatch. Waiting
// until hydration is done turns it into a normal (silent) reactive update
// instead — the accepted tradeoff documented in docs/dark-mode.md is that
// the icon can flip a frame late, not that it errors.
export default defineNuxtPlugin(() => {
  onNuxtReady(() => {
    const { theme } = useTheme()
    const stored = localStorage.getItem(THEME_STORAGE_KEY)
    theme.value = stored === 'dark' ? 'dark' : 'light'
    document.documentElement.setAttribute('data-theme', theme.value)
  })
})
