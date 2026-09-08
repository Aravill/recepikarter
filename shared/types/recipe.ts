export const CATEGORIES = [
  'Main Course',
  'Soup',
  'Salad',
  'Appetizer',
  'Side Dish',
  'Breakfast',
  'Sweet',
  'Bread',
  'Sauce',
  'Beverage',
] as const

export type Category = (typeof CATEGORIES)[number]

export const DIFFICULTIES = ['Easy', 'Medium', 'Hard'] as const

export type Difficulty = (typeof DIFFICULTIES)[number]

export interface Recipe {
  id: number
  name: string
  category: Category
  cookTime: number
  cookTimeDifficulty: Difficulty
  servings: string
  ingredients: string[]
  steps: string[]
  tags: string[]
  createdAt: string
  updatedAt: string
}

export type RecipeInput = Omit<Recipe, 'id' | 'createdAt' | 'updatedAt'>

// Accent color (the difficulty stripe) is derived from difficulty, not
// stored, and not category — see docs/design-system.md. Category stays a
// plain text label used only for filtering.
export const DIFFICULTY_COLORS: Record<Difficulty, string> = {
  Easy: '#6f8f5c',
  Medium: '#c98a2e',
  Hard: '#a1423a',
}

export function difficultyColor(difficulty: Difficulty): string {
  return DIFFICULTY_COLORS[difficulty] ?? '#3a3a3a'
}

export function emptyRecipeInput(): RecipeInput {
  return {
    name: '',
    category: CATEGORIES[0],
    cookTime: 30,
    cookTimeDifficulty: 'Easy',
    servings: '',
    ingredients: [''],
    steps: [''],
    tags: [],
  }
}
