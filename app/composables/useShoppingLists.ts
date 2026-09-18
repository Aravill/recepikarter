import type { ShoppingList } from '#shared/types/shopping-list'

export function useShoppingLists() {
  // See app/composables/useRecipes.ts — SSR $fetch needs the cookie
  // forwarded explicitly or these all 401.
  const headers = import.meta.server ? useRequestHeaders(['cookie']) : undefined

  const listShoppingLists = () => $fetch<ShoppingList[]>('/api/shopping-lists', { headers })
  const saveShoppingList = (name: string, recipeIds: number[]) =>
    $fetch<ShoppingList>('/api/shopping-lists', { method: 'POST', body: { name, recipeIds }, headers })
  const renameShoppingList = (id: number, name: string) =>
    $fetch<ShoppingList>(`/api/shopping-lists/${id}`, { method: 'PATCH', body: { name }, headers })
  const setShoppingListShared = (id: number, shared: boolean) =>
    $fetch<ShoppingList>(`/api/shopping-lists/${id}`, { method: 'PATCH', body: { shared }, headers })
  const deleteShoppingList = (id: number) => $fetch(`/api/shopping-lists/${id}`, { method: 'DELETE', headers })
  const resetShoppingList = (id: number) =>
    $fetch<ShoppingList>(`/api/shopping-lists/${id}/reset`, { method: 'POST', headers })
  const setShoppingListItemChecked = (id: number, key: string, checked: boolean) =>
    $fetch<ShoppingList>(`/api/shopping-lists/${id}/item`, { method: 'PATCH', body: { key, checked }, headers })

  return {
    listShoppingLists,
    saveShoppingList,
    renameShoppingList,
    setShoppingListShared,
    deleteShoppingList,
    resetShoppingList,
    setShoppingListItemChecked,
  }
}
