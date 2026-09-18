import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  addMealPlanTrayRecipe,
  createMealPlan,
  createRecipe,
  createShoppingList,
  createUser,
  deleteMealPlan,
  deleteRecipe,
  deleteShoppingList,
  findRecipeByNormalizedName,
  findUserRowByUsername,
  getMealPlan,
  getRecipe,
  getShoppingList,
  listMealPlanSlots,
  listMealPlanTrayRecipeIds,
  listMealPlans,
  listRecipes,
  listShoppingLists,
  listTags,
  listUsers,
  markExported,
  removeMealPlanTrayRecipe,
  resetShoppingListItems,
  setMealPlanSlot,
  setRecipePhoto,
  setShoppingListItemChecked,
  setUserPassword,
  setUserStatus,
  updateMealPlan,
  updateRecipe,
  updateShoppingListMeta,
} from '../../../server/utils/db'
import type { MealPlanInput } from '../../../shared/types/meal-plan'
import type { RecipeInput } from '../../../shared/types/recipe'
import type { ShoppingListItem } from '../../../shared/types/shopping-list'

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

function sampleMealPlanInput(overrides: Partial<MealPlanInput> = {}): MealPlanInput {
  return {
    name: 'Týdenní plán',
    dateStart: '2026-01-05',
    dateEnd: '2026-01-07',
    peopleCount: 3,
    ...overrides,
  }
}

beforeEach(() => {
  for (const recipe of listRecipes()) deleteRecipe(recipe.id)
  for (const list of listShoppingLists('michal')) deleteShoppingList(list.id)
  for (const plan of listMealPlans()) deleteMealPlan(plan.id)
})

