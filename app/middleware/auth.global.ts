export default defineNuxtRouteMiddleware((to) => {
  const { loggedIn, user } = useUserSession()

  if (to.path === '/login') {
    if (loggedIn.value) return navigateTo('/')
    return
  }

  if (!loggedIn.value) {
    return navigateTo('/login')
  }

  // Forced first-login flow: nothing else is reachable until a
  // temporary-password account sets its own password.
  if (user.value?.mustChangePassword && to.path !== '/change-password') {
    return navigateTo('/change-password')
  }

  if (to.path.startsWith('/admin') && user.value?.role !== 'admin') {
    return navigateTo('/')
  }
})
