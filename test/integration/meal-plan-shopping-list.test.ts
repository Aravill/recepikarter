import { beforeEach, describe, expect, it } from 'vitest'
import {
  createMealPlan,
  createRecipe,
  deleteMealPlan,
  deleteRecipe,
  listMealPlanSlots,
  listMealPlans,
  listRecipes,
  setMealPlanSlot,
} from '../../server/utils/db'
import { aggregateIngredients } from '../../shared/utils/ingredient-parser'
import { mealPlanShoppingEntries } from '../../shared/utils/meal-plan'
import type { MealPlanInput } from '../../shared/types/meal-plan'
import type { RecipeInput } from '../../shared/types/recipe'

// Exercises the full path server/api/shopping-lists/index.post.ts takes for
// a ?plan=... save: real db rows for the plan/slots/recipes round-tripped
// through SQLite, then mealPlanShoppingEntries + aggregateIngredients — as
// opposed to test/shared/utils/meal-plan.test.ts, which only ever hands
// mealPlanShoppingEntries hand-built objects.

function sampleRecipeInput(overrides: Partial<RecipeInput> = {}): RecipeInput {
  return {
    name: 'Recept',
    category: 'Main Course',
    cookTime: 30,
    cookTimeDifficulty: 'Easy',
    servings: '4',
    ingredients: [],
    steps: ['Uvařit.'],
    tags: [],
    ...overrides,
  }
}

function samplePlanInput(overrides: Partial<MealPlanInput> = {}): MealPlanInput {
  return {
    name: 'Plán',
    dateStart: '2026-01-05',
    dateEnd: '2026-01-06',
    peopleCount: 4,
    ...overrides,
  }
}

beforeEach(() => {
  for (const recipe of listRecipes()) deleteRecipe(recipe.id)
  for (const plan of listMealPlans()) deleteMealPlan(plan.id)
})

describe('meal plan shopping list integration', () => {
  it('counts a recipe used across several slots once, not once per slot', () => {
    const gulas = createRecipe(
      sampleRecipeInput({ name: 'Guláš', servings: '4', ingredients: ['400 g hovězího', '2 cibule'] }),
      'michal',
    )
    // 6 people planned and the recipe only serves 4 — that's a shortfall
    // the tray badge surfaces (remainingPortions/mealPlanBadgeState), not
    // something the shopping list corrects for by multiplying ingredients.
    // Dragging the same recipe onto a second slot claims more of its
    // existing portions, it doesn't ask for a second batch.
    const plan = createMealPlan(samplePlanInput({ peopleCount: 6 }))
    setMealPlanSlot(plan.id, { date: '2026-01-05', mealType: 'lunch', recipeId: gulas.id, isSkip: false })
    setMealPlanSlot(plan.id, { date: '2026-01-06', mealType: 'dinner', recipeId: gulas.id, isSkip: false })

    const entries = mealPlanShoppingEntries(listMealPlanSlots(plan.id), listRecipes())
    const result = aggregateIngredients(entries)

    expect(result.find((r) => r.name === 'hovězího')).toMatchObject({ displayQuantity: '400 g' })
    expect(result.find((r) => r.name === 'cibule')).toMatchObject({ displayQuantity: '2 cibule' })
  })

  it('combines a shared ingredient across two different recipes in the plan', () => {
    const a = createRecipe(sampleRecipeInput({ name: 'A', servings: '2', ingredients: ['100 g mouky'] }), 'michal')
    const b = createRecipe(sampleRecipeInput({ name: 'B', servings: '2', ingredients: ['100 g mouky'] }), 'michal')
    const plan = createMealPlan(samplePlanInput({ peopleCount: 2 }))
    setMealPlanSlot(plan.id, { date: '2026-01-05', mealType: 'lunch', recipeId: a.id, isSkip: false })
    setMealPlanSlot(plan.id, { date: '2026-01-05', mealType: 'dinner', recipeId: b.id, isSkip: false })

    const entries = mealPlanShoppingEntries(listMealPlanSlots(plan.id), listRecipes())
    const result = aggregateIngredients(entries)

    expect(result).toEqual([expect.objectContaining({ name: 'mouky', displayQuantity: '200 g' })])
  })

  it('produces nothing for a plan with only skips and empty slots', () => {
    const plan = createMealPlan(samplePlanInput())
    setMealPlanSlot(plan.id, { date: '2026-01-05', mealType: 'breakfast', recipeId: null, isSkip: true })

    const entries = mealPlanShoppingEntries(listMealPlanSlots(plan.id), listRecipes())
    expect(entries).toEqual([])
  })
})
