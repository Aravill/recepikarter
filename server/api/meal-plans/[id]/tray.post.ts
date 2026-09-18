// Adds a recipe to the plan's tray — the badges the drag-drop grid can be
// filled from. Only manually-added recipes show up here, never every
// recipe in the database (see meal_plan_recipes's doc comment in
// server/utils/db.ts).
export default defineEventHandler(async (event) => {
  const id = Number(getRouterParam(event, 'id'))
  if (!getMealPlan(id)) {
    throw createError({ statusCode: 404, statusMessage: 'Meal plan not found' })
  }

  const body = await readBody(event)
  const { recipeId } = parseMealPlanTrayInput(body)
  if (!getRecipe(recipeId)) {
    throw createError({ statusCode: 404, statusMessage: 'Recipe not found' })
  }

  addMealPlanTrayRecipe(id, recipeId)
  setResponseStatus(event, 201)
  return { trayRecipeIds: listMealPlanTrayRecipeIds(id) }
})
