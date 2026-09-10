<script setup lang="ts">
import Fuse from 'fuse.js'
import { czechStemLight } from '#shared/utils/czech-stem'
import { CATEGORIES, CATEGORY_LABELS, DIFFICULTIES, DIFFICULTY_LABELS } from '#shared/types/recipe'
import type { Category, Difficulty, Recipe } from '#shared/types/recipe'

const { listRecipes } = useRecipes()
const { data: recipes, pending } = await useAsyncData('recipes', () => listRecipes())

const search = ref('')
const selectedCategory = ref<Category | null>(null)
const selectedDifficulty = ref<Difficulty | null>(null)
const sortBy = ref<'updated' | 'name' | 'time' | 'difficulty'>('updated')
const viewMode = ref<'cards' | 'list'>('cards')
const categoryMenuOpen = ref(false)
const categoryMenuRef = ref<HTMLElement | null>(null)

function onDocumentClick(e: MouseEvent) {
  if (categoryMenuOpen.value && categoryMenuRef.value && !categoryMenuRef.value.contains(e.target as Node)) {
    categoryMenuOpen.value = false
  }
}

onMounted(() => document.addEventListener('click', onDocumentClick))
onUnmounted(() => document.removeEventListener('click', onDocumentClick))

// Czech declines nouns/adjectives across cases ("mouka"/"mouky"/"moukou"),
// so plain substring/fuzzy matching on raw text misses most real searches.
// Stemming each word first (before stripping diacritics — the stemmer's
// suffix rules rely on them) collapses those forms to a shared stem, applied
// identically to both indexed text and the live query below.
function normalize(s: string) {
  const stemmed = s
    .toLowerCase()
    .split(/[\s,;.()]+/)
    .filter(Boolean)
    .map((word) => czechStemLight(word))
    .join(' ')
  return stemmed.normalize('NFD').replace(/[̀-ͯ]/g, '')
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

function selectCategory(category: Category | null) {
  selectedCategory.value = category === selectedCategory.value ? null : category
  categoryMenuOpen.value = false
}

function toggleDifficulty(difficulty: Difficulty) {
  selectedDifficulty.value = selectedDifficulty.value === difficulty ? null : difficulty
}
</script>

<template>
  <div class="list-page">
    <div class="search-wrap">
      <div class="search-row">
        <input v-model="search" class="search-input" type="search" placeholder="Hledat recept nebo ingredienci…" />
        <div ref="categoryMenuRef" class="category-menu">
          <button
            type="button"
            class="category-btn"
            :class="{ active: !!selectedCategory }"
            aria-label="Filtrovat podle kategorie"
            @click="categoryMenuOpen = !categoryMenuOpen"
          >
            🏷️
          </button>
          <div v-if="categoryMenuOpen" class="category-dropdown">
            <button
              type="button"
              class="category-option"
              :class="{ active: !selectedCategory }"
              @click="selectCategory(null)"
            >
              Vše
            </button>
            <button
              v-for="category in CATEGORIES"
              :key="category"
              type="button"
              class="category-option"
              :class="{ active: selectedCategory === category }"
              @click="selectCategory(category)"
            >
              {{ CATEGORY_LABELS[category] }}
            </button>
          </div>
        </div>
      </div>
    </div>

    <div class="pill-row">
      <button v-if="selectedCategory" class="pill active" @click="selectCategory(null)">
        {{ CATEGORY_LABELS[selectedCategory] }} <span class="pill-remove">✕</span>
      </button>
      <button
        v-for="difficulty in DIFFICULTIES"
        :key="difficulty"
        class="pill"
        :class="{ active: selectedDifficulty === difficulty }"
        @click="toggleDifficulty(difficulty)"
      >
        <span class="dot" :style="{ background: `var(--${difficulty.toLowerCase()})` }" />
        {{ DIFFICULTY_LABELS[difficulty] }}
      </button>
    </div>

    <div class="sort-row">
      <span class="count">{{ pending ? 'Načítám…' : `Nalezeno: ${sorted.length}` }}</span>
      <div class="sort-row-actions">
        <label class="sort-by" aria-label="Řadit">
          <span class="sort-icon" aria-hidden="true">↕</span>
          <select v-model="sortBy">
            <option value="updated">naposledy upraveno</option>
            <option value="name">název</option>
            <option value="time">čas přípravy</option>
            <option value="difficulty">obtížnost</option>
          </select>
        </label>
        <button
          type="button"
          class="view-toggle"
          :aria-label="viewMode === 'cards' ? 'Zobrazit seznam' : 'Zobrazit karty'"
          @click="viewMode = viewMode === 'cards' ? 'list' : 'cards'"
        >
          {{ viewMode === 'cards' ? '☰' : '⊞' }}
        </button>
      </div>
    </div>

    <p v-if="!pending && !(recipes ?? []).length" class="empty">
      Nemáte žádné recepty. <NuxtLink to="/recipes/new">Vytvořte první</NuxtLink>.
    </p>
    <p v-else-if="!pending && !sorted.length" class="empty">Žádné recepty neodpovídají hledání ani filtru.</p>

    <CardStack v-else-if="viewMode === 'cards'" :recipes="sorted" />

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
            <span>{{ CATEGORY_LABELS[recipe.category] }}</span>
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
  max-width: 640px;
  margin: 0 auto;
}

.search-wrap {
  padding-bottom: 10px;
}

.search-row {
  display: flex;
  gap: 8px;
}

.search-input {
  flex: 1;
  min-width: 0;
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

.category-menu {
  position: relative;
  flex: none;
}

.category-btn {
  width: 42px;
  height: 100%;
  font-size: 16px;
  border-radius: 8px;
  border: 1px solid var(--line);
  background: var(--bg-raised);
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
}

.category-btn.active {
  border-color: var(--accent);
}

.category-dropdown {
  position: absolute;
  top: calc(100% + 6px);
  right: 0;
  min-width: 168px;
  max-height: 280px;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 2px;
  padding: 6px;
  background: var(--surface);
  border: 1px solid var(--rule);
  border-radius: 10px;
  box-shadow: 0 16px 32px -16px rgba(0, 0, 0, 0.4);
  z-index: 20;
}

.category-option {
  text-align: left;
  font-family: 'IBM Plex Sans', sans-serif;
  font-size: 13.5px;
  padding: 8px 10px;
  border-radius: 6px;
  border: none;
  background: none;
  color: var(--surface-ink);
  cursor: pointer;
}

.category-option.active {
  background: rgba(184, 80, 42, 0.14);
  color: var(--accent);
  font-weight: 600;
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

.pill-remove {
  font-size: 9px;
  opacity: 0.75;
}

.sort-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  row-gap: 8px;
  padding-bottom: 14px;
  font-family: 'IBM Plex Mono', ui-monospace, monospace;
  font-size: 11.5px;
}

.count {
  color: var(--text-dim);
}

.sort-row-actions {
  display: flex;
  align-items: center;
  gap: 10px;
}

.view-toggle {
  width: 28px;
  height: 28px;
  font-size: 14px;
  border-radius: 8px;
  border: 1px solid var(--line);
  background: var(--bg-raised);
  color: var(--text);
  cursor: pointer;
  padding: 0;
  display: flex;
  align-items: center;
  justify-content: center;
}

.sort-by {
  display: flex;
  align-items: center;
  gap: 6px;
  color: var(--text);
}

.sort-icon {
  font-size: 13px;
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
