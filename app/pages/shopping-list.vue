<script setup lang="ts">
import { aggregateIngredients } from '#shared/utils/ingredient-parser'
import type { AggregatedIngredient } from '#shared/utils/ingredient-parser'

const route = useRoute()
const { listRecipes } = useRecipes()
// Same key as app/pages/index.vue: hits Nuxt's payload cache when arriving
// from there instead of refetching, but still works standalone on a direct
// link or refresh since GET /api/recipes already returns the full table.
const { data: recipes, pending } = await useAsyncData('recipes', () => listRecipes())

const ids = computed<number[]>(() => {
  const raw = route.query.ids
  const str = Array.isArray(raw) ? raw.join(',') : (raw ?? '')
  return str
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
    .map(Number)
    .filter((n) => Number.isFinite(n))
})

// Recipes deleted since the selection was made are silently skipped rather
// than erroring the page.
const selectedRecipes = computed(() => {
  const idSet = new Set(ids.value)
  return (recipes.value ?? []).filter((r) => idSet.has(r.id))
})

const aggregated = computed(() => aggregateIngredients(selectedRecipes.value))

function lineText(item: AggregatedIngredient): string {
  if (item.kind === 'mass' || item.kind === 'volume') return `${item.displayQuantity} ${item.name}`
  return item.displayQuantity ?? item.name
}

// Ticking off items is exactly as ephemeral as the single-recipe shopping
// mode in RecipeCard.vue: navigating away from this page forgets it.
const { items: checked, toggle: toggleChecked } = useToggleSet<string>()
</script>

<template>
  <div class="shopping-list-page">
    <h1>Nákupák</h1>

    <p v-if="pending" class="empty">Načítám…</p>
    <p v-else-if="!selectedRecipes.length" class="empty">Nebyly vybrány žádné recepty.</p>

    <template v-else>
      <p class="source-recipes">Z receptů: {{ selectedRecipes.map((r) => r.name).join(', ') }}</p>

      <ul class="items">
        <li v-for="item in aggregated" :key="item.key" :class="{ checked: checked.has(item.key) }">
          <label class="item-check">
            <input type="checkbox" :checked="checked.has(item.key)" @change="toggleChecked(item.key)">
            <span class="item-text">{{ lineText(item) }}</span>
          </label>
          <p v-if="item.sources.length > 1" class="item-sources">
            z: {{ item.sources.map((s) => `${s.recipeName} (${s.raw})`).join(', ') }}
          </p>
        </li>
      </ul>
    </template>
  </div>
</template>

<style scoped>
.shopping-list-page {
  max-width: 640px;
  margin: 0 auto;
}

h1 {
  margin: 0 0 14px;
  font-family: 'Fraunces', Georgia, serif;
  font-weight: 600;
  font-size: 24px;
  color: var(--text);
}

.empty {
  color: var(--text-dim);
  padding: 40px 0;
  text-align: center;
}

.source-recipes {
  font-family: 'IBM Plex Mono', ui-monospace, monospace;
  font-size: 11.5px;
  color: var(--text-dim);
  padding-bottom: 14px;
}

.items {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.items li {
  background: var(--surface);
  border-radius: 12px;
  padding: 10px 12px;
}

.item-check {
  display: flex;
  align-items: flex-start;
  gap: 10px;
  cursor: pointer;
}

.item-check input {
  appearance: none;
  margin: 2px 0 0;
  flex: none;
  width: 16px;
  height: 16px;
  border-radius: 5px;
  border: 1.5px solid var(--accent);
  background: var(--surface);
  display: grid;
  place-content: center;
  cursor: pointer;
}

.item-check input::before {
  content: '';
  width: 9px;
  height: 9px;
  transform: scale(0);
  transition: transform 0.12s ease-in-out;
  background: var(--accent);
  clip-path: polygon(14% 44%, 0 65%, 50% 100%, 100% 16%, 80% 0%, 43% 62%);
}

.item-check input:checked::before {
  transform: scale(1);
}

.item-check input:focus-visible {
  outline: 2px solid var(--accent);
  outline-offset: 2px;
}

.item-text {
  font-family: 'IBM Plex Sans', sans-serif;
  font-size: 15px;
  color: var(--surface-ink);
}

.items li.checked .item-text {
  color: var(--surface-ink-dim);
  text-decoration: line-through;
}

.item-sources {
  margin: 6px 0 0 26px;
  font-family: 'IBM Plex Mono', ui-monospace, monospace;
  font-size: 10.5px;
  color: var(--surface-ink-dim);
}
</style>
