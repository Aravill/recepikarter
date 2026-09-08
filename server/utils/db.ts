import { existsSync, mkdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import Database from 'better-sqlite3'
import type { Recipe, RecipeInput } from '../../shared/types/recipe'

const dbPath = process.env.RECIPE_DB_PATH || join(process.cwd(), 'data', 'recipes.sqlite')

const dbDir = dirname(dbPath)
if (!existsSync(dbDir)) mkdirSync(dbDir, { recursive: true })

const db = new Database(dbPath)
db.pragma('journal_mode = WAL')

db.exec(`
  CREATE TABLE IF NOT EXISTS recipes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    category TEXT NOT NULL,
    cook_time INTEGER NOT NULL,
    cook_time_difficulty TEXT NOT NULL,
    servings TEXT NOT NULL DEFAULT '',
    ingredients TEXT NOT NULL DEFAULT '[]',
    steps TEXT NOT NULL DEFAULT '[]',
    tags TEXT NOT NULL DEFAULT '[]',
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  )
`)

interface RecipeRow {
  id: number
  name: string
  category: string
  cook_time: number
  cook_time_difficulty: string
  servings: string
  ingredients: string
  steps: string
  tags: string
  created_at: string
  updated_at: string
}

function rowToRecipe(row: RecipeRow): Recipe {
  return {
    id: row.id,
    name: row.name,
    category: row.category as Recipe['category'],
    cookTime: row.cook_time,
    cookTimeDifficulty: row.cook_time_difficulty as Recipe['cookTimeDifficulty'],
    servings: row.servings,
    ingredients: JSON.parse(row.ingredients),
    steps: JSON.parse(row.steps),
    tags: JSON.parse(row.tags),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

export function listRecipes(): Recipe[] {
  const rows = db.prepare('SELECT * FROM recipes ORDER BY updated_at DESC').all() as RecipeRow[]
  return rows.map(rowToRecipe)
}

export function getRecipe(id: number): Recipe | undefined {
  const row = db.prepare('SELECT * FROM recipes WHERE id = ?').get(id) as RecipeRow | undefined
  return row ? rowToRecipe(row) : undefined
}

export function createRecipe(input: RecipeInput): Recipe {
  const now = new Date().toISOString()
  const stmt = db.prepare(`
    INSERT INTO recipes (name, category, cook_time, cook_time_difficulty, servings, ingredients, steps, tags, created_at, updated_at)
    VALUES (@name, @category, @cookTime, @cookTimeDifficulty, @servings, @ingredients, @steps, @tags, @createdAt, @updatedAt)
  `)
  const result = stmt.run({
    name: input.name,
    category: input.category,
    cookTime: input.cookTime,
    cookTimeDifficulty: input.cookTimeDifficulty,
    servings: input.servings,
    ingredients: JSON.stringify(input.ingredients),
    steps: JSON.stringify(input.steps),
    tags: JSON.stringify(input.tags),
    createdAt: now,
    updatedAt: now,
  })
  return getRecipe(Number(result.lastInsertRowid))!
}

export function updateRecipe(id: number, input: RecipeInput): Recipe | undefined {
  const now = new Date().toISOString()
  const stmt = db.prepare(`
    UPDATE recipes
    SET name = @name, category = @category, cook_time = @cookTime, cook_time_difficulty = @cookTimeDifficulty,
        servings = @servings, ingredients = @ingredients, steps = @steps, tags = @tags, updated_at = @updatedAt
    WHERE id = @id
  `)
  const result = stmt.run({
    id,
    name: input.name,
    category: input.category,
    cookTime: input.cookTime,
    cookTimeDifficulty: input.cookTimeDifficulty,
    servings: input.servings,
    ingredients: JSON.stringify(input.ingredients),
    steps: JSON.stringify(input.steps),
    tags: JSON.stringify(input.tags),
    updatedAt: now,
  })
  if (result.changes === 0) return undefined
  return getRecipe(id)
}

export function deleteRecipe(id: number): boolean {
  const result = db.prepare('DELETE FROM recipes WHERE id = ?').run(id)
  return result.changes > 0
}
