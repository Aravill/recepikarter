// The client learns whether it's logged in from GET /api/_auth/session,
// which on its own only unseals the cookie. Run the same checks as API
// requests there, so a revoked session (blocked user, password changed
// elsewhere) shows up as logged out instead of failing on the next call.
export default defineNitroPlugin(() => {
  sessionHooks.hook('fetch', async (session, event) => {
    if (session.user) await requireActiveSession(event)
  })
})
