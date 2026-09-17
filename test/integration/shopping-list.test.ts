import { beforeEach, describe, expect, it } from 'vitest'
import { createRecipe, deleteRecipe, listRecipes } from '../../server/utils/db'
import { aggregateIngredients } from '../../shared/utils/ingredient-parser'
import type { RecipeInput } from '../../shared/types/recipe'

// Exercises the full path a real shopping list takes: recipes round-trip
// through the SQLite JSON column (server/utils/db.ts) exactly as GET
// /api/recipes would return them, then get combined by the same shared
// aggregator app/pages/shopping-list.vue calls — as opposed to
// test/shared/utils/ingredient-parser.test.ts, which only ever hands it
// hand-built objects.

function sampleInput(overrides: Partial<RecipeInput> = {}): RecipeInput {
  return {
    name: 'Recept',
    category: 'Main Course',
    cookTime: 30,
    cookTimeDifficulty: 'Easy',
    servings: '4',
    ingredients: [],
    steps: ['Uvařit.'],
    tags: [],
    ...overrides,
  }
}

beforeEach(() => {
  for (const recipe of listRecipes()) deleteRecipe(recipe.id)
})

describe('shopping list integration', () => {
  it('combines ingredients from several stored recipes into one shopping list', () => {
    createRecipe(
      sampleInput({
        name: 'Rajčatová polévka',
        ingredients: ['100g rajčatový protlak', '1 cibule', 'sůl podle chuti'],
      }),
      'michal',
    )
    createRecipe(
      sampleInput({
        name: 'Boloňská omáčka',
        ingredients: ['300g rajčatový protlak', '2 lžíce olivového oleje', 'sůl podle chuti'],
      }),
      'michal',
    )
    createRecipe(
      sampleInput({ name: 'Protlak na pizzu', ingredients: ['1kg rajčatový protlak', '1 cibule'] }),
      'michal',
    )

    const result = aggregateIngredients(listRecipes())

    const protlak = result.find((r) => r.name === 'rajčatový protlak')
    expect(protlak?.kind).toBe('mass')
    expect(protlak?.displayQuantity).toBe('1.4 kg')
    expect(protlak?.sources.map((s) => s.recipeName).sort()).toEqual([
      'Boloňská omáčka',
      'Protlak na pizzu',
      'Rajčatová polévka',
    ])

    const cibule = result.find((r) => r.name === 'cibule')
    expect(cibule?.displayQuantity).toBe('2 cibule')

    const oil = result.find((r) => r.name === 'olivového oleje')
    expect(oil?.displayQuantity).toBe('2 lžíce olivového oleje')

    const salt = result.find((r) => r.name === 'sůl podle chuti')
    expect(salt?.displayQuantity).toBeNull()
    expect(salt?.sources).toHaveLength(2)
  })

  it('only combines the recipes actually passed in, not every recipe in the database', () => {
    const a = createRecipe(sampleInput({ name: 'A', ingredients: ['100g mouky'] }), 'michal')
    createRecipe(sampleInput({ name: 'B', ingredients: ['300g mouky'] }), 'michal')

    const selected = listRecipes().filter((r) => r.id === a.id)
    const result = aggregateIngredients(selected)

    expect(result).toEqual([expect.objectContaining({ name: 'mouky', displayQuantity: '100 g' })])
  })
})