function sampleItems(overrides: Partial<ShoppingListItem> = {}): ShoppingListItem[] {
  return [
    { key: 'mass:mouky', name: 'mouky', kind: 'mass', displayQuantity: '400 g', sources: [], checked: false, ...overrides },
  ]
}

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

  it('records and clears the photo file without touching it on update', () => {
    const created = createRecipe(sampleInput(), 'michal')
    expect(created.photoFile).toBeNull()

    expect(setRecipePhoto(created.id, '1-1700000000000.webp')?.photoFile).toBe('1-1700000000000.webp')
    expect(updateRecipe(created.id, sampleInput({ name: 'Guláš II' }))?.photoFile).toBe('1-1700000000000.webp')
    expect(setRecipePhoto(created.id, null)?.photoFile).toBeNull()
  })

  it('returns undefined when setting a photo on a recipe that does not exist', () => {
    expect(setRecipePhoto(999999, 'x.webp')).toBeUndefined()
  })

  it('lists distinct tags most-used first, merging case/diacritic variants', () => {
    createRecipe(sampleInput({ tags: ['svátek', 'rychlovka'] }), 'michal')
    createRecipe(sampleInput({ tags: ['Svatek', 'zdravé'] }), 'michal')
    createRecipe(sampleInput({ tags: ['svátek'] }), 'michal')
    createRecipe(sampleInput({ tags: [] }), 'michal')

    expect(listTags()).toEqual(['svátek', 'rychlovka', 'zdravé'])
  })

  it('lists no tags when there are no recipes', () => {
    expect(listTags()).toEqual([])
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

describe('shopping lists db', () => {
  it('creates a list, unshared and unchecked by default', () => {
    const list = createShoppingList('Víkendový nákup', 'michal', sampleItems())

    expect(list.name).toBe('Víkendový nákup')
    expect(list.ownerUsername).toBe('michal')
    expect(list.shared).toBe(false)
    expect(list.items).toEqual(sampleItems())
    expect(getShoppingList(list.id)).toEqual(list)
  })

  it('lists a user\'s own lists plus every shared list, but not someone else\'s private list', () => {
    const own = createShoppingList('Moje', 'michal', sampleItems())
    const othersPrivate = createShoppingList('Cizí soukromý', 'petr', sampleItems())
    const othersShared = createShoppingList('Cizí sdílený', 'petr', sampleItems())
    updateShoppingListMeta(othersShared.id, { shared: true })

    const seen = listShoppingLists('michal').map((l) => l.id)
    expect(seen).toContain(own.id)
    expect(seen).toContain(othersShared.id)
    expect(seen).not.toContain(othersPrivate.id)

    deleteShoppingList(othersPrivate.id)
  })

  it('renames and toggles the shared flag independently', () => {
    const list = createShoppingList('Původní název', 'michal', sampleItems())

    const renamed = updateShoppingListMeta(list.id, { name: 'Nový název' })
    expect(renamed?.name).toBe('Nový název')
    expect(renamed?.shared).toBe(false)

    const shared = updateShoppingListMeta(list.id, { shared: true })
    expect(shared?.name).toBe('Nový název')
    expect(shared?.shared).toBe(true)
  })

  it('returns undefined updating metadata on a list that does not exist', () => {
    expect(updateShoppingListMeta(999999, { name: 'x' })).toBeUndefined()
  })

  it('deletes a list', () => {
    const list = createShoppingList('Ke smazání', 'michal', sampleItems())

    expect(deleteShoppingList(list.id)).toBe(true)
    expect(getShoppingList(list.id)).toBeUndefined()
  })

  it('returns false deleting a list that does not exist', () => {
    expect(deleteShoppingList(999999)).toBe(false)
  })

  it('unticks every item on reset without touching the rest of the snapshot', () => {
    const list = createShoppingList('Nákup', 'michal', [
      ...sampleItems({ key: 'a', checked: true }),
      ...sampleItems({ key: 'b', name: 'vejce', checked: true }),
    ])

    const reset = resetShoppingListItems(list.id)

    expect(reset?.items.every((i) => !i.checked)).toBe(true)
    expect(reset?.items.map((i) => i.name)).toEqual(['mouky', 'vejce'])
  })

  it('toggles a single item by key without touching the others', () => {
    const list = createShoppingList('Nákup', 'michal', [
      ...sampleItems({ key: 'a' }),
      ...sampleItems({ key: 'b', name: 'vejce' }),
    ])

    const updated = setShoppingListItemChecked(list.id, 'a', true)

    expect(updated?.items.find((i) => i.key === 'a')?.checked).toBe(true)
    expect(updated?.items.find((i) => i.key === 'b')?.checked).toBe(false)
  })

  it('returns undefined toggling an item on a list that does not exist', () => {
    expect(setShoppingListItemChecked(999999, 'a', true)).toBeUndefined()
  })
})

describe('meal plans db', () => {
  it('creates a plan and pre-creates an empty slot row for every date × meal type in range', () => {
    const plan = createMealPlan(sampleMealPlanInput())

    expect(plan.name).toBe('Týdenní plán')
    expect(getMealPlan(plan.id)).toEqual(plan)

    const slots = listMealPlanSlots(plan.id)
    // 3 days × 3 meal types
    expect(slots).toHaveLength(9)
    expect(slots.every((s) => s.recipeId === null && s.isSkip === false)).toBe(true)
    expect(new Set(slots.map((s) => s.date))).toEqual(new Set(['2026-01-05', '2026-01-06', '2026-01-07']))
  })

  it('returns undefined fetching a plan that does not exist', () => {
    expect(getMealPlan(999999)).toBeUndefined()
  })

  it('lists plans newest date-start first', () => {
    const earlier = createMealPlan(sampleMealPlanInput({ dateStart: '2026-01-01', dateEnd: '2026-01-01' }))
    const later = createMealPlan(sampleMealPlanInput({ dateStart: '2026-02-01', dateEnd: '2026-02-01' }))

    expect(listMealPlans().map((p) => p.id)).toEqual([later.id, earlier.id])
  })

  it('sets a slot to a recipe, then clears it back to empty', () => {
    const plan = createMealPlan(sampleMealPlanInput())

    const filled = setMealPlanSlot(plan.id, { date: '2026-01-05', mealType: 'lunch', recipeId: 7, isSkip: false })
    expect(filled?.recipeId).toBe(7)
    expect(filled?.isSkip).toBe(false)

    const cleared = setMealPlanSlot(plan.id, { date: '2026-01-05', mealType: 'lunch', recipeId: null, isSkip: false })
    expect(cleared?.recipeId).toBeNull()
    expect(cleared?.isSkip).toBe(false)

    // Untouched slots stay as they were.
    expect(listMealPlanSlots(plan.id).filter((s) => s.recipeId !== null || s.isSkip)).toHaveLength(0)
  })

  it('sets a slot to skip', () => {
    const plan = createMealPlan(sampleMealPlanInput())

    const skipped = setMealPlanSlot(plan.id, { date: '2026-01-06', mealType: 'breakfast', recipeId: null, isSkip: true })

    expect(skipped?.isSkip).toBe(true)
    expect(skipped?.recipeId).toBeNull()
  })

  it('returns undefined setting a slot on a plan that does not exist', () => {
    expect(setMealPlanSlot(999999, { date: '2026-01-05', mealType: 'lunch', recipeId: 1, isSkip: false })).toBeUndefined()
  })

  it('re-syncs slots when the date range shrinks, dropping out-of-range assignments', () => {
    const plan = createMealPlan(sampleMealPlanInput())
    setMealPlanSlot(plan.id, { date: '2026-01-07', mealType: 'dinner', recipeId: 3, isSkip: false })

    const updated = updateMealPlan(plan.id, sampleMealPlanInput({ dateStart: '2026-01-05', dateEnd: '2026-01-06' }))

    expect(updated?.dateEnd).toBe('2026-01-06')
    const slots = listMealPlanSlots(plan.id)
    expect(slots).toHaveLength(6)
    expect(slots.some((s) => s.date === '2026-01-07')).toBe(false)
  })

  it('re-syncs slots when the date range grows, adding fresh empty rows', () => {
    const plan = createMealPlan(sampleMealPlanInput({ dateStart: '2026-01-05', dateEnd: '2026-01-05' }))
    setMealPlanSlot(plan.id, { date: '2026-01-05', mealType: 'lunch', recipeId: 3, isSkip: false })

    updateMealPlan(plan.id, sampleMealPlanInput({ dateStart: '2026-01-05', dateEnd: '2026-01-06' }))

    const slots = listMealPlanSlots(plan.id)
    expect(slots).toHaveLength(6)
    // The pre-existing assignment on the date that stayed in range survives the resync.
    expect(slots.find((s) => s.date === '2026-01-05' && s.mealType === 'lunch')?.recipeId).toBe(3)
  })

  it('returns undefined updating a plan that does not exist', () => {
    expect(updateMealPlan(999999, sampleMealPlanInput())).toBeUndefined()
  })

  it('deletes a plan along with its slots', () => {
    const plan = createMealPlan(sampleMealPlanInput())

    expect(deleteMealPlan(plan.id)).toBe(true)
    expect(getMealPlan(plan.id)).toBeUndefined()
    expect(listMealPlanSlots(plan.id)).toEqual([])
  })

  it('returns false deleting a plan that does not exist', () => {
    expect(deleteMealPlan(999999)).toBe(false)
  })

  it('adds and removes recipes from the tray without touching slot assignments', () => {
    const plan = createMealPlan(sampleMealPlanInput())
    addMealPlanTrayRecipe(plan.id, 1)
    addMealPlanTrayRecipe(plan.id, 2)
    // Adding the same recipe twice is a no-op, not a duplicate/error.
    addMealPlanTrayRecipe(plan.id, 1)
    setMealPlanSlot(plan.id, { date: '2026-01-05', mealType: 'lunch', recipeId: 1, isSkip: false })

    expect(listMealPlanTrayRecipeIds(plan.id)).toEqual([1, 2])

    removeMealPlanTrayRecipe(plan.id, 1)

    expect(listMealPlanTrayRecipeIds(plan.id)).toEqual([2])
    // The slot still points at recipe 1 — removing it from the tray only hides the badge.
    expect(listMealPlanSlots(plan.id).find((s) => s.mealType === 'lunch')?.recipeId).toBe(1)
  })
})
