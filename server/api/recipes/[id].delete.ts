export default defineEventHandler((event) => {
  const id = Number(getRouterParam(event, 'id'))
  const deleted = deleteRecipe(id)
  if (!deleted) {
    throw createError({ statusCode: 404, statusMessage: 'Recipe not found' })
  }
  setResponseStatus(event, 204)
  return null
})
