import { normalizeRecipeName } from '#shared/utils/recipe-name'
import type { Recipe } from '#shared/types/recipe'

interface ImportSkip {
  name: string
  reason: string
}

// Accepts the same array-of-recipes shape produced by the JSON export (see
// app/utils/exportCard.ts) — an array so a future multi-recipe export file
// can go through the same endpoint. Each entry is validated and created
// independently; one invalid or duplicate-named entry doesn't fail the rest
// of the batch.
export default defineEventHandler(async (event) => {
  const body = await readBody(event)
  if (!Array.isArray(body) || body.length === 0) {
    throw createError({ statusCode: 400, statusMessage: 'expected a non-empty array of recipes' })
  }

  const created: Recipe[] = []
  const skipped: ImportSkip[] = []
  const seenInBatch = new Set<string>()

  for (const raw of body) {
    const rawName = typeof (raw as { name?: unknown })?.name === 'string' ? (raw as { name: string }).name : '(bez názvu)'

    let input
    try {
      input = parseRecipeInput(raw)
    } catch (e) {
      skipped.push({ name: rawName, reason: e instanceof Error ? e.message : 'invalid recipe' })
      continue
    }

    const key = normalizeRecipeName(input.name)
    if (seenInBatch.has(key) || findRecipeByNormalizedName(input.name)) {
      skipped.push({ name: input.name, reason: 'recipe with this name already exists' })
      continue
    }

    seenInBatch.add(key)
    created.push(createRecipe(input))
  }

  return { created, skipped }
})
