// Only hides the badge — a recipe already assigned to a slot stays
// assigned (see removeMealPlanTrayRecipe's doc comment in
// server/utils/db.ts). No existence checks beyond the plan itself: removing
// a recipeId that was never in the tray is a silent no-op, same as
// deleting anything else that's already gone.
export default defineEventHandler((event) => {
  const id = Number(getRouterParam(event, 'id'))
  if (!getMealPlan(id)) {
    throw createError({ statusCode: 404, statusMessage: 'Meal plan not found' })
  }

  const recipeId = Number(getRouterParam(event, 'recipeId'))
  removeMealPlanTrayRecipe(id, recipeId)
  return { trayRecipeIds: listMealPlanTrayRecipeIds(id) }
})
