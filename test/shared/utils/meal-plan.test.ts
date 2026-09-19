import { describe, expect, it } from 'vitest'
import {
  mealPlanBadgeState,
  mealPlanColorIndex,
  mealPlanDateRange,
  mealPlanMissingCount,
  mealPlanShoppingEntries,
  parseServingsCount,
  remainingPortions,
} from '../../../shared/utils/meal-plan'
import type { MealPlanSlot } from '../../../shared/types/meal-plan'
import type { Recipe } from '../../../shared/types/recipe'

function sampleSlot(overrides: Partial<MealPlanSlot> = {}): MealPlanSlot {
  return {
    id: 1,
    planId: 1,
    date: '2026-01-01',
    mealType: 'lunch',
    recipeId: null,
    isSkip: false,
    ...overrides,
  }
}

function sampleRecipe(overrides: Partial<Recipe> = {}): Recipe {
  return {
    id: 1,
    name: 'Guláš',
    category: 'Main Course',
    cookTime: 90,
    cookTimeDifficulty: 'Medium',
    servings: '4',
    ingredients: [],
    steps: [],
    tags: [],
    createdAt: '',
    updatedAt: '',
    author: 'michal',
    lastExportedAt: null,
    photoFile: null,
    ...overrides,
  }
}

describe('mealPlanDateRange', () => {
  it('lists every date inclusive of both ends', () => {
    expect(mealPlanDateRange('2026-01-01', '2026-01-03')).toEqual(['2026-01-01', '2026-01-02', '2026-01-03'])
  })

  it('returns a single date when start equals end', () => {
    expect(mealPlanDateRange('2026-01-01', '2026-01-01')).toEqual(['2026-01-01'])
  })

  it('returns an empty list when the range is inverted', () => {
    expect(mealPlanDateRange('2026-01-05', '2026-01-01')).toEqual([])
  })

  it('returns an empty list for an unparseable date', () => {
    expect(mealPlanDateRange('not-a-date', '2026-01-01')).toEqual([])
  })

  it('crosses a month boundary correctly', () => {
    expect(mealPlanDateRange('2026-01-30', '2026-02-02')).toEqual([
      '2026-01-30',
      '2026-01-31',
      '2026-02-01',
      '2026-02-02',
    ])
  })
})

describe('parseServingsCount', () => {
  it('parses a plain number', () => {
    expect(parseServingsCount('4')).toBe(4)
  })

  it('takes the leading number out of a range', () => {
    expect(parseServingsCount('4-6')).toBe(4)
  })

  it('returns null for empty or non-numeric text', () => {
    expect(parseServingsCount('')).toBeNull()
    expect(parseServingsCount('podle chuti')).toBeNull()
  })
})

describe('remainingPortions', () => {
  it('subtracts people_count for every slot using the recipe', () => {
    const recipe = sampleRecipe({ id: 5, servings: '10' })
    const slots = [
      sampleSlot({ recipeId: 5 }),
      sampleSlot({ recipeId: 5, mealType: 'dinner' }),
      sampleSlot({ recipeId: 9 }),
    ]
    expect(remainingPortions(recipe, { peopleCount: 3 }, slots)).toBe(10 - 3 * 2)
  })

  it('returns null (unknown/unlimited) when servings is not a number', () => {
    const recipe = sampleRecipe({ servings: '' })
    expect(remainingPortions(recipe, { peopleCount: 2 }, [])).toBeNull()
  })
})

describe('mealPlanBadgeState', () => {
  it('is normal when unknown (null)', () => {
    expect(mealPlanBadgeState(null, 4)).toBe('normal')
  })

  it('is normal when enough remains for a full slot', () => {
    expect(mealPlanBadgeState(4, 4)).toBe('normal')
    expect(mealPlanBadgeState(6, 4)).toBe('normal')
  })

  it('is leftover when something remains but not a full slot', () => {
    expect(mealPlanBadgeState(1, 4)).toBe('leftover')
  })

  it('is depleted at zero or below', () => {
    expect(mealPlanBadgeState(0, 4)).toBe('depleted')
    expect(mealPlanBadgeState(-2, 4)).toBe('depleted')
  })
})

describe('mealPlanMissingCount', () => {
  it('counts only non-skip, unfilled slots, in both slots and portions', () => {
    const slots = [
      sampleSlot({ recipeId: null, isSkip: false }),
      sampleSlot({ recipeId: null, isSkip: false, mealType: 'dinner' }),
      sampleSlot({ recipeId: null, isSkip: true, mealType: 'breakfast' }),
      sampleSlot({ recipeId: 3, isSkip: false, date: '2026-01-02' }),
    ]
    expect(mealPlanMissingCount(slots, 4)).toEqual({ slots: 2, portions: 8 })
  })

  it('is zero when every slot is filled or skipped', () => {
    const slots = [sampleSlot({ isSkip: true }), sampleSlot({ recipeId: 1, mealType: 'dinner' })]
    expect(mealPlanMissingCount(slots, 4)).toEqual({ slots: 0, portions: 0 })
  })
})

describe('mealPlanShoppingEntries', () => {
  it('includes a recipe used across several slots exactly once, not multiplied', () => {
    const recipe = sampleRecipe({ id: 1, name: 'Guláš', servings: '4', ingredients: ['400 g hovězího'] })
    const slots = [
      sampleSlot({ recipeId: 1, mealType: 'lunch' }),
      sampleSlot({ recipeId: 1, mealType: 'dinner' }),
    ]
    expect(mealPlanShoppingEntries(slots, [recipe])).toEqual([recipe])
  })

  it('does not scale by peopleCount vs. servings at all', () => {
    const recipe = sampleRecipe({ id: 1, servings: '2', ingredients: ['1 bageta'] })
    const slots = [sampleSlot({ recipeId: 1 })]
    expect(mealPlanShoppingEntries(slots, [recipe])).toEqual([recipe])
  })

  it('ignores skip slots and empty slots', () => {
    const recipe = sampleRecipe({ id: 1 })
    const slots = [
      sampleSlot({ recipeId: null, isSkip: true }),
      sampleSlot({ recipeId: null, isSkip: false, mealType: 'dinner' }),
    ]
    expect(mealPlanShoppingEntries(slots, [recipe])).toEqual([])
  })

  it('skips a slot whose recipe has since been deleted', () => {
    const slots = [sampleSlot({ recipeId: 99 })]
    expect(mealPlanShoppingEntries(slots, [])).toEqual([])
  })

  it('produces one entry per distinct recipe, even across different meal types/dates', () => {
    const a = sampleRecipe({ id: 1, name: 'A' })
    const b = sampleRecipe({ id: 2, name: 'B' })
    const slots = [
      sampleSlot({ recipeId: 1, mealType: 'breakfast' }),
      sampleSlot({ recipeId: 2, mealType: 'lunch' }),
      sampleSlot({ recipeId: 1, mealType: 'dinner', date: '2026-01-02' }),
    ]
    const result = mealPlanShoppingEntries(slots, [a, b])
    expect(result.map((r) => r.id).sort()).toEqual([1, 2])
  })
})

describe('mealPlanColorIndex', () => {
  it('is stable for the same recipe id', () => {
    expect(mealPlanColorIndex(42)).toBe(mealPlanColorIndex(42))
  })

  it('stays within the palette bounds for a range of ids, including 0', () => {
    for (let id = 0; id < 50; id++) {
      const idx = mealPlanColorIndex(id)
      expect(idx).toBeGreaterThanOrEqual(0)
      expect(idx).toBeLessThan(8)
    }
  })
})
