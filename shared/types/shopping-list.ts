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
// meal plan to derive recipe quantities from (its ?plan= view) — never both,
// enforced here at the type level so a caller can't reach the 400 that
// having neither (or, previously, an unsound `recipeIds!` on the meal-plan
// branch) would produce. See server/utils/validate.ts's
// parseShoppingListInput and mealPlanShoppingEntries
// (shared/utils/meal-plan.ts) for how a plan turns into recipe quantities —
// each planned recipe contributes its own ingredients once, unscaled.
export type ShoppingListInput = { name: string } & ({ recipeIds: number[] } | { mealPlanId: number })
