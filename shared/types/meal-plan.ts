export const MEAL_TYPES = ['breakfast', 'lunch', 'dinner'] as const

export type MealType = (typeof MEAL_TYPES)[number]

// Stored values stay stable English enum keys, same split as
// CATEGORY_LABELS/DIFFICULTY_LABELS in recipe.ts — the UI is Czech, the data
// model isn't locale-bound.
export const MEAL_TYPE_LABELS: Record<MealType, string> = {
  breakfast: 'Snídaně',
  lunch: 'Oběd',
  dinner: 'Večeře',
}

export interface MealPlan {
  id: number
  name: string
  // Plain 'YYYY-MM-DD' strings (no time/timezone component) — a meal plan
  // covers whole calendar days, and lexicographic string comparison is
  // enough to sort/compare them.
  dateStart: string
  dateEnd: string
  peopleCount: number
  createdAt: string
  updatedAt: string
}

export type MealPlanInput = Omit<MealPlan, 'id' | 'createdAt' | 'updatedAt'>

// One row per date+mealType+plan — see server/utils/db.ts's syncMealPlanSlots.
// Rows for every date in the plan's range always exist (created on plan
// create/update), so an "empty" slot is a real row with recipeId null and
// isSkip false, not a missing one.
export interface MealPlanSlot {
  id: number
  planId: number
  date: string
  mealType: MealType
  recipeId: number | null
  isSkip: boolean
}

// What PUT /api/meal-plans/:id/slots takes to set one slot's state in one
// call — assigning a recipe, marking skip, or clearing both (recipeId null
// and isSkip false) are all just different values of the same shape.
export interface MealPlanSlotInput {
  date: string
  mealType: MealType
  recipeId: number | null
  isSkip: boolean
}

// GET /api/meal-plans/:id — the plan plus everything the planning page
// needs to render the grid and tray. trayRecipeIds is just the manually
// added-to-tray recipe ids (see meal_plan_recipes in db.ts); the page
// resolves them against the already-fetched full recipe list rather than
// this response duplicating recipe data.
export interface MealPlanDetail {
  plan: MealPlan
  slots: MealPlanSlot[]
  trayRecipeIds: number[]
}

export function emptyMealPlanInput(): MealPlanInput {
  const today = new Date().toISOString().slice(0, 10)
  return {
    name: '',
    dateStart: today,
    dateEnd: today,
    peopleCount: 2,
  }
}
