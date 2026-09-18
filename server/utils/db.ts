import { existsSync, mkdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import Database from 'better-sqlite3'
import { MEAL_TYPES } from '#shared/types/meal-plan'
import type { MealPlan, MealPlanInput, MealPlanSlot, MealPlanSlotInput } from '#shared/types/meal-plan'
import type { Recipe, RecipeInput } from '#shared/types/recipe'
import type { ShoppingList, ShoppingListItem } from '#shared/types/shopping-list'
import type { AppUser, UserStatus } from '#shared/types/user'
import { mealPlanDateRange } from '#shared/utils/meal-plan'
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
    author TEXT NOT NULL DEFAULT '',
    photo_file TEXT
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

if (!recipeColumns.includes('photo_file')) {
  db.exec('ALTER TABLE recipes ADD COLUMN photo_file TEXT')
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
  photo_file: string | null
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
    photoFile: row.photo_file,
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

// Every distinct tag in use, most-used first, for the tag suggestions in
// the recipe form. Spellings that differ only by case/diacritics are
// merged (same normalization as findRecipeByNormalizedName), keeping the
// most common spelling. Scans all rows in JS for the same reason as above.
export function listTags(): string[] {
  const spellings = new Map<string, Map<string, number>>()
  const rows = db.prepare('SELECT tags FROM recipes').all() as Pick<RecipeRow, 'tags'>[]
  for (const row of rows) {
    for (const tag of JSON.parse(row.tags) as string[]) {
      const key = normalizeRecipeName(tag)
      const counts = spellings.get(key) ?? new Map<string, number>()
      counts.set(tag, (counts.get(tag) ?? 0) + 1)
      spellings.set(key, counts)
    }
  }
  const mostCommon = (counts: Map<string, number>) => [...counts.entries()].sort((a, b) => b[1] - a[1])[0]!
  return [...spellings.values()]
    .map((counts) => {
      const [spelling] = mostCommon(counts)
      const total = [...counts.values()].reduce((sum, n) => sum + n, 0)
      return { spelling, total }
    })
    .sort((a, b) => b.total - a.total || a.spelling.localeCompare(b.spelling, 'cs'))
    .map((t) => t.spelling)
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

// Only records which file on disk is the recipe's photo — writing and
// removing the actual files is server/utils/photos.ts's job.
export function setRecipePhoto(id: number, file: string | null): Recipe | undefined {
  const result = db.prepare('UPDATE recipes SET photo_file = ? WHERE id = ?').run(file, id)
  if (result.changes === 0) return undefined
  return getRecipe(id)
}

// A brand-new table, unlike `recipes`/`users` above — every already-deployed
// database is equally missing it, so CREATE TABLE IF NOT EXISTS alone
// upgrades it in place on next start. The PRAGMA/ALTER TABLE dance in
// CLAUDE.md's gotcha is only needed when a column is added to a table that
// already existed before the column did.
db.exec(`
  CREATE TABLE IF NOT EXISTS shopping_lists (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    owner_username TEXT NOT NULL,
    items_json TEXT NOT NULL DEFAULT '[]',
    shared INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  )
`)

interface ShoppingListRow {
  id: number
  name: string
  owner_username: string
  items_json: string
  shared: number
  created_at: string
  updated_at: string
}

function rowToShoppingList(row: ShoppingListRow): ShoppingList {
  return {
    id: row.id,
    name: row.name,
    ownerUsername: row.owner_username,
    items: JSON.parse(row.items_json),
    shared: !!row.shared,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

// A user's own lists plus every shared list regardless of owner, most
// recently active first — never someone else's private list. The
// owner/shared split (and who may mutate what) is enforced by the API
// routes under server/api/shopping-lists/, not here.
export function listShoppingLists(username: string): ShoppingList[] {
  const rows = db
    .prepare('SELECT * FROM shopping_lists WHERE owner_username = ? OR shared = 1 ORDER BY updated_at DESC')
    .all(username) as ShoppingListRow[]
  return rows.map(rowToShoppingList)
}

export function getShoppingList(id: number): ShoppingList | undefined {
  const row = db.prepare('SELECT * FROM shopping_lists WHERE id = ?').get(id) as ShoppingListRow | undefined
  return row ? rowToShoppingList(row) : undefined
}

export function createShoppingList(name: string, ownerUsername: string, items: ShoppingListItem[]): ShoppingList {
  const now = new Date().toISOString()
  const stmt = db.prepare(`
    INSERT INTO shopping_lists (name, owner_username, items_json, shared, created_at, updated_at)
    VALUES (@name, @ownerUsername, @itemsJson, 0, @createdAt, @updatedAt)
  `)
  const result = stmt.run({
    name,
    ownerUsername,
    itemsJson: JSON.stringify(items),
    createdAt: now,
    updatedAt: now,
  })
  return getShoppingList(Number(result.lastInsertRowid))!
}

// Rename and the shared toggle are the only owner-editable metadata — who's
// allowed to call this is enforced by the PATCH route, not here (same split
// as updateRecipe not checking author itself).
export function updateShoppingListMeta(
  id: number,
  patch: { name?: string; shared?: boolean },
): ShoppingList | undefined {
  const existing = getShoppingList(id)
  if (!existing) return undefined
  const now = new Date().toISOString()
  db.prepare('UPDATE shopping_lists SET name = ?, shared = ?, updated_at = ? WHERE id = ?').run(
    patch.name ?? existing.name,
    (patch.shared ?? existing.shared) ? 1 : 0,
    now,
    id,
  )
  return getShoppingList(id)
}

export function deleteShoppingList(id: number): boolean {
  const result = db.prepare('DELETE FROM shopping_lists WHERE id = ?').run(id)
  return result.changes > 0
}

// Unticks every item — the persisted equivalent of the ephemeral "clear
// checkboxes" every other shopping-related view in this app had until now
// (see useToggleSet.ts).
export function resetShoppingListItems(id: number): ShoppingList | undefined {
  const existing = getShoppingList(id)
  if (!existing) return undefined
  const now = new Date().toISOString()
  const items = existing.items.map((item) => ({ ...item, checked: false }))
  db.prepare('UPDATE shopping_lists SET items_json = ?, updated_at = ? WHERE id = ?').run(
    JSON.stringify(items),
    now,
    id,
  )
  return getShoppingList(id)
}

// A small targeted update keyed by item `key`, not a full-list overwrite —
// two people ticking different items on a shared list around the same time
// shouldn't stomp each other.
export function setShoppingListItemChecked(id: number, key: string, checked: boolean): ShoppingList | undefined {
  const existing = getShoppingList(id)
  if (!existing) return undefined
  const now = new Date().toISOString()
  const items = existing.items.map((item) => (item.key === key ? { ...item, checked } : item))
  db.prepare('UPDATE shopping_lists SET items_json = ?, updated_at = ? WHERE id = ?').run(
    JSON.stringify(items),
    now,
    id,
  )
  return getShoppingList(id)
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

// Three brand-new tables, like shopping_lists above — every already-deployed
// database is equally missing them, so CREATE TABLE IF NOT EXISTS alone
// upgrades it in place. meal_plan_slots has one row per date+meal_type+plan
// (see MealPlanSlot's doc comment in shared/types/meal-plan.ts) — the UNIQUE
// index both enforces that and lets setMealPlanSlot below use SQLite's
// upsert syntax. meal_plan_recipes is the tray: which recipes have been
// manually added to a plan, independent of whether they're used in a slot.
db.exec(`
  CREATE TABLE IF NOT EXISTS meal_plans (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    date_start TEXT NOT NULL,
    date_end TEXT NOT NULL,
    people_count INTEGER NOT NULL,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  )
`)

db.exec(`
  CREATE TABLE IF NOT EXISTS meal_plan_slots (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    plan_id INTEGER NOT NULL,
    date TEXT NOT NULL,
    meal_type TEXT NOT NULL,
    recipe_id INTEGER,
    is_skip INTEGER NOT NULL DEFAULT 0,
    UNIQUE(plan_id, date, meal_type)
  )
`)

db.exec(`
  CREATE TABLE IF NOT EXISTS meal_plan_recipes (
    plan_id INTEGER NOT NULL,
    recipe_id INTEGER NOT NULL,
    UNIQUE(plan_id, recipe_id)
  )
`)

interface MealPlanRow {
  id: number
  name: string
  date_start: string
  date_end: string
  people_count: number
  created_at: string
  updated_at: string
}

function rowToMealPlan(row: MealPlanRow): MealPlan {
  return {
    id: row.id,
    name: row.name,
    dateStart: row.date_start,
    dateEnd: row.date_end,
    peopleCount: row.people_count,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

export function listMealPlans(): MealPlan[] {
  const rows = db.prepare('SELECT * FROM meal_plans ORDER BY date_start DESC').all() as MealPlanRow[]
  return rows.map(rowToMealPlan)
}

export function getMealPlan(id: number): MealPlan | undefined {
  const row = db.prepare('SELECT * FROM meal_plans WHERE id = ?').get(id) as MealPlanRow | undefined
  return row ? rowToMealPlan(row) : undefined
}

// Makes meal_plan_slots match the plan's current date range: adds an empty
// row (recipe_id null, is_skip false) for every date × meal_type newly in
// range, and removes rows for dates that fell out of range — dropping
// whatever recipe/skip they held. Called after every create/update of a
// plan's dates; a no-op on a range that hasn't changed.
function syncMealPlanSlots(planId: number, dateStart: string, dateEnd: string): void {
  const dates = new Set(mealPlanDateRange(dateStart, dateEnd))
  const existing = db
    .prepare('SELECT date, meal_type FROM meal_plan_slots WHERE plan_id = ?')
    .all(planId) as { date: string; meal_type: string }[]
  const existingKeys = new Set(existing.map((e) => `${e.date}|${e.meal_type}`))

  const toDelete = existing.filter((e) => !dates.has(e.date))
  if (toDelete.length) {
    const del = db.prepare('DELETE FROM meal_plan_slots WHERE plan_id = ? AND date = ? AND meal_type = ?')
    for (const e of toDelete) del.run(planId, e.date, e.meal_type)
  }

  const insert = db.prepare(
    'INSERT INTO meal_plan_slots (plan_id, date, meal_type, recipe_id, is_skip) VALUES (?, ?, ?, NULL, 0)',
  )
  for (const date of dates) {
    for (const mealType of MEAL_TYPES) {
      if (!existingKeys.has(`${date}|${mealType}`)) insert.run(planId, date, mealType)
    }
  }
}

export function createMealPlan(input: MealPlanInput): MealPlan {
  const now = new Date().toISOString()
  const stmt = db.prepare(`
    INSERT INTO meal_plans (name, date_start, date_end, people_count, created_at, updated_at)
    VALUES (@name, @dateStart, @dateEnd, @peopleCount, @createdAt, @updatedAt)
  `)
  const result = stmt.run({
    name: input.name,
    dateStart: input.dateStart,
    dateEnd: input.dateEnd,
    peopleCount: input.peopleCount,
    createdAt: now,
    updatedAt: now,
  })
  const id = Number(result.lastInsertRowid)
  syncMealPlanSlots(id, input.dateStart, input.dateEnd)
  return getMealPlan(id)!
}

// Renaming, resizing the date range, or changing people_count all go
// through here (the "Uložit plán" button — see the planning page). A
// changed date range re-syncs slot rows via syncMealPlanSlots, which can
// drop assignments on dates that fall out of the new range.
export function updateMealPlan(id: number, input: MealPlanInput): MealPlan | undefined {
  if (!getMealPlan(id)) return undefined
  const now = new Date().toISOString()
  db.prepare('UPDATE meal_plans SET name = ?, date_start = ?, date_end = ?, people_count = ?, updated_at = ? WHERE id = ?').run(
    input.name,
    input.dateStart,
    input.dateEnd,
    input.peopleCount,
    now,
    id,
  )
  syncMealPlanSlots(id, input.dateStart, input.dateEnd)
  return getMealPlan(id)
}

export function deleteMealPlan(id: number): boolean {
  db.prepare('DELETE FROM meal_plan_slots WHERE plan_id = ?').run(id)
  db.prepare('DELETE FROM meal_plan_recipes WHERE plan_id = ?').run(id)
  const result = db.prepare('DELETE FROM meal_plans WHERE id = ?').run(id)
  return result.changes > 0
}

interface MealPlanSlotRow {
  id: number
  plan_id: number
  date: string
  meal_type: string
  recipe_id: number | null
  is_skip: number
}

function rowToMealPlanSlot(row: MealPlanSlotRow): MealPlanSlot {
  return {
    id: row.id,
    planId: row.plan_id,
    date: row.date,
    mealType: row.meal_type as MealPlanSlot['mealType'],
    recipeId: row.recipe_id,
    isSkip: !!row.is_skip,
  }
}

export function listMealPlanSlots(planId: number): MealPlanSlot[] {
  const rows = db
    .prepare('SELECT * FROM meal_plan_slots WHERE plan_id = ? ORDER BY date, meal_type')
    .all(planId) as MealPlanSlotRow[]
  return rows.map(rowToMealPlanSlot)
}

// Sets one slot's recipe/skip state in a single call — assigning a recipe,
// marking skip, and clearing a slot (recipeId null, isSkip false) are all
// just different values of the same upsert, matching how the drag-drop UI
// treats them (see MealPlanSlotInput's doc comment). Relies on the
// UNIQUE(plan_id, date, meal_type) index for the ON CONFLICT upsert — the
// row always already exists (syncMealPlanSlots pre-creates it), so this is
// an UPDATE in practice, but INSERT ... ON CONFLICT is the idiomatic
// better-sqlite3 way to express "set this row's value" without a separate
// existence check. Returns undefined if the plan itself doesn't exist.
export function setMealPlanSlot(
  planId: number,
  input: MealPlanSlotInput,
): MealPlanSlot | undefined {
  if (!getMealPlan(planId)) return undefined
  db.prepare(`
    INSERT INTO meal_plan_slots (plan_id, date, meal_type, recipe_id, is_skip)
    VALUES (@planId, @date, @mealType, @recipeId, @isSkip)
    ON CONFLICT(plan_id, date, meal_type) DO UPDATE SET recipe_id = excluded.recipe_id, is_skip = excluded.is_skip
  `).run({
    planId,
    date: input.date,
    mealType: input.mealType,
    recipeId: input.recipeId,
    isSkip: input.isSkip ? 1 : 0,
  })
  const row = db
    .prepare('SELECT * FROM meal_plan_slots WHERE plan_id = ? AND date = ? AND meal_type = ?')
    .get(planId, input.date, input.mealType) as MealPlanSlotRow
  return rowToMealPlanSlot(row)
}

export function listMealPlanTrayRecipeIds(planId: number): number[] {
  const rows = db
    .prepare('SELECT recipe_id FROM meal_plan_recipes WHERE plan_id = ? ORDER BY recipe_id')
    .all(planId) as { recipe_id: number }[]
  return rows.map((r) => r.recipe_id)
}

// The skip badge is always available (see shared/types/meal-plan.ts) and
// isn't a recipe, so it never goes through the tray table — only real
// recipes get manually added here.
export function addMealPlanTrayRecipe(planId: number, recipeId: number): void {
  db.prepare('INSERT OR IGNORE INTO meal_plan_recipes (plan_id, recipe_id) VALUES (?, ?)').run(planId, recipeId)
}

// Removing a recipe from the tray only hides its badge — it doesn't touch
// any slot already assigned to that recipe (slots reference the recipe
// directly, not the tray row; see remainingPortions in
// shared/utils/meal-plan.ts, which reads from slots, not the tray).
export function removeMealPlanTrayRecipe(planId: number, recipeId: number): void {
  db.prepare('DELETE FROM meal_plan_recipes WHERE plan_id = ? AND recipe_id = ?').run(planId, recipeId)
}
