import { describe, expect, it } from 'vitest'
import {
  aggregateIngredients,
  formatQuantity,
  normalizeIngredientName,
  parseIngredientLine,
} from '../../../shared/utils/ingredient-parser'

describe('parseIngredientLine', () => {
  it('parses a mass amount with no space before the unit', () => {
    expect(parseIngredientLine('400g mouky')).toEqual({
      raw: '400g mouky',
      amount: 400,
      unit: 'g',
      name: 'mouky',
      kind: 'mass',
      baseAmount: 400,
    })
  })

  it('parses a count-unit amount with a space', () => {
    expect(parseIngredientLine('2 lžíce hladké mouky')).toEqual({
      raw: '2 lžíce hladké mouky',
      amount: 2,
      unit: 'lžíce',
      name: 'hladké mouky',
      kind: 'count',
      baseAmount: null,
    })
  })

  it('parses a Czech decimal comma into millilitres', () => {
    expect(parseIngredientLine('1,5 l vody')).toEqual({
      raw: '1,5 l vody',
      amount: 1.5,
      unit: 'l',
      name: 'vody',
      kind: 'volume',
      baseAmount: 1500,
    })
  })

  it('converts dkg to grams', () => {
    expect(parseIngredientLine('50 dkg mouky').baseAmount).toBe(500)
  })

  it('treats a bare number + noun as a countable item with no unit', () => {
    expect(parseIngredientLine('1 citron')).toEqual({
      raw: '1 citron',
      amount: 1,
      unit: null,
      name: 'citron',
      kind: 'count',
      baseAmount: null,
    })
  })

  it('falls back to "unknown" when there is no leading amount', () => {
    expect(parseIngredientLine('sůl podle chuti')).toEqual({
      raw: 'sůl podle chuti',
      amount: null,
      unit: null,
      name: 'sůl podle chuti',
      kind: 'unknown',
      baseAmount: null,
    })
  })

  it('takes the first value of a range', () => {
    const parsed = parseIngredientLine('2-3 stroužky česneku')
    expect(parsed.amount).toBe(2)
    expect(parsed.unit).toBe('stroužek')
    expect(parsed.name).toBe('česneku')
  })

  it('parses a simple fraction', () => {
    expect(parseIngredientLine('1/2 kg mouky').baseAmount).toBe(500)
  })

  it('recognises less common Czech case endings', () => {
    expect(parseIngredientLine('2 kilogramech brambor').unit).toBe('kg')
    expect(parseIngredientLine('3 lžícemi medu').unit).toBe('lžíce')
  })

  it('falls back to the whole remainder as the name when nothing follows the unit', () => {
    const parsed = parseIngredientLine('400 g')
    expect(parsed.name).toBe('g')
    expect(parsed.unit).toBeNull()
    expect(parsed.kind).toBe('count')
  })
})

describe('normalizeIngredientName', () => {
  it('lowercases, trims, collapses whitespace and strips trailing punctuation', () => {
    expect(normalizeIngredientName('  Hladké   mouky. ')).toBe('hladké mouky')
  })
})

describe('formatQuantity', () => {
  it('stays in grams under 1000', () => {
    expect(formatQuantity(400, 'mass')).toBe('400 g')
  })

  it('switches to kilograms at 1000 and above', () => {
    expect(formatQuantity(1000, 'mass')).toBe('1 kg')
    expect(formatQuantity(1400, 'mass')).toBe('1.4 kg')
  })

  it('does the same for millilitres/litres', () => {
    expect(formatQuantity(250, 'volume')).toBe('250 ml')
    expect(formatQuantity(1500, 'volume')).toBe('1.5 l')
  })
})

describe('aggregateIngredients', () => {
  it('combines the same ingredient across recipes, normalizing to kg', () => {
    const result = aggregateIngredients([
      { id: 1, name: 'Polévka', ingredients: ['100g tomato puree'] },
      { id: 2, name: 'Omáčka', ingredients: ['300g tomato puree'] },
      { id: 3, name: 'Protlak', ingredients: ['1kg tomato puree'] },
    ])

    expect(result).toHaveLength(1)
    expect(result[0]).toMatchObject({
      name: 'tomato puree',
      kind: 'mass',
      displayQuantity: '1.4 kg',
    })
    expect(result[0]!.sources).toEqual([
      { recipeId: 1, recipeName: 'Polévka', raw: '100g tomato puree' },
      { recipeId: 2, recipeName: 'Omáčka', raw: '300g tomato puree' },
      { recipeId: 3, recipeName: 'Protlak', raw: '1kg tomato puree' },
    ])
  })

  it('keeps different ingredients separate', () => {
    const result = aggregateIngredients([{ id: 1, name: 'Recept', ingredients: ['100 g mouky', '100 g cukru'] }])
    expect(result).toHaveLength(2)
  })

  it('sums bare-noun counts', () => {
    const result = aggregateIngredients([
      { id: 1, name: 'A', ingredients: ['1 citron'] },
      { id: 2, name: 'B', ingredients: ['2 citron'] },
    ])
    expect(result).toEqual([
      {
        key: 'text:citron:',
        name: 'citron',
        kind: 'count',
        displayQuantity: '3 citron',
        sources: [
          { recipeId: 1, recipeName: 'A', raw: '1 citron' },
          { recipeId: 2, recipeName: 'B', raw: '2 citron' },
        ],
      },
    ])
  })

  it('combines the same ingredient whether or not it carries an amount, without a false total', () => {
    const result = aggregateIngredients([
      { id: 1, name: 'A', ingredients: ['sůl'] },
      { id: 2, name: 'B', ingredients: ['1 sůl'] },
    ])

    expect(result).toHaveLength(1)
    expect(result[0]).toMatchObject({ name: 'sůl', kind: 'unknown', displayQuantity: null })
    expect(result[0]!.sources).toHaveLength(2)
  })

  it('never numerically combines unparsed lines, but groups identical text', () => {
    const result = aggregateIngredients([
      { id: 1, name: 'A', ingredients: ['sůl podle chuti'] },
      { id: 2, name: 'B', ingredients: ['Sůl podle chuti'] },
      { id: 3, name: 'C', ingredients: ['pepř'] },
    ])

    const salt = result.find((r) => r.name === 'sůl podle chuti')!
    expect(salt.displayQuantity).toBeNull()
    expect(salt.sources).toHaveLength(2)

    const pepper = result.find((r) => r.name === 'pepř')!
    expect(pepper.sources).toHaveLength(1)
  })

  it('skips blank ingredient lines', () => {
    expect(aggregateIngredients([{ id: 1, name: 'A', ingredients: ['', '  ', '100 g mouky'] }])).toHaveLength(1)
  })
})
