export default defineEventHandler(async (event) => {
  if (event.path.startsWith('/api/recipes')) {
    await requireUserSession(event)
  }
})
