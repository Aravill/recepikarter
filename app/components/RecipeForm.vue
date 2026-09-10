<script setup lang="ts">
import { CATEGORIES, CATEGORY_LABELS, DIFFICULTIES, DIFFICULTY_LABELS } from '#shared/types/recipe'
import type { RecipeInput } from '#shared/types/recipe'

const model = defineModel<RecipeInput>({ required: true })

const tagsText = computed({
  get: () => model.value.tags.join(', '),
  set: (val: string) => {
    model.value.tags = val
      .split(',')
      .map((t) => t.trim())
      .filter(Boolean)
  },
})

function addIngredient() {
  model.value.ingredients.push('')
}
function removeIngredient(i: number) {
  model.value.ingredients.splice(i, 1)
}
function addStep() {
  model.value.steps.push('')
}
function removeStep(i: number) {
  model.value.steps.splice(i, 1)
}
</script>

<template>
  <div class="form-section">
    <span class="section-heading">Základní údaje</span>
    <div class="field">
      <label for="f-name">Název</label>
      <input id="f-name" v-model="model.name" type="text" placeholder="Svíčková na smetaně" required />
    </div>
    <div class="form-row">
      <div class="field">
        <label for="f-category">Kategorie</label>
        <select id="f-category" v-model="model.category">
          <option v-for="c in CATEGORIES" :key="c" :value="c">{{ CATEGORY_LABELS[c] }}</option>
        </select>
      </div>
      <div class="field">
        <label for="f-difficulty">Obtížnost</label>
        <select id="f-difficulty" v-model="model.cookTimeDifficulty">
          <option v-for="d in DIFFICULTIES" :key="d" :value="d">{{ DIFFICULTY_LABELS[d] }}</option>
        </select>
      </div>
    </div>
    <div class="form-row">
      <div class="field">
        <label for="f-time">Čas (min)</label>
        <input id="f-time" v-model.number="model.cookTime" type="number" min="0" required />
      </div>
      <div class="field">
        <label for="f-servings">Porce</label>
        <input id="f-servings" v-model="model.servings" type="text" placeholder="4" />
      </div>
    </div>
  </div>

  <div class="form-section">
    <span class="section-heading">Suroviny</span>
    <div v-for="(_, i) in model.ingredients" :key="i" class="list-edit-row">
      <input v-model="model.ingredients[i]" type="text" placeholder="2 lžíce hladké mouky" />
      <button type="button" class="rm" aria-label="Odebrat surovinu" @click="removeIngredient(i)">✕</button>
    </div>
    <button type="button" class="add-link" @click="addIngredient">+ Přidat surovinu</button>
  </div>

  <div class="form-section">
    <span class="section-heading">Postup</span>
    <div v-for="(_, i) in model.steps" :key="i" class="list-edit-row">
      <input v-model="model.steps[i]" type="text" placeholder="Troubu předehřejte na 200 °C…" />
      <button type="button" class="rm" aria-label="Odebrat krok" @click="removeStep(i)">✕</button>
    </div>
    <button type="button" class="add-link" @click="addStep">+ Přidat krok</button>
  </div>

  <div class="form-section">
    <span class="section-heading">Tagy</span>
    <div class="field">
      <label for="f-tags">Oddělené čárkou</label>
      <input id="f-tags" v-model="tagsText" type="text" placeholder="svátek, rychlovka, vegetariánské" />
    </div>
  </div>
</template>

<style scoped>
.form-section {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.form-row {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 10px;
}

.field {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.field label {
  font-family: 'IBM Plex Mono', ui-monospace, monospace;
  font-size: 10.5px;
  font-weight: 600;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  color: var(--surface-ink-dim);
}

.field input,
.field select,
.list-edit-row input {
  font: 400 14.5px 'IBM Plex Sans', sans-serif;
  padding: 10px 11px;
  border-radius: 8px;
  border: 1px solid var(--rule);
  background: var(--surface);
  color: var(--surface-ink);
}

.field input:focus,
.field select:focus,
.list-edit-row input:focus {
  outline: 2px solid var(--accent);
  outline-offset: 1px;
}

.section-heading {
  font-family: 'IBM Plex Mono', ui-monospace, monospace;
  font-size: 11px;
  font-weight: 600;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--surface-ink-dim);
}

.list-edit-row {
  display: flex;
  align-items: center;
  gap: 6px;
}

.list-edit-row input {
  flex: 1;
}

.rm {
  color: var(--hard);
  font-size: 13px;
  flex: none;
  width: 20px;
  background: none;
  border: none;
  cursor: pointer;
}

.add-link {
  font-family: 'IBM Plex Mono', monospace;
  font-size: 11.5px;
  color: var(--accent);
  align-self: flex-start;
  background: none;
  border: none;
  cursor: pointer;
  padding: 0;
}
</style>
