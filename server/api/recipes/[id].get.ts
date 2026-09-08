export default defineEventHandler((event) => {
  const id = Number(getRouterParam(event, 'id'))
  const recipe = getRecipe(id)
  if (!recipe) {
    throw createError({ statusCode: 404, statusMessage: 'Recipe not found' })
  }
  return recipe
})
