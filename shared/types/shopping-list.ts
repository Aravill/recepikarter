import type { AggregatedIngredient } from '#shared/utils/ingredient-parser'

// A saved list's snapshot item is an AggregatedIngredient (see
// shared/utils/ingredient-parser.ts) plus its own persisted checked state.
// The snapshot is produced once, server-side, at save time (POST
// /api/shopping-lists) from the source recipes' ingredients at that moment,
// and never re-aggregated afterwards — so a saved list stays stable even if
// a source recipe is later edited or deleted.
export interface ShoppingListItem extends AggregatedIngredient {
  checked: boolean
}

export interface ShoppingList {
  id: number
  name: string
  ownerUsername: string
  items: ShoppingListItem[]
  // A shared list is visible to, and its items toggleable by, every logged-in
  // household user — not just the owner. A plain boolean, not a pairwise ACL
  // (this app is single-household, no friends/permissions concept).
  shared: boolean
  createdAt: string
  updatedAt: string
}

// What POST /api/shopping-lists takes: a name plus either an explicit set of
// recipe ids (the ephemeral ?ids= view in app/pages/shopping-list.vue) or a
// meal plan to derive scaled recipe quantities from (its ?plan= view) —
// never both. See server/utils/validate.ts's parseShoppingListInput, which
// enforces that, and mealPlanShoppingEntries (shared/utils/meal-plan.ts) for
// how a plan turns into recipe quantities.
export interface ShoppingListInput {
  name: string
  recipeIds?: number[]
  mealPlanId?: number
}
