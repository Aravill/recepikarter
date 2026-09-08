<script setup lang="ts">
import { CATEGORIES } from '#shared/types/recipe'

const { listRecipes, deleteRecipe } = useRecipes()

const { data: recipes, refresh, pending } = await useAsyncData('recipes', () => listRecipes())

const search = ref('')
const categoryFilter = ref<string>('')

const filtered = computed(() => {
  const q = search.value.trim().toLowerCase()
  return (recipes.value ?? []).filter((r) => {
    const matchesQuery =
      !q || r.name.toLowerCase().includes(q) || r.tags.some((t) => t.toLowerCase().includes(q))
    const matchesCategory = !categoryFilter.value || r.category === categoryFilter.value
    return matchesQuery && matchesCategory
  })
})

async function onDelete(id: number, name: string) {
  if (!confirm(`Delete "${name}"? This cannot be undone.`)) return
  await deleteRecipe(id)
  await refresh()
}
</script>

<template>
  <div>
    <div class="toolbar">
      <input v-model="search" type="search" placeholder="Search by name or tag…" class="search" />
      <select v-model="categoryFilter" class="filter">
        <option value="">All categories</option>
        <option v-for="c in CATEGORIES" :key="c" :value="c">{{ c }}</option>
      </select>
    </div>

    <p v-if="pending" class="empty">Loading…</p>
    <p v-else-if="!filtered.length" class="empty">
      No recipes yet. <NuxtLink to="/recipes/new">Create your first one</NuxtLink>.
    </p>

    <div v-else class="grid">
      <div v-for="recipe in filtered" :key="recipe.id" class="grid-item">
        <NuxtLink :to="`/recipes/${recipe.id}`" class="thumb-link">
          <div class="thumb-frame">
            <div class="thumb-scale">
              <RecipeCard :recipe="recipe" />
            </div>
          </div>
        </NuxtLink>
        <div class="grid-item-footer">
          <NuxtLink :to="`/recipes/${recipe.id}`" class="item-name">{{ recipe.name }}</NuxtLink>
          <div class="item-actions">
            <NuxtLink :to="`/recipes/${recipe.id}/edit`" class="link-btn">Edit</NuxtLink>
            <button class="link-btn danger" @click="onDelete(recipe.id, recipe.name)">Delete</button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.toolbar {
  display: flex;
  gap: 12px;
  margin-bottom: 24px;
}

.search {
  flex: 1;
  padding: 10px 12px;
  border-radius: 6px;
  border: 1px solid #d6d0c4;
  font-size: 14px;
}

.filter {
  padding: 10px 12px;
  border-radius: 6px;
  border: 1px solid #d6d0c4;
  font-size: 14px;
  background: #fff;
}

.empty {
  color: #6b6459;
  padding: 40px 0;
  text-align: center;
}

.grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, 211px);
  justify-content: start;
  gap: 20px;
}

.grid-item {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.thumb-link {
  text-decoration: none;
  display: block;
}

/* Shows an accurate, scaled-down render of the real 4in x 6in print card. */
.thumb-frame {
  width: 100%;
  aspect-ratio: 2 / 3;
  overflow: hidden;
  border-radius: 8px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.12);
  background: #fdf9f2;
}

.thumb-scale {
  width: 4in;
  height: 6in;
  transform: scale(0.55);
  transform-origin: top left;
}

.item-name {
  font-weight: 600;
  text-decoration: none;
  font-size: 14px;
}

.grid-item-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}

.item-actions {
  display: flex;
  gap: 10px;
}

.link-btn {
  background: none;
  border: none;
  padding: 0;
  font-size: 12px;
  color: #3f6c7a;
  cursor: pointer;
  text-decoration: none;
}

.link-btn.danger {
  color: #a13f3f;
}
</style>
