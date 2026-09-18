// Assigns, skips, or clears one slot — one endpoint for all three since
// they're the same upsert with different values (see MealPlanSlotInput's
// doc comment and setMealPlanSlot in server/utils/db.ts). Drag-drop on the
// planning page calls this on every drop, not batched behind "Uložit
// plán" — only the plan's own name/dates/people_count wait for that button.
export default defineEventHandler(async (event) => {
  const id = Number(getRouterParam(event, 'id'))
  const plan = getMealPlan(id)
  if (!plan) {
    throw createError({ statusCode: 404, statusMessage: 'Meal plan not found' })
  }

  const body = await readBody(event)
  const input = parseMealPlanSlotInput(body)

  if (input.date < plan.dateStart || input.date > plan.dateEnd) {
    throw createError({ statusCode: 400, statusMessage: 'date is outside the plan range' })
  }
  if (input.recipeId !== null && !getRecipe(input.recipeId)) {
    throw createError({ statusCode: 404, statusMessage: 'Recipe not found' })
  }

  return setMealPlanSlot(id, input)!
})
