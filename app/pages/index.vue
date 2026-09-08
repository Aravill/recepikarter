<script setup lang="ts">
import Fuse from 'fuse.js'
import { CATEGORIES, DIFFICULTIES } from '#shared/types/recipe'
import type { Category, Difficulty, Recipe } from '#shared/types/recipe'

const { listRecipes } = useRecipes()
const { data: recipes, pending } = await useAsyncData('recipes', () => listRecipes())

const search = ref('')
const selectedCategory = ref<Category | null>(null)
const selectedDifficulty = ref<Difficulty | null>(null)
const sortBy = ref<'updated' | 'name' | 'time' | 'difficulty'>('updated')

function normalize(s: string) {
  return s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
}

interface SearchableRecipe extends Recipe {
  _searchName: string
  _searchIngredients: string[]
}

const fuse = computed(() => {
  const list: SearchableRecipe[] = (recipes.value ?? []).map((r) => ({
    ...r,
    _searchName: normalize(r.name),
    _searchIngredients: r.ingredients.map(normalize),
  }))
  return new Fuse(list, {
    keys: ['_searchName', '_searchIngredients'],
    threshold: 0.35,
    ignoreLocation: true,
  })
})

const searched = computed<Recipe[]>(() => {
  const q = normalize(search.value.trim())
  if (!q) return recipes.value ?? []
  return fuse.value.search(q).map((r) => r.item)
})

const filtered = computed(() =>
  searched.value.filter((r) => {
    const matchesCategory = !selectedCategory.value || r.category === selectedCategory.value
    const matchesDifficulty = !selectedDifficulty.value || r.cookTimeDifficulty === selectedDifficulty.value
    return matchesCategory && matchesDifficulty
  }),
)

const DIFFICULTY_ORDER: Record<Difficulty, number> = { Easy: 0, Medium: 1, Hard: 2 }

const sorted = computed(() => {
  const list = [...filtered.value]
  switch (sortBy.value) {
    case 'name':
      return list.sort((a, b) => a.name.localeCompare(b.name, 'cs'))
    case 'time':
      return list.sort((a, b) => a.cookTime - b.cookTime)
    case 'difficulty':
      return list.sort((a, b) => DIFFICULTY_ORDER[a.cookTimeDifficulty] - DIFFICULTY_ORDER[b.cookTimeDifficulty])
    case 'updated':
    default:
      return list.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
  }
})

function toggleCategory(category: Category) {
  selectedCategory.value = selectedCategory.value === category ? null : category
}

function toggleDifficulty(difficulty: Difficulty) {
  selectedDifficulty.value = selectedDifficulty.value === difficulty ? null : difficulty
}

const DIFFICULTY_LABEL: Record<Difficulty, string> = { Easy: 'Snadné', Medium: 'Střední', Hard: 'Těžké' }

function recipeCountLabel(n: number) {
  if (n === 1) return `${n} recept`
  if (n >= 2 && n <= 4) return `${n} recepty`
  return `${n} receptů`
}
</script>

