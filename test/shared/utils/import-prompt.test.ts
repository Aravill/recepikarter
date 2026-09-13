import { describe, expect, it } from 'vitest'
import { CATEGORIES, DIFFICULTIES } from '../../../shared/types/recipe'
import { buildImportPrompt } from '../../../shared/utils/import-prompt'
import { parseRecipeInput } from '../../../server/utils/validate'

describe('buildImportPrompt', () => {
  const prompt = buildImportPrompt()

  it('lists every allowed category and difficulty as a quoted value', () => {
    for (const category of CATEGORIES) expect(prompt).toContain(`"${category}"`)
    for (const difficulty of DIFFICULTIES) expect(prompt).toContain(`"${difficulty}"`)
  })

  it('embeds an example the import endpoint would accept', () => {
    const block = prompt.slice(prompt.indexOf('EXAMPLE OUTPUT'))
    const example = JSON.parse(block.slice(block.indexOf('['), block.lastIndexOf(']') + 1))
    expect(Array.isArray(example)).toBe(true)
    expect(example).toHaveLength(1)
    expect(() => parseRecipeInput(example[0])).not.toThrow()
  })

  it('ends where the user pastes their recipe', () => {
    expect(prompt.trimEnd()).toMatch(/recipe to convert:$/)
  })
})
