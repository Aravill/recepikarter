import type { Recipe } from '#shared/types/recipe'
import type { ShoppingListItem } from '#shared/types/shopping-list'
import { aggregateIngredients } from '#shared/utils/ingredient-parser'

// Saves the ephemeral ?ids=... view (app/pages/shopping-list.vue) under a
// name. Re-runs aggregateIngredients here, server-side, from the given
// recipe ids — the same aggregator the ephemeral view uses — rather than
// trusting a client-computed snapshot, and stores the result as a fixed
// snapshot, so the saved list stays stable even if a source recipe is later
// edited or deleted.
export default defineEventHandler(async (event) => {
  const { user } = await requireUserSession(event)
  const body = await readBody(event)
  const input = parseShoppingListInput(body)

  const recipes = input.recipeIds.map((id) => getRecipe(id)).filter((r): r is Recipe => !!r)
  if (!recipes.length) {
    throw createError({ statusCode: 400, statusMessage: 'No matching recipes to save' })
  }

  const items: ShoppingListItem[] = aggregateIngredients(recipes).map((item) => ({ ...item, checked: false }))

  setResponseStatus(event, 201)
  return createShoppingList(input.name, user.username, items)
})
