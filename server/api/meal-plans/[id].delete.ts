export default defineEventHandler((event) => {
  const id = Number(getRouterParam(event, 'id'))
  const deleted = deleteMealPlan(id)
  if (!deleted) {
    throw createError({ statusCode: 404, statusMessage: 'Meal plan not found' })
  }
  setResponseStatus(event, 204)
  return null
})
