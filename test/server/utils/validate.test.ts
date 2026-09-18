import { describe, expect, it } from 'vitest'
import {
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
