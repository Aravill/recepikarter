import type { MealPlan, MealPlanSlot, MealType } from '#shared/types/meal-plan'
import type { Recipe } from '#shared/types/recipe'

// A meal plan is a household planning tool, not an events calendar — cap the
// range so a typo'd year doesn't try to generate tens of thousands of slot
// rows. A couple of months is generous for planning meals ahead.
export const MEAL_PLAN_MAX_DAYS = 62

// Every 'YYYY-MM-DD' date from dateStart to dateEnd inclusive. Used both to
// generate slot rows server-side (server/utils/db.ts) and to render the
// calendar grid client-side, so the two never disagree about which dates a
// plan covers. Returns [] for an invalid or inverted range rather than
// throwing — callers validate separately (server/utils/validate.ts).
export function mealPlanDateRange(dateStart: string, dateEnd: string): string[] {
  const start = new Date(`${dateStart}T00:00:00Z`)
  const end = new Date(`${dateEnd}T00:00:00Z`)
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || start > end) return []

  const dates: string[] = []
  const cursor = new Date(start)
  while (cursor <= end) {
    dates.push(cursor.toISOString().slice(0, 10))
    cursor.setUTCDate(cursor.getUTCDate() + 1)
  }
  return dates
}

// A recipe's `servings` is free text (see recipe.ts) — "4", "4-6", or "".
// Only the leading number is usable as a portion count; anything else is
// treated as unknown rather than zero, so a recipe with no/unparseable
// servings stays a normal droppable badge instead of permanently reading as
// "0 portions left" (see remainingPortions below).
export function parseServingsCount(servings: string): number | null {
  const match = servings.match(/\d+/)
  if (!match) return null
  const n = Number(match[0])
  return Number.isFinite(n) && n > 0 ? n : null
}

// Portions of `recipe` not yet claimed by a slot in this plan — never
// stored (see MealPlanSlot doc comment), always derived from the plan's
// people_count and how many of the plan's slots currently point at this
// recipe. Null means "unknown" (unparseable servings), which the UI treats
// as unlimited rather than blocking the badge.
export function remainingPortions(recipe: Recipe, plan: Pick<MealPlan, 'peopleCount'>, slots: MealPlanSlot[]): number | null {
  const total = parseServingsCount(recipe.servings)
  if (total === null) return null
  const usedSlots = slots.filter((s) => s.recipeId === recipe.id).length
  return total - usedSlots * plan.peopleCount
}

export type MealPlanBadgeState = 'normal' | 'leftover' | 'depleted'

// normal: enough portions left for a whole slot (droppable). leftover:
// something's left but not a full slot's worth (informational only, not
// droppable — the spec calls this state out explicitly). depleted: nothing
// left (greyed out, not droppable). `remaining: null` (unknown servings) is
// always 'normal' — see remainingPortions.
export function mealPlanBadgeState(remaining: number | null, peopleCount: number): MealPlanBadgeState {
  if (remaining === null) return 'normal'
  if (remaining >= peopleCount) return 'normal'
  if (remaining > 0) return 'leftover'
  return 'depleted'
}

// The top-of-calendar counter: every non-skip slot with no recipe assigned
// is "missing", counted both as a slot and as the portions it represents
// (portions = missing slots × people_count, since a slot always consumes a
// full people_count worth of portions). Slot rows always exist for every
// date in the plan's range (see server/utils/db.ts), so scanning `slots`
// alone is enough — no need to separately enumerate dates here.
export function mealPlanMissingCount(slots: MealPlanSlot[], peopleCount: number): { slots: number; portions: number } {
  const missing = slots.filter((s) => !s.isSkip && s.recipeId === null).length
  return { slots: missing, portions: missing * peopleCount }
}

// A fixed, rotating set of distinct accent colors so a recipe reads as "the
// same color" everywhere it appears on the calendar (its tray badge and
// every slot it fills) and different recipes are told apart at a glance —
// deliberately not derived from difficulty/category (those already mean
// something else — see CLAUDE.md). The actual hex values live as
// --mp-color-N tokens in app/app.vue (light + dark), same pattern as
// --easy/--medium/--hard; this just picks the index.
export const MEAL_PLAN_PALETTE_SIZE = 8

export function mealPlanColorIndex(recipeId: number): number {
  return ((recipeId % MEAL_PLAN_PALETTE_SIZE) + MEAL_PLAN_PALETTE_SIZE) % MEAL_PLAN_PALETTE_SIZE
}

export function mealPlanSlotKey(date: string, mealType: MealType): string {
  return `${date}|${mealType}`
}

// Turns a plan's slots into aggregateIngredients (shared/utils/
// ingredient-parser.ts) input: the distinct recipes assigned to at least one
// non-skip slot, each contributing its own ingredients exactly once — see
// server/api/shopping-lists/index.post.ts and app/pages/shopping-list.vue's
// ?plan= view, which both feed this straight into it. A recipe's card
// covers its own servings regardless of how many slots it's dragged into;
// remainingPortions/mealPlanBadgeState above already track whether that's
// enough to cover them (the tray badge's "zbytek"/"vyčerpáno"), so the
// ingredient list itself is never multiplied by slot count — dragging the
// same recipe onto 3 slots means "3 of its portions are spoken for", not
// "cook it 3 times". Slots pointing at a since-deleted recipe are silently
// skipped, same as the calendar grid does (see recipeById.get(...) in
// app/pages/meal-plan.vue).
export function mealPlanShoppingEntries(slots: MealPlanSlot[], recipes: Recipe[]): Recipe[] {
  const recipeById = new Map(recipes.map((r) => [r.id, r]))
  const usedRecipeIds = new Set<number>()
  for (const slot of slots) {
    if (slot.isSkip || slot.recipeId === null) continue
    usedRecipeIds.add(slot.recipeId)
  }
  return [...usedRecipeIds].map((id) => recipeById.get(id)).filter((r): r is Recipe => !!r)
}
