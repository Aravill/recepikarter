import { describe, expect, it } from 'vitest'
import {
  parseMealPlanInput,
  parseMealPlanSlotInput,
  parseMealPlanTrayInput,
  parseRecipeInput,
  parseShoppingListInput,
  parseShoppingListItemPatch,
  parseShoppingListPatch,
} from '../../../server/utils/validate'

describe('parseRecipeInput', () => {
  it('parses a valid recipe, trimming names and dropping blank list entries', () => {
    const result = parseRecipeInput({
      name: '  Guláš  ',
      category: 'Main Course',
      cookTime: '90',
      cookTimeDifficulty: 'Medium',
      servings: '4',
      ingredients: ['beef', '  ', 'onion'],
      steps: ['Brown the meat', ''],
      tags: ['czech', ''],
    })

    expect(result).toEqual({
      name: 'Guláš',
      category: 'Main Course',
      cookTime: 90,
      cookTimeDifficulty: 'Medium',
      servings: '4',
      ingredients: ['beef', 'onion'],
      steps: ['Brown the meat'],
      tags: ['czech'],
    })
  })

  it('rejects a missing name', () => {
    expect(() =>
      parseRecipeInput({ category: 'Main Course', cookTimeDifficulty: 'Easy', cookTime: 10 }),
    ).toThrow('name is required')
  })

  it('rejects an invalid category', () => {
    expect(() =>
      parseRecipeInput({ name: 'Test', category: 'Dessert', cookTimeDifficulty: 'Easy', cookTime: 10 }),
    ).toThrow('invalid category')
  })

  it('rejects an invalid difficulty', () => {
    expect(() =>
      parseRecipeInput({ name: 'Test', category: 'Soup', cookTimeDifficulty: 'Extreme', cookTime: 10 }),
    ).toThrow('invalid cookTimeDifficulty')
  })

  it('rejects a negative cook time', () => {
    expect(() =>
      parseRecipeInput({ name: 'Test', category: 'Soup', cookTimeDifficulty: 'Easy', cookTime: -5 }),
    ).toThrow('invalid cookTime')
  })
})

describe('parseShoppingListInput', () => {
  it('parses a valid input, trimming the name and coercing ids to numbers', () => {
    expect(parseShoppingListInput({ name: '  Víkendový nákup  ', recipeIds: ['1', 2, '3'] })).toEqual({
      name: 'Víkendový nákup',
      recipeIds: [1, 2, 3],
    })
  })

  it('rejects a missing name', () => {
    expect(() => parseShoppingListInput({ recipeIds: [1] })).toThrow('name is required')
  })

  it('rejects missing recipeIds', () => {
    expect(() => parseShoppingListInput({ name: 'Nákup' })).toThrow('recipeIds is required')
  })

  it('rejects recipeIds with no valid ids', () => {
    expect(() => parseShoppingListInput({ name: 'Nákup', recipeIds: ['x', -1, 0] })).toThrow(
      'recipeIds must contain valid ids',
    )
  })

  it('drops invalid ids but keeps the valid ones', () => {
    expect(parseShoppingListInput({ name: 'Nákup', recipeIds: [1, 'x', -1] })).toEqual({
      name: 'Nákup',
      recipeIds: [1],
    })
  })
})

describe('parseShoppingListPatch', () => {
  it('parses a rename', () => {
    expect(parseShoppingListPatch({ name: '  Nový název  ' })).toEqual({ name: 'Nový název' })
  })

  it('parses a shared toggle', () => {
    expect(parseShoppingListPatch({ shared: true })).toEqual({ shared: true })
  })

  it('parses both together', () => {
    expect(parseShoppingListPatch({ name: 'X', shared: false })).toEqual({ name: 'X', shared: false })
  })

  it('rejects an empty patch', () => {
    expect(() => parseShoppingListPatch({})).toThrow('nothing to update')
  })

  it('rejects a blank name', () => {
    expect(() => parseShoppingListPatch({ name: '   ' })).toThrow('invalid name')
  })

  it('rejects a non-boolean shared value', () => {
    expect(() => parseShoppingListPatch({ shared: 'yes' })).toThrow('invalid shared')
  })
})

