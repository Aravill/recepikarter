<script setup lang="ts">
import { CATEGORY_LABELS, DIFFICULTY_LABELS, difficultyColor } from '#shared/types/recipe'
import type { Recipe, RecipeInput } from '#shared/types/recipe'

const props = withDefaults(
  defineProps<{
    recipe: Recipe | RecipeInput
    side?: 'front' | 'back'
    // Shopping mode: the front's ingredient bullets become checkboxes so
    // the card can be ticked off in a shop. Purely visual state — see
    // `checked` below.
    shopping?: boolean
  }>(),
  { side: 'front', shopping: false },
)

const stripe = computed(() => difficultyColor(props.recipe.cookTimeDifficulty))
const ingredients = computed(() => props.recipe.ingredients.filter((i) => i.trim()))
const steps = computed(() => props.recipe.steps.filter((s) => s.trim()))
const tags = computed(() => props.recipe.tags.filter((t) => t.trim()))
// Only a saved Recipe carries an author (server-stamped on create) — a
// RecipeInput being edited/previewed doesn't have one yet.
const author = computed(() => ('author' in props.recipe ? props.recipe.author : ''))

// Which ingredients (by index into `ingredients`) are ticked off. Deliberately
// not persisted anywhere: a shopping list is done once the trip is, so
// leaving shopping mode simply forgets it.
const { items: checked, toggle: toggleChecked, clear: clearChecked } = useToggleSet<number>()

watch(
  () => props.shopping,
  (shopping) => {
    if (!shopping) clearChecked()
  },
)
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

      <div v-if="ingredients.length" class="mini-ingredients">
        <p class="mini-section">SUROVINY</p>
        <ul class="mini-list" :class="{ shopping }">
          <li v-for="(ingredient, i) in ingredients" :key="i" :class="{ checked: checked.has(i) }">
            <label v-if="shopping" class="mini-check">
              <input type="checkbox" :checked="checked.has(i)" @change="toggleChecked(i)">
              <span>{{ ingredient }}</span>
            </label>
            <template v-else>{{ ingredient }}</template>
          </li>
        </ul>
      </div>

      <ul v-if="tags.length" class="mini-tags" aria-label="Tagy">
        <li v-for="(tag, i) in tags" :key="i">{{ tag }}</li>
      </ul>

      <div v-if="author" class="mini-footer">
        <span>Autor: {{ author }}</span>
      </div>
    </div>

    <div v-else class="mini-body">
      <p class="mini-section">POSTUP</p>
      <ol v-if="steps.length" class="mini-steps">
        <li v-for="(step, i) in steps" :key="i">{{ step }}</li>
      </ol>
      <div class="mini-footer">
        <span>{{ recipe.name || 'Nový recept' }}{{ author ? ` · ${author}` : '' }}</span>
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

/* Flex items default to min-height: auto, which would let a long
   ingredient list grow past the fixed card height and push the tags and
   author footer out of view; min-height: 0 on both the wrapper and the
   list is what lets the list actually shrink and scroll instead. */
.mini-ingredients {
  display: flex;
  flex-direction: column;
  min-height: 0;
}

.mini-list {
  list-style: none;
  margin: 5px 0 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 6px;
  min-height: 0;
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

/* Shopping mode: the bullet gives way to a real checkbox and each row
   grows into a comfortable thumb target — this is the one view of the card
   that's meant to be poked at repeatedly on a phone in a shop aisle. */
.mini-list.shopping {
  gap: 2px;
}

.mini-list.shopping li::before {
  content: none;
}

.mini-check {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  width: 100%;
  padding: 4px 2px;
  border-radius: 6px;
  cursor: pointer;
}

.mini-check input {
  appearance: none;
  margin: 0;
  flex: none;
  width: 14px;
  height: 14px;
  border-radius: 4px;
  border: 1.5px solid var(--stripe);
  background: var(--surface);
  display: grid;
  place-content: center;
  cursor: pointer;
}

.mini-check input::before {
  content: '';
  width: 8px;
  height: 8px;
  transform: scale(0);
  transition: transform 0.12s ease-in-out;
  background: var(--stripe);
  clip-path: polygon(14% 44%, 0 65%, 50% 100%, 100% 16%, 80% 0%, 43% 62%);
}

.mini-check input:checked::before {
  transform: scale(1);
}

.mini-check input:focus-visible {
  outline: 2px solid var(--accent);
  outline-offset: 2px;
}

.mini-list li.checked .mini-check span {
  color: var(--surface-ink-dim);
  text-decoration: line-through;
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

/* Tags sit at the bottom of the front, just above the author line —
   the ingredient list above them scrolls, this row never does. */
.mini-tags {
  list-style: none;
  margin: auto 0 0;
  padding: 0;
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
  flex: none;
}

.mini-tags li {
  font-family: 'IBM Plex Mono', monospace;
  font-size: 8px;
  line-height: 1;
  padding: 3px 6px;
  border-radius: 999px;
  border: 1px solid var(--rule);
  color: var(--surface-ink-dim);
  max-width: 100%;
  overflow-wrap: anywhere;
}

.mini-tags + .mini-footer {
  margin-top: 0;
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
