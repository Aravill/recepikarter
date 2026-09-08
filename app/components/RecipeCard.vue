<script setup lang="ts">
import { categoryColor } from '../../shared/types/recipe'
import type { Recipe, RecipeInput } from '../../shared/types/recipe'

const props = defineProps<{
  recipe: Recipe | RecipeInput
}>()

const accent = computed(() => categoryColor(props.recipe.category))

const difficultyColor = computed(() => {
  switch (props.recipe.cookTimeDifficulty) {
    case 'Easy':
      return '#4a7a4a'
    case 'Medium':
      return '#b3821f'
    case 'Hard':
      return '#a13f3f'
    default:
      return '#3a3a3a'
  }
})
</script>

<template>
  <div class="recipe-card" :style="{ '--accent': accent }">
    <header class="card-header">
      <p class="category">{{ recipe.category }}</p>
      <h1 class="name">{{ recipe.name || 'Untitled recipe' }}</h1>
    </header>

    <div class="meta-row">
      <span class="meta-item">
        <span class="meta-label">Time</span>
        <span class="meta-value">{{ recipe.cookTime }} min</span>
      </span>
      <span class="meta-item">
        <span class="meta-label">Difficulty</span>
        <span class="meta-value">
          <span class="difficulty-dot" :style="{ background: difficultyColor }" />
          {{ recipe.cookTimeDifficulty }}
        </span>
      </span>
      <span class="meta-item" v-if="recipe.servings">
        <span class="meta-label">Servings</span>
        <span class="meta-value">{{ recipe.servings }}</span>
      </span>
    </div>

    <section class="section" v-if="recipe.ingredients.length">
      <h2>Ingredients</h2>
      <ul class="ingredients">
        <li v-for="(ingredient, i) in recipe.ingredients" :key="i">{{ ingredient }}</li>
      </ul>
    </section>

    <section class="section" v-if="recipe.steps.length">
      <h2>Steps</h2>
      <ol class="steps">
        <li v-for="(step, i) in recipe.steps" :key="i">{{ step }}</li>
      </ol>
    </section>

    <footer class="card-footer" v-if="recipe.tags.length">
      <span class="tag" v-for="tag in recipe.tags" :key="tag">{{ tag }}</span>
    </footer>
  </div>
</template>

<style scoped>
.recipe-card {
  --accent: #3a3a3a;
  width: 4in;
  min-height: 6in;
  height: auto;
  box-sizing: border-box;
  padding: 0.3in 0.32in 0.32in;
  background: #fdf9f2;
  border: 1px solid #e4dcc9;
  outline: 4px solid #fdf9f2;
  outline-offset: -0.14in;
  box-shadow: inset 0 0 0 1px #e4dcc9;
  font-family: Georgia, 'Times New Roman', serif;
  color: #2c2825;
  display: flex;
  flex-direction: column;
  gap: 0.14in;
}

.card-header {
  border-bottom: 2px solid var(--accent);
  padding-bottom: 0.1in;
}

.category {
  margin: 0 0 2px;
  font-family: ui-sans-serif, system-ui, 'Segoe UI', sans-serif;
  font-size: 10px;
  font-weight: 700;
  letter-spacing: 0.14em;
  text-transform: uppercase;
  color: var(--accent);
}

.name {
  margin: 0;
  font-size: 22px;
  line-height: 1.15;
  font-weight: 700;
  color: #211d1a;
}

.meta-row {
  display: flex;
  gap: 0.28in;
  font-family: ui-sans-serif, system-ui, 'Segoe UI', sans-serif;
}

.meta-item {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.meta-label {
  font-size: 9px;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: #8a8072;
}

.meta-value {
  font-size: 12px;
  font-weight: 600;
  display: flex;
  align-items: center;
  gap: 5px;
}

.difficulty-dot {
  width: 7px;
  height: 7px;
  border-radius: 50%;
  display: inline-block;
}

.section h2 {
  margin: 0 0 0.06in;
  font-family: ui-sans-serif, system-ui, 'Segoe UI', sans-serif;
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  color: var(--accent);
}

.ingredients,
.steps {
  margin: 0;
  padding-left: 0.2in;
  font-size: 12.5px;
  line-height: 1.5;
}

.ingredients li,
.steps li {
  margin-bottom: 2px;
}

.card-footer {
  margin-top: auto;
  padding-top: 0.12in;
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  font-family: ui-sans-serif, system-ui, 'Segoe UI', sans-serif;
}

.tag {
  font-size: 9.5px;
  font-weight: 600;
  padding: 2px 8px;
  border-radius: 999px;
  background: color-mix(in srgb, var(--accent) 14%, #fdf9f2);
  color: var(--accent);
  border: 1px solid color-mix(in srgb, var(--accent) 35%, #fdf9f2);
}
</style>
