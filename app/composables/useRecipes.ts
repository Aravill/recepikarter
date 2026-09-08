import type { Recipe, RecipeInput } from '../../shared/types/recipe'

export function useRecipes() {
  const listRecipes = () => $fetch<Recipe[]>('/api/recipes')
  const getRecipeById = (id: number) => $fetch<Recipe>(`/api/recipes/${id}`)
  const createRecipe = (input: RecipeInput) =>
    $fetch<Recipe>('/api/recipes', { method: 'POST', body: input })
  const updateRecipe = (id: number, input: RecipeInput) =>
    $fetch<Recipe>(`/api/recipes/${id}`, { method: 'PUT', body: input })
  const deleteRecipe = (id: number) => $fetch(`/api/recipes/${id}`, { method: 'DELETE' })

  return { listRecipes, getRecipeById, createRecipe, updateRecipe, deleteRecipe }
}
