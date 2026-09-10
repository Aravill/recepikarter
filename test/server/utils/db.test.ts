import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createRecipe, deleteRecipe, getRecipe, listRecipes, markExported, updateRecipe } from '../../../server/utils/db'
import type { RecipeInput } from '../../../shared/types/recipe'

function sampleInput(overrides: Partial<RecipeInput> = {}): RecipeInput {
  return {
    name: 'Guláš',
    category: 'Main Course',
    cookTime: 90,
    cookTimeDifficulty: 'Medium',
    servings: '4',
    ingredients: ['beef', 'onion'],
    steps: ['Brown the meat', 'Simmer for an hour'],
    tags: ['czech'],
    ...overrides,
  }
}

beforeEach(() => {
  for (const recipe of listRecipes()) deleteRecipe(recipe.id)
})

describe('recipes db', () => {
  it('creates and fetches a recipe by id', () => {
    const created = createRecipe(sampleInput())

    expect(created.id).toBeTypeOf('number')
    expect(created.lastExportedAt).toBeNull()
    expect(getRecipe(created.id)).toEqual(created)
  })

  it('records when a recipe was last exported', () => {
    const created = createRecipe(sampleInput())
    expect(created.lastExportedAt).toBeNull()

    const exported = markExported(created.id)

    expect(exported?.lastExportedAt).toBeTypeOf('string')
    expect(getRecipe(created.id)?.lastExportedAt).toBe(exported?.lastExportedAt)
  })

  it('returns undefined when marking a recipe that does not exist as exported', () => {
    expect(markExported(999999)).toBeUndefined()
  })

  it('lists recipes newest-updated first', () => {
    // updated_at has only millisecond precision, so force the two creates
    // into different milliseconds instead of relying on real elapsed time.
    vi.useFakeTimers()
    try {
      vi.setSystemTime(0)
      const first = createRecipe(sampleInput({ name: 'První' }))
      vi.setSystemTime(1)
      const second = createRecipe(sampleInput({ name: 'Druhý' }))

      const listed = listRecipes()
      expect(listed.map((r) => r.id)).toEqual([second.id, first.id])
    } finally {
      vi.useRealTimers()
    }
  })

  it('updates a recipe in place', () => {
    const created = createRecipe(sampleInput())

    const updated = updateRecipe(created.id, sampleInput({ name: 'Nový název', servings: '6' }))

    expect(updated?.name).toBe('Nový název')
    expect(updated?.servings).toBe('6')
    expect(updated?.id).toBe(created.id)
  })

  it('returns undefined when updating a recipe that does not exist', () => {
    expect(updateRecipe(999999, sampleInput())).toBeUndefined()
  })

  it('deletes a recipe', () => {
    const created = createRecipe(sampleInput())

    expect(deleteRecipe(created.id)).toBe(true)
    expect(getRecipe(created.id)).toBeUndefined()
  })

  it('returns false when deleting a recipe that does not exist', () => {
    expect(deleteRecipe(999999)).toBe(false)
  })
})
