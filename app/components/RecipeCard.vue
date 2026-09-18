<script setup lang="ts">
import { CATEGORY_LABELS, DIFFICULTY_LABELS, difficultyColor } from '#shared/types/recipe'
import type { Recipe, RecipeInput } from '#shared/types/recipe'
import { recipePhotoUrl } from '#shared/utils/recipe-photo'

const props = withDefaults(
  defineProps<{
    recipe: Recipe | RecipeInput
    side?: 'front' | 'back'
    // Whether this recipe is in the shopping cart (see useCart.ts) —
    // purely a visual ring around the card, independent of `side`.
    selected?: boolean
    // Persistently dismissed the photo overlay below (see CardStack's
    // flipCenter) — distinct from the hover-only fade, which is plain CSS.
    photoHidden?: boolean
  }>(),
  { side: 'front', selected: false, photoHidden: false },
)

const stripe = computed(() => difficultyColor(props.recipe.cookTimeDifficulty))
const ingredients = computed(() => props.recipe.ingredients.filter((i) => i.trim()))
const steps = computed(() => props.recipe.steps.filter((s) => s.trim()))
const tags = computed(() => props.recipe.tags.filter((t) => t.trim()))
// Only a saved Recipe carries an author (server-stamped on create) — a
// RecipeInput being edited/previewed doesn't have one yet.
const author = computed(() => ('author' in props.recipe ? props.recipe.author : ''))
// Same story as `author` — only a saved Recipe (with an id and a photoFile)
// can have an uploaded photo; a RecipeInput being edited/previewed can't.
const photoUrl = computed(() => ('photoFile' in props.recipe ? recipePhotoUrl(props.recipe, 'thumb') : null))
</script>

<template>
  <div class="card-preview" :class="{ selected }" :style="{ '--stripe': stripe }">
    <div class="mini-stripe" />

    <div v-if="side === 'front' && photoUrl" class="photo-overlay" :class="{ hidden: photoHidden }">
      <img :src="photoUrl" alt="" class="photo-overlay-img" loading="lazy">
      <div class="photo-overlay-cap">
        <span class="photo-overlay-eyebrow">{{ CATEGORY_LABELS[recipe.category].toLocaleUpperCase('cs') }}</span>
        <span class="photo-overlay-name">{{ recipe.name }}</span>
      </div>
    </div>

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
        <ul class="mini-list">
          <li v-for="(ingredient, i) in ingredients" :key="i">{{ ingredient }}</li>
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
  position: relative;
  width: 240px;
  height: 502px;
  background: var(--surface);
  border-radius: 12px;
  overflow: hidden;
  box-shadow: 0 20px 40px -18px rgba(0, 0, 0, 0.6);
  display: flex;
  flex-direction: column;
}

/* The photo stands in for the front face while it's up — covering
   everything below the difficulty stripe, which stays visible as the one
   constant signal across both states (see docs/design-system.md). Mouse:
   hovering peeks the ingredients underneath, pure CSS, no JS state
   involved. Touch has no hover, so CardStack's tap handling toggles
   `photoHidden` instead — the first tap does what hover does here, a
   second tap then flips the card. */
.photo-overlay {
  position: absolute;
  inset: 16px 0 0;
  z-index: 1;
  display: flex;
  flex-direction: column;
  justify-content: flex-end;
  opacity: 1;
  transition: opacity 0.25s ease;
}

.photo-overlay.hidden {
  opacity: 0;
  pointer-events: none;
}

@media (hover: hover) and (pointer: fine) {
  .card-preview:hover .photo-overlay {
    opacity: 0;
  }
}

.photo-overlay-img {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.photo-overlay-cap {
  position: relative;
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding: 40px 16px 16px;
  background: linear-gradient(to top, rgba(28, 22, 18, 0.85), rgba(28, 22, 18, 0));
}

.photo-overlay-eyebrow {
  font-family: 'IBM Plex Mono', monospace;
  font-size: 10px;
  font-weight: 700;
  letter-spacing: 0.08em;
  color: rgba(253, 249, 242, 0.8);
}

.photo-overlay-name {
  font-family: 'Fraunces', serif;
  font-weight: 600;
  font-size: 22px;
  line-height: 1.15;
  color: #fdf9f2;
}

/* Same ring language as a selected gallery tile/list row (see
   app/pages/index.vue) — sits outside the card's own drop shadow instead of
   clipping into the printed-card face. */
.card-preview.selected {
  outline: 3px solid var(--accent);
  outline-offset: 4px;
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
