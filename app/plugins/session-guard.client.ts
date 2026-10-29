import { SESSION_END_MESSAGES } from '#shared/types/user'
import type { SessionEndReason } from '#shared/types/user'

// The server rejects a session that's no longer valid with a 401, but an
// already-open tab never noticed: it stayed in the app with every request
// failing and empty pages. apiFetch (app/utils/apiFetch.ts) announces those
// 401s; this logs the tab out and tells the user why on the login page.
export default defineNuxtPlugin(() => {
  const { session, loggedIn } = useUserSession()
  const notice = useSessionEndedNotice()
  const router = useRouter()

  window.addEventListener(SESSION_ENDED_EVENT, (e) => {
    if (!loggedIn.value) return
    const reason = (e as CustomEvent<SessionEndReason | undefined>).detail
    notice.value = (reason && SESSION_END_MESSAGES[reason]) || 'Byli jste odhlášeni. Přihlaste se znovu.'
    session.value = null
  })

  watch(loggedIn, (now, before) => {
    if (before && !now && router.currentRoute.value.path !== '/login') navigateTo('/login')
  })

  // A tab left open in the background makes no requests, so re-check the
  // session when it's looked at again rather than on the next click. A 401
  // here goes through the listener above; success needs nothing.
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible' && loggedIn.value) {
      apiFetch('/api/_auth/session').catch(() => {})
    }
  })
})
