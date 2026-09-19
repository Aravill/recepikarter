import { MEAL_PLAN_MAX_DAYS, mealPlanDateRange } from '#shared/utils/meal-plan'
import { MEAL_TYPES } from '#shared/types/meal-plan'
import type { MealPlanInput, MealPlanSlotInput, MealType } from '#shared/types/meal-plan'
import { CATEGORIES, DIFFICULTIES } from '#shared/types/recipe'
import type { Category, Difficulty, RecipeInput } from '#shared/types/recipe'
import type { ShoppingListInput } from '#shared/types/shopping-list'

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/

export function parseRecipeInput(body: unknown): RecipeInput {
  const b = body as Record<string, unknown>

  if (typeof b?.name !== 'string' || !b.name.trim()) {
    throw createError({ statusCode: 400, statusMessage: 'name is required' })
  }
  if (typeof b.category !== 'string' || !CATEGORIES.includes(b.category as Category)) {
    throw createError({ statusCode: 400, statusMessage: 'invalid category' })
  }
  if (typeof b.cookTimeDifficulty !== 'string' || !DIFFICULTIES.includes(b.cookTimeDifficulty as Difficulty)) {
    throw createError({ statusCode: 400, statusMessage: 'invalid cookTimeDifficulty' })
  }
  const cookTime = Number(b.cookTime)
  if (!Number.isFinite(cookTime) || cookTime < 0) {
    throw createError({ statusCode: 400, statusMessage: 'invalid cookTime' })
  }

  return {
    name: b.name.trim(),
    category: b.category as RecipeInput['category'],
    cookTime,
    cookTimeDifficulty: b.cookTimeDifficulty as RecipeInput['cookTimeDifficulty'],
    servings: typeof b.servings === 'string' ? b.servings : '',
    ingredients: Array.isArray(b.ingredients) ? b.ingredients.filter((i) => typeof i === 'string' && i.trim()) : [],
    steps: Array.isArray(b.steps) ? b.steps.filter((s) => typeof s === 'string' && s.trim()) : [],
    tags: Array.isArray(b.tags) ? b.tags.filter((t) => typeof t === 'string' && t.trim()) : [],
  }
}

// POST /api/shopping-lists — a name plus the recipe ids to aggregate
// server-side into the saved snapshot.
export function parseShoppingListInput(body: unknown): ShoppingListInput {
  const b = body as Record<string, unknown>

  if (typeof b?.name !== 'string' || !b.name.trim()) {
    throw createError({ statusCode: 400, statusMessage: 'name is required' })
  }

  // mealPlanId takes precedence when present — the two sources are mutually
  // exclusive (see ShoppingListInput), and a plan id is unambiguous on its
  // own, so a stray recipeIds alongside it is just ignored rather than
  // rejected. `!= null` (not `!== undefined`) so an explicit `mealPlanId:
  // null` — meaning "no plan" — falls through to the recipeIds branch below
  // instead of being coerced to 0 and rejected as an invalid id.
  if (b.mealPlanId != null) {
    const mealPlanId = Number(b.mealPlanId)
    if (!Number.isInteger(mealPlanId) || mealPlanId <= 0) {
      throw createError({ statusCode: 400, statusMessage: 'mealPlanId must be a valid id' })
    }
    return { name: b.name.trim(), mealPlanId }
  }

  if (!Array.isArray(b.recipeIds) || !b.recipeIds.length) {
    throw createError({ statusCode: 400, statusMessage: 'recipeIds or mealPlanId is required' })
  }
  const recipeIds = b.recipeIds.map(Number).filter((n) => Number.isInteger(n) && n > 0)
  if (!recipeIds.length) {
    throw createError({ statusCode: 400, statusMessage: 'recipeIds must contain valid ids' })
  }

  return { name: b.name.trim(), recipeIds }
}

// PATCH /api/shopping-lists/:id — rename and/or toggle the shared flag,
// owner-only (enforced by the route, not here). Either field may be
// omitted, but at least one must be present.
export function parseShoppingListPatch(body: unknown): { name?: string; shared?: boolean } {
  const b = body as Record<string, unknown>
  const patch: { name?: string; shared?: boolean } = {}

  if (b?.name !== undefined) {
    if (typeof b.name !== 'string' || !b.name.trim()) {
      throw createError({ statusCode: 400, statusMessage: 'invalid name' })
    }
    patch.name = b.name.trim()
  }
  if (b?.shared !== undefined) {
    if (typeof b.shared !== 'boolean') {
      throw createError({ statusCode: 400, statusMessage: 'invalid shared' })
    }
    patch.shared = b.shared
  }
  if (patch.name === undefined && patch.shared === undefined) {
    throw createError({ statusCode: 400, statusMessage: 'nothing to update' })
  }

  return patch
}

