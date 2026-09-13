import { describe, expect, it } from 'vitest'
import { recipePhotoUrl } from '../../../shared/utils/recipe-photo'

describe('recipePhotoUrl', () => {
  it('is null for a recipe without a photo', () => {
    expect(recipePhotoUrl({ id: 3, photoFile: null }, 'full')).toBeNull()
  })

  it('points at the photo route with the size and the filename as a cache key', () => {
    expect(recipePhotoUrl({ id: 3, photoFile: '3-1700000000000.webp' }, 'thumb')).toBe(
      '/api/recipes/3/photo?size=thumb&v=3-1700000000000.webp',
    )
  })
})
