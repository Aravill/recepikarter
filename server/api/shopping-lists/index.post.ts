import type { Recipe } from '#shared/types/recipe'
import type { ShoppingListItem } from '#shared/types/shopping-list'
import { aggregateIngredients } from '#shared/utils/ingredient-parser'
import { mealPlanShoppingEntries } from '#shared/utils/meal-plan'

// Saves either the ephemeral ?ids=... view or the ?plan=... view
// (app/pages/shopping-list.vue) under a name. Re-derives the items here,
// server-side, from the given recipe ids or meal plan — the same aggregator
// the ephemeral view uses — rather than trusting a client-computed
// snapshot, and stores the result as a fixed snapshot, so the saved list
// stays stable even if a source recipe or the plan is later edited or
// deleted.
export default defineEventHandler(async (event) => {
  const { user } = await requireUserSession(event)
  const body = await readBody(event)
  const input = parseShoppingListInput(body)

  let items: ShoppingListItem[]
  if (input.mealPlanId) {
    const plan = getMealPlan(input.mealPlanId)
    if (!plan) {
      throw createError({ statusCode: 404, statusMessage: 'Meal plan not found' })
    }
    const entries = mealPlanShoppingEntries(listMealPlanSlots(plan.id), listRecipes())
    if (!entries.length) {
      throw createError({ statusCode: 400, statusMessage: 'Meal plan has no planned recipes' })
    }
    items = aggregateIngredients(entries).map((item) => ({ ...item, checked: false }))
  } else {
    const recipes = input.recipeIds!.map((id) => getRecipe(id)).filter((r): r is Recipe => !!r)
    if (!recipes.length) {
      throw createError({ statusCode: 400, statusMessage: 'No matching recipes to save' })
    }
    items = aggregateIngredients(recipes).map((item) => ({ ...item, checked: false }))
  }

  setResponseStatus(event, 201)
  return createShoppingList(input.name, user.username, items)
})