// PATCH /api/shopping-lists/:id/item — a targeted single-item checked
// update, keyed by the item's stable `key` (see
// shared/utils/ingredient-parser.ts), not a full-list overwrite.
export function parseShoppingListItemPatch(body: unknown): { key: string; checked: boolean } {
  const b = body as Record<string, unknown>

  if (typeof b?.key !== 'string' || !b.key) {
    throw createError({ statusCode: 400, statusMessage: 'key is required' })
  }
  if (typeof b.checked !== 'boolean') {
    throw createError({ statusCode: 400, statusMessage: 'checked must be a boolean' })
  }

  return { key: b.key, checked: b.checked }
}

// POST /api/meal-plans and PUT /api/meal-plans/:id — name, an inclusive
// date range, and how many people a filled slot feeds. Range length is
// capped (see MEAL_PLAN_MAX_DAYS) so a typo'd year doesn't try to generate
// thousands of slot rows in syncMealPlanSlots.
export function parseMealPlanInput(body: unknown): MealPlanInput {
  const b = body as Record<string, unknown>

  if (typeof b?.name !== 'string' || !b.name.trim()) {
    throw createError({ statusCode: 400, statusMessage: 'name is required' })
  }
  if (typeof b.dateStart !== 'string' || !DATE_RE.test(b.dateStart)) {
    throw createError({ statusCode: 400, statusMessage: 'invalid dateStart' })
  }
  if (typeof b.dateEnd !== 'string' || !DATE_RE.test(b.dateEnd)) {
    throw createError({ statusCode: 400, statusMessage: 'invalid dateEnd' })
  }
  const dates = mealPlanDateRange(b.dateStart, b.dateEnd)
  if (!dates.length) {
    throw createError({ statusCode: 400, statusMessage: 'dateEnd must not be before dateStart' })
  }
  if (dates.length > MEAL_PLAN_MAX_DAYS) {
    throw createError({ statusCode: 400, statusMessage: `date range must not exceed ${MEAL_PLAN_MAX_DAYS} days` })
  }
  const peopleCount = Number(b.peopleCount)
  if (!Number.isInteger(peopleCount) || peopleCount < 1) {
    throw createError({ statusCode: 400, statusMessage: 'invalid peopleCount' })
  }

  return { name: b.name.trim(), dateStart: b.dateStart, dateEnd: b.dateEnd, peopleCount }
}

// PUT /api/meal-plans/:id/slots — sets one slot's recipe/skip state. The
// route checks the date falls within the plan's own range; this only
// validates shape.
export function parseMealPlanSlotInput(body: unknown): MealPlanSlotInput {
  const b = body as Record<string, unknown>

  if (typeof b?.date !== 'string' || !DATE_RE.test(b.date)) {
    throw createError({ statusCode: 400, statusMessage: 'invalid date' })
  }
  if (typeof b.mealType !== 'string' || !MEAL_TYPES.includes(b.mealType as MealType)) {
    throw createError({ statusCode: 400, statusMessage: 'invalid mealType' })
  }
  if (b.recipeId !== null && !(Number.isInteger(b.recipeId) && (b.recipeId as number) > 0)) {
    throw createError({ statusCode: 400, statusMessage: 'invalid recipeId' })
  }
  if (typeof b.isSkip !== 'boolean') {
    throw createError({ statusCode: 400, statusMessage: 'isSkip must be a boolean' })
  }
  if (b.isSkip && b.recipeId !== null) {
    throw createError({ statusCode: 400, statusMessage: 'a skipped slot cannot also have a recipe' })
  }

  return { date: b.date, mealType: b.mealType as MealType, recipeId: b.recipeId as number | null, isSkip: b.isSkip }
}

// POST /api/meal-plans/:id/tray — add a recipe to the plan's tray.
export function parseMealPlanTrayInput(body: unknown): { recipeId: number } {
  const b = body as Record<string, unknown>

  if (!(Number.isInteger(b?.recipeId) && (b.recipeId as number) > 0)) {
    throw createError({ statusCode: 400, statusMessage: 'invalid recipeId' })
  }

  return { recipeId: b.recipeId as number }
}
