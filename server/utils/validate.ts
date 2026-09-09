import { CATEGORIES, DIFFICULTIES } from '#shared/types/recipe'
import type { Category, Difficulty, RecipeInput } from '#shared/types/recipe'

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
