import { describe, expect, it } from 'vitest'
import { parseRecipeInput } from '../../../server/utils/validate'

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
