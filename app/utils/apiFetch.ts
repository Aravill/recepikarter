import type { SessionEndReason } from '#shared/types/user'

export const SESSION_ENDED_EVENT = 'recepikarter:session-ended'

// $fetch for the app's own /api routes — use it instead of $fetch in app
// code. A 401 means the server no longer accepts this tab's session
// (blocked user, password reset or changed elsewhere, expired; see
// requireActiveSession in server/utils/auth.ts), and the tab has to find
// out or it carries on with every request failing. This announces it;
// app/plugins/session-guard.client.ts does the logging out. An event rather
// than doing it here because this runs outside any component/Nuxt context.
//
// (Nuxt binds the auto-imported $fetch when the app boots, so replacing
// globalThis.$fetch from a plugin wouldn't reach existing call sites.)
export const apiFetch = $fetch.create({
  onResponseError({ request, response }) {
    if (import.meta.server || response.status !== 401) return
    const url = typeof request === 'string' ? request : request.url
    // A 401 from the login form just means wrong credentials.
    if (url.includes('/api/auth/login')) return
    const reason: SessionEndReason | undefined = response._data?.data?.sessionEnded
    window.dispatchEvent(new CustomEvent(SESSION_ENDED_EVENT, { detail: reason }))
  },
})
