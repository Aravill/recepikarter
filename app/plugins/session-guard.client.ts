// The server rejects a session that's no longer valid, but an already-open
// tab never noticed: it stayed in the app with every request failing and
// empty pages. This logs the tab out instead; the login page then shows why
// (from the cookie the server set, see endSession in server/utils/auth.ts).
export default defineNuxtPlugin(() => {
  const { session, loggedIn, fetch: refreshSession } = useUserSession()
  const router = useRouter()

  // apiFetch (app/utils/apiFetch.ts) announces a rejected session.
  window.addEventListener(SESSION_ENDED_EVENT, () => {
    session.value = null
  })

  watch(loggedIn, (now, before) => {
    if (before && !now && router.currentRoute.value.path !== '/login') navigateTo('/login')
  })

  // A tab left open in the background makes no requests, so re-check the
  // session when it's looked at again rather than on the next click. A
  // rejected or already-cleared session comes back empty, which logs the
  // tab out through the watcher above.
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible' && loggedIn.value) refreshSession()
  })
})
