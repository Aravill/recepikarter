import { describe, expect, it } from 'vitest'
import { normalizeRecipeName } from '../../../shared/utils/recipe-name'

describe('normalizeRecipeName', () => {
  it('is case-insensitive', () => {
    expect(new Set(['Halusky', 'halusky', 'hAlUsKy'].map(normalizeRecipeName)).size).toBe(1)
  })

  it('is diacritics-insensitive', () => {
    expect(normalizeRecipeName('Halušky')).toBe(normalizeRecipeName('Halusky'))
  })

  it('trims and collapses whitespace', () => {
    expect(normalizeRecipeName('  Halusky   Special  ')).toBe(normalizeRecipeName('Halusky Special'))
  })

  it('leaves distinct names distinct', () => {
    expect(normalizeRecipeName('Halušky')).not.toBe(normalizeRecipeName('Guláš'))
  })
})
