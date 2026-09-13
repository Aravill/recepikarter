import type { Recipe } from '#shared/types/recipe'

export type PhotoSize = 'full' | 'thumb'

// URL of a recipe's stored photo, or null when it has none. `v` is the
// stored filename, which changes on every upload — so the route can send
// an immutable cache header and a replaced photo still shows up fresh.
export function recipePhotoUrl(recipe: Pick<Recipe, 'id' | 'photoFile'>, size: PhotoSize): string | null {
  if (!recipe.photoFile) return null
  return `/api/recipes/${recipe.id}/photo?size=${size}&v=${encodeURIComponent(recipe.photoFile)}`
}
