import { CATEGORIES, DIFFICULTIES } from '#shared/types/recipe'
import type { Category, Difficulty, RecipeInput } from '#shared/types/recipe'
import type { ShoppingListInput } from '#shared/types/shopping-list'

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
  if (!Array.isArray(b.recipeIds) || !b.recipeIds.length) {
    throw createError({ statusCode: 400, statusMessage: 'recipeIds is required' })
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
