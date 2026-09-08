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

// Accent color for the printed card is derived from category, not stored,
// so every card in a category looks consistent without a manual picker.
export const CATEGORY_COLORS: Record<Category, string> = {
  'Main Course': '#c1552c',
  Soup: '#c99a2e',
  Salad: '#5b7553',
  Appetizer: '#7a4665',
  'Side Dish': '#8a8f3f',
  Breakfast: '#d17a3f',
  Sweet: '#b3467c',
  Bread: '#8a6d4b',
  Sauce: '#a13f3f',
  Beverage: '#3f6c7a',
}

export function categoryColor(category: Category): string {
  return CATEGORY_COLORS[category] ?? '#3a3a3a'
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
