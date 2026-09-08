<script setup lang="ts">
import { CATEGORY_LABELS, DIFFICULTY_LABELS, difficultyColor } from '#shared/types/recipe'
import type { Recipe, RecipeInput } from '#shared/types/recipe'

const props = withDefaults(
  defineProps<{
    recipe: Recipe | RecipeInput
    side?: 'front' | 'back'
  }>(),
  { side: 'front' },
)

const stripe = computed(() => difficultyColor(props.recipe.cookTimeDifficulty))
const ingredients = computed(() => props.recipe.ingredients.filter((i) => i.trim()))
const steps = computed(() => props.recipe.steps.filter((s) => s.trim()))
</script>

<template>
  <div class="card-preview" :style="{ '--stripe': stripe }">
    <div class="mini-stripe" />

    <div v-if="side === 'front'" class="mini-body">
      <div>
        <p class="mini-eyebrow">{{ CATEGORY_LABELS[recipe.category].toLocaleUpperCase('cs') }}</p>
        <h2 class="mini-title">{{ recipe.name || 'Nový recept' }}</h2>
      </div>

      <div class="mini-attrs">
        <div>
          <span class="l">Čas</span>
          <span class="v">{{ recipe.cookTime }} min</span>
        </div>
        <div>
          <span class="l">Obtížnost</span>
          <span class="v">{{ DIFFICULTY_LABELS[recipe.cookTimeDifficulty] }}</span>
        </div>
        <div v-if="recipe.servings">
          <span class="l">Porce</span>
          <span class="v">{{ recipe.servings }}</span>
        </div>
      </div>

      <div v-if="ingredients.length">
        <p class="mini-section">SUROVINY</p>
        <ul class="mini-list">
          <li v-for="(ingredient, i) in ingredients" :key="i">{{ ingredient }}</li>
        </ul>
      </div>
    </div>

    <div v-else class="mini-body">
      <p class="mini-section">POSTUP</p>
      <ol v-if="steps.length" class="mini-steps">
        <li v-for="(step, i) in steps" :key="i">{{ step }}</li>
      </ol>
      <div class="mini-footer">
        <span>{{ recipe.name || 'Nový recept' }}</span>
        <span>2 / 2</span>
      </div>
    </div>
  </div>
</template>

<style scoped>
.card-preview {
  --stripe: var(--medium);
  width: 240px;
  height: 502px;
  background: var(--surface);
  border-radius: 12px;
  overflow: hidden;
  box-shadow: 0 20px 40px -18px rgba(0, 0, 0, 0.6);
  display: flex;
  flex-direction: column;
}

.mini-stripe {
  height: 16px;
  background: var(--stripe);
  flex: none;
}

.mini-body {
  padding: 16px 16px 13px;
  display: flex;
  flex-direction: column;
  gap: 12px;
  flex: 1;
  min-height: 0;
}

.mini-eyebrow {
  margin: 0;
  font-family: 'IBM Plex Mono', monospace;
  font-size: 9px;
  font-weight: 700;
  letter-spacing: 0.08em;
  color: var(--stripe);
}

.mini-title {
  margin: 2px 0 0;
  font-family: 'Fraunces', serif;
  font-weight: 600;
  font-size: 19px;
  color: var(--surface-ink);
  line-height: 1.15;
}

.mini-attrs {
  display: flex;
  gap: 14px;
  border-top: 1px solid var(--rule);
  border-bottom: 1px solid var(--rule);
  padding: 9px 0;
}

.mini-attrs div {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.mini-attrs .l {
  font-family: 'IBM Plex Mono', monospace;
  font-size: 7px;
  color: var(--surface-ink-dim);
  text-transform: uppercase;
}

.mini-attrs .v {
  font-family: 'IBM Plex Mono', monospace;
  font-size: 11px;
  font-weight: 700;
  color: var(--surface-ink);
}

.mini-section {
  margin: 0;
  font-family: 'IBM Plex Mono', monospace;
  font-size: 9px;
  font-weight: 700;
  letter-spacing: 0.06em;
  color: var(--accent);
}

.mini-list {
  list-style: none;
  margin: 5px 0 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 6px;
  overflow-y: auto;
}

.mini-list li {
  font-family: 'IBM Plex Sans', sans-serif;
  font-size: 11px;
  color: var(--surface-ink);
  display: flex;
  gap: 6px;
}

.mini-list li::before {
  content: '';
  width: 4px;
  height: 4px;
  margin-top: 5px;
  border-radius: 50%;
  border: 1px solid var(--stripe);
  flex: none;
}

.mini-steps {
  list-style: none;
  margin: 5px 0 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 10px;
  counter-reset: step;
  overflow-y: auto;
}

.mini-steps li {
  counter-increment: step;
  font-family: 'IBM Plex Sans', sans-serif;
  font-size: 11px;
  color: var(--surface-ink);
  line-height: 1.35;
  display: flex;
  gap: 8px;
}

.mini-steps li::before {
  content: counter(step);
  flex: none;
  width: 18px;
  height: 18px;
  border-radius: 50%;
  background: color-mix(in srgb, var(--stripe) 16%, var(--surface));
  color: var(--stripe);
  font-family: 'IBM Plex Mono', monospace;
  font-size: 9px;
  font-weight: 700;
  display: flex;
  align-items: center;
  justify-content: center;
}

.mini-footer {
  margin-top: auto;
  padding-top: 10px;
  border-top: 1px solid var(--rule);
  display: flex;
  justify-content: space-between;
  font-family: 'IBM Plex Mono', monospace;
  font-size: 9px;
  color: var(--surface-ink-dim);
}
</style>
