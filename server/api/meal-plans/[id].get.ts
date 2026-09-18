import type { MealPlanDetail } from '#shared/types/meal-plan'

export default defineEventHandler((event): MealPlanDetail => {
  const id = Number(getRouterParam(event, 'id'))
  const plan = getMealPlan(id)
  if (!plan) {
    throw createError({ statusCode: 404, statusMessage: 'Meal plan not found' })
  }

  return {
    plan,
    slots: listMealPlanSlots(id),
    trayRecipeIds: listMealPlanTrayRecipeIds(id),
  }
})
