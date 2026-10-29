import type { MealPlan, MealPlanDetail, MealPlanInput, MealPlanSlotInput } from '#shared/types/meal-plan'

export function useMealPlans() {
  // See app/composables/useRecipes.ts — SSR $fetch needs the cookie
  // forwarded explicitly or these all 401.
  const headers = import.meta.server ? useRequestHeaders(['cookie']) : undefined

  const listMealPlans = () => apiFetch<MealPlan[]>('/api/meal-plans', { headers })
  const getMealPlan = (id: number) => apiFetch<MealPlanDetail>(`/api/meal-plans/${id}`, { headers })
  const createMealPlan = (input: MealPlanInput) =>
    apiFetch<MealPlan>('/api/meal-plans', { method: 'POST', body: input, headers })
  const updateMealPlan = (id: number, input: MealPlanInput) =>
    apiFetch<MealPlan>(`/api/meal-plans/${id}`, { method: 'PUT', body: input, headers })
  const deleteMealPlan = (id: number) => apiFetch(`/api/meal-plans/${id}`, { method: 'DELETE', headers })
  const setMealPlanSlot = (id: number, input: MealPlanSlotInput) =>
    apiFetch(`/api/meal-plans/${id}/slots`, { method: 'PUT', body: input, headers })
  const addMealPlanTrayRecipe = (id: number, recipeId: number) =>
    apiFetch<{ trayRecipeIds: number[] }>(`/api/meal-plans/${id}/tray`, {
      method: 'POST',
      body: { recipeId },
      headers,
    })
  const removeMealPlanTrayRecipe = (id: number, recipeId: number) =>
    apiFetch<{ trayRecipeIds: number[] }>(`/api/meal-plans/${id}/tray/${recipeId}`, { method: 'DELETE', headers })

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
