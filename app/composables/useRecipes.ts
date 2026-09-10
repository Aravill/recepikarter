import type { Recipe, RecipeInput } from '#shared/types/recipe'

export function useRecipes() {
  // During SSR, $fetch to a relative URL calls the Nitro server directly and
  // does not forward the incoming request's cookies on its own — without
  // this, the session cookie is missing and every call 401s server-side.
  const headers = import.meta.server ? useRequestHeaders(['cookie']) : undefined

  const listRecipes = () => $fetch<Recipe[]>('/api/recipes', { headers })
  const getRecipeById = (id: number) => $fetch<Recipe>(`/api/recipes/${id}`, { headers })
  const createRecipe = (input: RecipeInput) =>
    $fetch<Recipe>('/api/recipes', { method: 'POST', body: input, headers })
  const updateRecipe = (id: number, input: RecipeInput) =>
    $fetch<Recipe>(`/api/recipes/${id}`, { method: 'PUT', body: input, headers })
  const deleteRecipe = (id: number) => $fetch(`/api/recipes/${id}`, { method: 'DELETE', headers })
  const markExported = (id: number) => $fetch<Recipe>(`/api/recipes/${id}/export`, { method: 'POST', headers })
  const importRecipes = (recipes: unknown[]) =>
    $fetch<{ created: Recipe[]; skipped: { name: string; reason: string }[] }>('/api/recipes/import', {
      method: 'POST',
      body: recipes,
      headers,
    })

  return { listRecipes, getRecipeById, createRecipe, updateRecipe, deleteRecipe, markExported, importRecipes }
}
