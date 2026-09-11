import { existsSync, mkdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import Database from 'better-sqlite3'
import type { Recipe, RecipeInput } from '#shared/types/recipe'
import type { AppUser, UserStatus } from '#shared/types/user'
import { normalizeRecipeName } from '#shared/utils/recipe-name'

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
    updated_at TEXT NOT NULL,
    last_exported_at TEXT,
    author TEXT NOT NULL DEFAULT ''
  )
`)

// No migration system (see CLAUDE.md) — an existing database on disk
// predates columns added after the initial table. CREATE TABLE IF NOT
// EXISTS above only helps a fresh database; this adds the column to one
// that already exists.
const recipeColumns = (db.prepare('PRAGMA table_info(recipes)').all() as { name: string }[]).map((c) => c.name)

if (!recipeColumns.includes('last_exported_at')) {
  db.exec('ALTER TABLE recipes ADD COLUMN last_exported_at TEXT')
}

if (!recipeColumns.includes('author')) {
  db.exec("ALTER TABLE recipes ADD COLUMN author TEXT NOT NULL DEFAULT ''")
  // Every pre-existing recipe predates multi-user support and was made by
  // the sole household admin account — attribute them accordingly instead
  // of leaving an empty author on cards that already existed.
  const fallbackAuthor = process.env.AUTH_USERNAME || 'admin'
  db.prepare("UPDATE recipes SET author = ? WHERE author = ''").run(fallbackAuthor)
}

db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'active',
    must_change_password INTEGER NOT NULL DEFAULT 0,
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
  last_exported_at: string | null
  author: string
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
    lastExportedAt: row.last_exported_at,
    author: row.author,
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

// Case/diacritics-insensitive lookup, used to reject duplicate names on
// import — see shared/utils/recipe-name.ts. Not indexed in SQL: the
// normalization isn't expressible as a plain column comparison, and this
// app's recipe count is small enough that scanning every row in JS is fine.
export function findRecipeByNormalizedName(name: string): Recipe | undefined {
  const target = normalizeRecipeName(name)
  return listRecipes().find((r) => normalizeRecipeName(r.name) === target)
}

export function createRecipe(input: RecipeInput, author: string): Recipe {
  const now = new Date().toISOString()
  const stmt = db.prepare(`
    INSERT INTO recipes (name, category, cook_time, cook_time_difficulty, servings, ingredients, steps, tags, created_at, updated_at, author)
    VALUES (@name, @category, @cookTime, @cookTimeDifficulty, @servings, @ingredients, @steps, @tags, @createdAt, @updatedAt, @author)
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
    author,
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

export function markExported(id: number): Recipe | undefined {
  const now = new Date().toISOString()
  db.prepare('UPDATE recipes SET last_exported_at = ? WHERE id = ?').run(now, id)
  return getRecipe(id)
}

interface UserRow {
  id: number
  username: string
  password_hash: string
  status: string
  must_change_password: number
  created_at: string
  updated_at: string
}

function rowToUser(row: UserRow): AppUser {
  return {
    id: row.id,
    username: row.username,
    status: row.status as UserStatus,
    mustChangePassword: !!row.must_change_password,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

export function listUsers(): AppUser[] {
  const rows = db.prepare('SELECT * FROM users ORDER BY created_at DESC').all() as UserRow[]
  return rows.map(rowToUser)
}

// Internal-only lookups (include password_hash) — used by auth, never
// returned directly from an API route. Public listing goes through
// listUsers()/rowToUser above.
export function findUserRowByUsername(username: string): UserRow | undefined {
  return db.prepare('SELECT * FROM users WHERE username = ?').get(username) as UserRow | undefined
}

function findUserRowById(id: number): UserRow | undefined {
  return db.prepare('SELECT * FROM users WHERE id = ?').get(id) as UserRow | undefined
}

export function createUser(username: string, passwordHash: string): AppUser {
  const now = new Date().toISOString()
  // A freshly admin-created account always starts as must-change-password —
  // the whole point of the temporary password an admin hands out.
  const stmt = db.prepare(`
    INSERT INTO users (username, password_hash, status, must_change_password, created_at, updated_at)
    VALUES (@username, @passwordHash, 'active', 1, @createdAt, @updatedAt)
  `)
  const result = stmt.run({ username, passwordHash, createdAt: now, updatedAt: now })
  return rowToUser(findUserRowById(Number(result.lastInsertRowid))!)
}

export function setUserStatus(id: number, status: UserStatus): AppUser | undefined {
  const now = new Date().toISOString()
  db.prepare('UPDATE users SET status = ?, updated_at = ? WHERE id = ?').run(status, now, id)
  const row = findUserRowById(id)
  return row ? rowToUser(row) : undefined
}

export function setUserPassword(id: number, passwordHash: string, mustChangePassword: boolean): void {
  const now = new Date().toISOString()
  db.prepare('UPDATE users SET password_hash = ?, must_change_password = ?, updated_at = ? WHERE id = ?').run(
    passwordHash,
    mustChangePassword ? 1 : 0,
    now,
    id,
  )
}
