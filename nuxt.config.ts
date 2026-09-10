// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  compatibilityDate: '2025-07-15',
  devtools: { enabled: true },
  modules: ['nuxt-auth-utils', '@nuxt/eslint'],
  runtimeConfig: {
    session: {
      // h3 defaults the session cookie to Secure, which browsers silently
      // drop on a plain-HTTP origin. This deploys with no reverse proxy/TLS
      // in front (see CLAUDE.md), so Secure would make login look like it
      // works (200 OK) while never actually setting the cookie.
      cookie: { secure: false },
    },
  },
  app: {
    head: {
      htmlAttrs: { lang: 'cs' },
      title: 'Recepikarter',
      meta: [{ name: 'viewport', content: 'width=device-width, initial-scale=1' }],
      link: [
        { rel: 'preconnect', href: 'https://fonts.googleapis.com' },
        { rel: 'preconnect', href: 'https://fonts.gstatic.com', crossorigin: '' },
        {
          rel: 'stylesheet',
          href: 'https://fonts.googleapis.com/css2?family=Fraunces:wght@500;600;700&family=IBM+Plex+Sans:wght@400;500;600;700&family=IBM+Plex+Mono:wght@500;600;700&display=swap',
        },
        { rel: 'icon', type: 'image/svg+xml', href: '/icon.svg' },
        { rel: 'icon', type: 'image/x-icon', href: '/favicon.ico' },
        { rel: 'apple-touch-icon', href: '/apple-touch-icon.png' },
      ],
      script: [
        {
          // Anti-flash: applies a persisted dark theme to <html> before
          // first paint, straight from localStorage, ahead of Vue
          // hydration. Keep the storage key in sync with
          // app/composables/useTheme.ts (THEME_STORAGE_KEY) and
          // app/plugins/theme.client.ts.
          innerHTML:
            "(function(){try{if(localStorage.getItem('recepikarter-theme')==='dark'){document.documentElement.setAttribute('data-theme','dark')}}catch(e){}})()",
        },
      ],
    },
  },
})
