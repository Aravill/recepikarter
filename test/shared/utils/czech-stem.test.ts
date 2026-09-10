import { describe, expect, it } from 'vitest'
import { czechStemLight } from '../../../shared/utils/czech-stem'

describe('czechStemLight', () => {
  it('collapses regular noun declensions to the same stem', () => {
    expect(new Set(['mouka', 'mouky', 'moukou', 'mouce'].map(czechStemLight)).size).toBe(1)
    expect(new Set(['mléko', 'mléka', 'mlékem'].map(czechStemLight)).size).toBe(1)
    expect(new Set(['cibule', 'cibuli', 'cibulí'].map(czechStemLight)).size).toBe(1)
    expect(new Set(['brambory', 'bramboru', 'bramborách'].map(czechStemLight)).size).toBe(1)
  })

  it('is case-insensitive', () => {
    expect(czechStemLight('Mouka')).toBe(czechStemLight('mouka'))
  })

  it('leaves short words unchanged', () => {
    expect(czechStemLight('sůl')).toBe('sůl')
  })
})