<template>
  <div class="list-page">
    <div class="search-wrap">
      <input v-model="search" class="search-input" type="search" placeholder="Hledat recept nebo ingredienci…" />
    </div>

    <div class="pill-row">
      <button class="pill" :class="{ active: !selectedCategory }" @click="selectedCategory = null">Vše</button>
      <button
        v-for="category in CATEGORIES"
        :key="category"
        class="pill"
        :class="{ active: selectedCategory === category }"
        @click="toggleCategory(category)"
      >
        {{ category }}
      </button>
      <button
        v-for="difficulty in DIFFICULTIES"
        :key="difficulty"
        class="pill"
        :class="{ active: selectedDifficulty === difficulty }"
        @click="toggleDifficulty(difficulty)"
      >
        <span class="dot" :style="{ background: `var(--${difficulty.toLowerCase()})` }" />
        {{ DIFFICULTY_LABEL[difficulty] }}
      </button>
    </div>

    <div class="sort-row">
      <span class="count">{{ pending ? 'Načítám…' : recipeCountLabel(sorted.length) }}</span>
      <label class="sort-by">
        Řadit:
        <select v-model="sortBy">
          <option value="updated">naposledy upraveno</option>
          <option value="name">název</option>
          <option value="time">čas přípravy</option>
          <option value="difficulty">obtížnost</option>
        </select>
      </label>
    </div>

    <p v-if="!pending && !(recipes ?? []).length" class="empty">
      Nemáte žádné recepty. <NuxtLink to="/recipes/new">Vytvořte první</NuxtLink>.
    </p>
    <p v-else-if="!pending && !sorted.length" class="empty">Žádné recepty neodpovídají hledání ani filtru.</p>

    <div v-else class="list">
      <NuxtLink
        v-for="recipe in sorted"
        :key="recipe.id"
        :to="`/recipes/${recipe.id}`"
        class="row"
        :style="{ borderLeftColor: `var(--${recipe.cookTimeDifficulty.toLowerCase()})` }"
      >
        <div class="row-main">
          <div class="row-name">{{ recipe.name }}</div>
          <div class="row-meta">
            <span>{{ recipe.category }}</span>
            <span>·</span>
            <span>{{ recipe.cookTime }} min</span>
            <span v-if="recipe.servings">·</span>
            <span v-if="recipe.servings">{{ recipe.servings }} {{ recipe.servings === '1' ? 'porce' : 'porcí' }}</span>
          </div>
        </div>
        <span class="row-chevron">›</span>
      </NuxtLink>
    </div>
  </div>
</template>

<style scoped>
.list-page {
  display: flex;
  flex-direction: column;
}

.search-wrap {
  padding-bottom: 10px;
}

.search-input {
  width: 100%;
  font: 400 14.5px 'IBM Plex Sans', sans-serif;
  padding: 11px 13px;
  border-radius: 8px;
  border: 1px solid var(--line);
  background: var(--bg-raised);
  color: var(--text);
}

.search-input::placeholder {
  color: var(--text-dim);
  font-family: 'IBM Plex Mono', monospace;
  font-size: 13px;
}

.pill-row {
  display: flex;
  gap: 8px;
  padding-bottom: 14px;
  overflow-x: auto;
}

.pill {
  flex: none;
  font-family: 'IBM Plex Mono', ui-monospace, monospace;
  font-size: 11.5px;
  font-weight: 600;
  padding: 7px 12px;
  border-radius: 999px;
  border: 1px solid var(--line);
  color: var(--text-dim);
  white-space: nowrap;
  display: flex;
  align-items: center;
  gap: 6px;
  background: none;
  cursor: pointer;
}

.pill.active {
  border-color: var(--accent);
  color: var(--text);
  background: rgba(184, 80, 42, 0.16);
}

.pill .dot {
  width: 7px;
  height: 7px;
  border-radius: 50%;
}

.sort-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding-bottom: 14px;
  font-family: 'IBM Plex Mono', ui-monospace, monospace;
  font-size: 11.5px;
}

.count {
  color: var(--text-dim);
}

.sort-by {
  display: flex;
  align-items: center;
  gap: 6px;
  color: var(--text);
}

.sort-by select {
  font: 600 11.5px 'IBM Plex Mono', ui-monospace, monospace;
  background: var(--bg-raised);
  color: var(--text);
  border: 1px solid var(--line);
  border-radius: 6px;
  padding: 5px 8px;
}

.empty {
  color: var(--text-dim);
  padding: 40px 0;
  text-align: center;
}

.list {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.row {
  background: var(--surface);
  border-radius: 14px;
  padding: 13px 14px 13px 16px;
  display: flex;
  align-items: center;
  gap: 12px;
  border-left: 4px solid var(--medium);
  text-decoration: none;
}

.row-main {
  flex: 1;
  min-width: 0;
}

.row-name {
  font-family: 'Fraunces', Georgia, serif;
  font-weight: 600;
  font-size: 17px;
  color: var(--surface-ink);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.row-meta {
  font-family: 'IBM Plex Mono', ui-monospace, monospace;
  font-size: 12px;
  color: var(--surface-ink-dim);
  margin-top: 3px;
  display: flex;
  gap: 6px;
  align-items: center;
}

.row-chevron {
  color: var(--surface-ink-dim);
  font-size: 17px;
  flex: none;
}
</style>
