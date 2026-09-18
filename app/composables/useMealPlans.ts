import type { MealPlan, MealPlanDetail, MealPlanInput, MealPlanSlotInput } from '#shared/types/meal-plan'

export function useMealPlans() {
  // See app/composables/useRecipes.ts — SSR $fetch needs the cookie
  // forwarded explicitly or these all 401.
  const headers = import.meta.server ? useRequestHeaders(['cookie']) : undefined

  const listMealPlans = () => $fetch<MealPlan[]>('/api/meal-plans', { headers })
  const getMealPlan = (id: number) => $fetch<MealPlanDetail>(`/api/meal-plans/${id}`, { headers })
  const createMealPlan = (input: MealPlanInput) =>
    $fetch<MealPlan>('/api/meal-plans', { method: 'POST', body: input, headers })
  const updateMealPlan = (id: number, input: MealPlanInput) =>
    $fetch<MealPlan>(`/api/meal-plans/${id}`, { method: 'PUT', body: input, headers })
  const deleteMealPlan = (id: number) => $fetch(`/api/meal-plans/${id}`, { method: 'DELETE', headers })
  const setMealPlanSlot = (id: number, input: MealPlanSlotInput) =>
    $fetch(`/api/meal-plans/${id}/slots`, { method: 'PUT', body: input, headers })
  const addMealPlanTrayRecipe = (id: number, recipeId: number) =>
    $fetch<{ trayRecipeIds: number[] }>(`/api/meal-plans/${id}/tray`, {
      method: 'POST',
      body: { recipeId },
      headers,
    })
  const removeMealPlanTrayRecipe = (id: number, recipeId: number) =>
    $fetch<{ trayRecipeIds: number[] }>(`/api/meal-plans/${id}/tray/${recipeId}`, { method: 'DELETE', headers })

  return {
    listMealPlans,
    getMealPlan,
    createMealPlan,
    updateMealPlan,
    deleteMealPlan,
    setMealPlanSlot,
    addMealPlanTrayRecipe,
    removeMealPlanTrayRecipe,
  }
}
