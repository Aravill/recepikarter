import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  createRecipe,
  createUser,
  deleteRecipe,
  findRecipeByNormalizedName,
  findUserRowByUsername,
  getRecipe,
  listRecipes,
  listUsers,
  markExported,
  setUserPassword,
  setUserStatus,
  updateRecipe,
} from '../../../server/utils/db'
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
    const created = createRecipe(sampleInput(), 'michal')

    expect(created.id).toBeTypeOf('number')
    expect(created.lastExportedAt).toBeNull()
    expect(created.author).toBe('michal')
    expect(getRecipe(created.id)).toEqual(created)
  })

  it('records when a recipe was last exported', () => {
    const created = createRecipe(sampleInput(), 'michal')
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
      const first = createRecipe(sampleInput({ name: 'První' }), 'michal')
      vi.setSystemTime(1)
      const second = createRecipe(sampleInput({ name: 'Druhý' }), 'michal')

      const listed = listRecipes()
      expect(listed.map((r) => r.id)).toEqual([second.id, first.id])
    } finally {
      vi.useRealTimers()
    }
  })

  it('updates a recipe in place without changing its author', () => {
    const created = createRecipe(sampleInput(), 'michal')

    const updated = updateRecipe(created.id, sampleInput({ name: 'Nový název', servings: '6' }))

    expect(updated?.name).toBe('Nový název')
    expect(updated?.servings).toBe('6')
    expect(updated?.id).toBe(created.id)
    expect(updated?.author).toBe('michal')
  })

  it('returns undefined when updating a recipe that does not exist', () => {
    expect(updateRecipe(999999, sampleInput())).toBeUndefined()
  })

  it('deletes a recipe', () => {
    const created = createRecipe(sampleInput(), 'michal')

    expect(deleteRecipe(created.id)).toBe(true)
    expect(getRecipe(created.id)).toBeUndefined()
  })

  it('returns false when deleting a recipe that does not exist', () => {
    expect(deleteRecipe(999999)).toBe(false)
  })

  it('finds a recipe by name regardless of case or diacritics', () => {
    const created = createRecipe(sampleInput({ name: 'Halušky' }), 'michal')

    expect(findRecipeByNormalizedName('halusky')?.id).toBe(created.id)
    expect(findRecipeByNormalizedName('HALUSKY')?.id).toBe(created.id)
    expect(findRecipeByNormalizedName('Halušky')?.id).toBe(created.id)
  })

  it('returns undefined when no recipe matches the name', () => {
    expect(findRecipeByNormalizedName('Nic Takového')).toBeUndefined()
  })
})

describe('users db', () => {
  it('creates a user with must-change-password set and active status', () => {
    const user = createUser('novak-1', 'hashed')

    expect(user.username).toBe('novak-1')
    expect(user.status).toBe('active')
    expect(user.mustChangePassword).toBe(true)
    expect(listUsers().map((u) => u.id)).toContain(user.id)
  })

  it('blocks and unblocks a user', () => {
    const user = createUser('novak-2', 'hashed')

    const blocked = setUserStatus(user.id, 'blocked')
    expect(blocked?.status).toBe('blocked')

    const unblocked = setUserStatus(user.id, 'active')
    expect(unblocked?.status).toBe('active')
  })

  it('updates the password hash and clears must-change-password', () => {
    const user = createUser('novak-3', 'hashed')

    setUserPassword(user.id, 'new-hash', false)

    const row = findUserRowByUsername('novak-3')
    expect(row?.password_hash).toBe('new-hash')
    expect(row?.must_change_password).toBe(0)
  })
})
