export default defineEventHandler((event) => {
  const id = Number(getRouterParam(event, 'id'))
  const user = setUserStatus(id, 'active')
  if (!user) {
    throw createError({ statusCode: 404, statusMessage: 'User not found' })
  }
  return user
})
