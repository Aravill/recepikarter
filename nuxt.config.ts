// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  compatibilityDate: '2025-07-15',
  devtools: { enabled: true },
  modules: ['nuxt-auth-utils', '@nuxt/eslint'],
  runtimeConfig: {
    session: {
      // HTTPS is terminated by the Caddy proxy in front, so the browser
      // sees an https origin even though the app itself speaks plain HTTP.
      // Browsers silently drop a Secure cookie on a plain-HTTP origin other
      // than localhost — set NUXT_SESSION_COOKIE_SECURE=false to log in
      // over http://<lan-ip>:3000 directly.
      cookie: { secure: true },
      // Absolute lifetime (h3 counts from login, not last use): a stolen
      // cookie stops working after 30 days at the latest.
      maxAge: 60 * 60 * 24 * 30,
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