describe('parseShoppingListItemPatch', () => {
  it('parses a valid item patch', () => {
    expect(parseShoppingListItemPatch({ key: 'mass:mouky', checked: true })).toEqual({
      key: 'mass:mouky',
      checked: true,
    })
  })

  it('rejects a missing key', () => {
    expect(() => parseShoppingListItemPatch({ checked: true })).toThrow('key is required')
  })

  it('rejects a non-boolean checked value', () => {
    expect(() => parseShoppingListItemPatch({ key: 'a', checked: 'true' })).toThrow('checked must be a boolean')
  })
})

describe('parseMealPlanInput', () => {
  it('parses a valid input, trimming the name', () => {
    expect(
      parseMealPlanInput({ name: '  Týden  ', dateStart: '2026-01-05', dateEnd: '2026-01-07', peopleCount: '3' }),
    ).toEqual({ name: 'Týden', dateStart: '2026-01-05', dateEnd: '2026-01-07', peopleCount: 3 })
  })

  it('rejects a missing name', () => {
    expect(() =>
      parseMealPlanInput({ dateStart: '2026-01-05', dateEnd: '2026-01-07', peopleCount: 3 }),
    ).toThrow('name is required')
  })

  it('rejects a malformed date', () => {
    expect(() =>
      parseMealPlanInput({ name: 'X', dateStart: '5.1.2026', dateEnd: '2026-01-07', peopleCount: 3 }),
    ).toThrow('invalid dateStart')
  })

  it('rejects an inverted range', () => {
    expect(() =>
      parseMealPlanInput({ name: 'X', dateStart: '2026-01-07', dateEnd: '2026-01-05', peopleCount: 3 }),
    ).toThrow('dateEnd must not be before dateStart')
  })

  it('rejects a range longer than the max', () => {
    expect(() =>
      parseMealPlanInput({ name: 'X', dateStart: '2026-01-01', dateEnd: '2026-06-01', peopleCount: 3 }),
    ).toThrow(/date range must not exceed/)
  })

  it('rejects a non-positive peopleCount', () => {
    expect(() =>
      parseMealPlanInput({ name: 'X', dateStart: '2026-01-05', dateEnd: '2026-01-07', peopleCount: 0 }),
    ).toThrow('invalid peopleCount')
  })
})

describe('parseMealPlanSlotInput', () => {
  it('parses assigning a recipe', () => {
    expect(parseMealPlanSlotInput({ date: '2026-01-05', mealType: 'lunch', recipeId: 3, isSkip: false })).toEqual({
      date: '2026-01-05',
      mealType: 'lunch',
      recipeId: 3,
      isSkip: false,
    })
  })

  it('parses marking skip', () => {
    expect(parseMealPlanSlotInput({ date: '2026-01-05', mealType: 'lunch', recipeId: null, isSkip: true })).toEqual({
      date: '2026-01-05',
      mealType: 'lunch',
      recipeId: null,
      isSkip: true,
    })
  })

  it('parses clearing a slot', () => {
    expect(parseMealPlanSlotInput({ date: '2026-01-05', mealType: 'lunch', recipeId: null, isSkip: false })).toEqual({
      date: '2026-01-05',
      mealType: 'lunch',
      recipeId: null,
      isSkip: false,
    })
  })

  it('rejects an invalid mealType', () => {
    expect(() =>
      parseMealPlanSlotInput({ date: '2026-01-05', mealType: 'brunch', recipeId: null, isSkip: false }),
    ).toThrow('invalid mealType')
  })

  it('rejects a recipeId that is skip and assigned at once', () => {
    expect(() =>
      parseMealPlanSlotInput({ date: '2026-01-05', mealType: 'lunch', recipeId: 3, isSkip: true }),
    ).toThrow('a skipped slot cannot also have a recipe')
  })

  it('rejects a non-boolean isSkip', () => {
    expect(() =>
      parseMealPlanSlotInput({ date: '2026-01-05', mealType: 'lunch', recipeId: null, isSkip: 'yes' }),
    ).toThrow('isSkip must be a boolean')
  })
})

describe('parseMealPlanTrayInput', () => {
  it('parses a valid recipeId', () => {
    expect(parseMealPlanTrayInput({ recipeId: 5 })).toEqual({ recipeId: 5 })
  })

  it('rejects a missing recipeId', () => {
    expect(() => parseMealPlanTrayInput({})).toThrow('invalid recipeId')
  })

  it('rejects a non-positive recipeId', () => {
    expect(() => parseMealPlanTrayInput({ recipeId: 0 })).toThrow('invalid recipeId')
  })
})
