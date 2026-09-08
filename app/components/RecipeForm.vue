<script setup lang="ts">
import { CATEGORIES, DIFFICULTIES } from '#shared/types/recipe'
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
  <form class="recipe-form" @submit.prevent>
    <label class="field">
      <span>Name</span>
      <input v-model="model.name" type="text" placeholder="Grandma's lasagna" required />
    </label>

    <div class="field-row">
      <label class="field">
        <span>Category</span>
        <select v-model="model.category">
          <option v-for="c in CATEGORIES" :key="c" :value="c">{{ c }}</option>
        </select>
      </label>

      <label class="field">
        <span>Difficulty</span>
        <select v-model="model.cookTimeDifficulty">
          <option v-for="d in DIFFICULTIES" :key="d" :value="d">{{ d }}</option>
        </select>
      </label>
    </div>

    <div class="field-row">
      <label class="field">
        <span>Cook time (minutes)</span>
        <input v-model.number="model.cookTime" type="number" min="0" required />
      </label>

      <label class="field">
        <span>Servings</span>
        <input v-model="model.servings" type="text" placeholder="4" />
      </label>
    </div>

    <fieldset class="field">
      <legend>Ingredients</legend>
      <div class="list-row" v-for="(_, i) in model.ingredients" :key="i">
        <input v-model="model.ingredients[i]" type="text" placeholder="2 cups flour" />
        <button type="button" class="icon-btn" @click="removeIngredient(i)" aria-label="Remove ingredient">✕</button>
      </div>
      <button type="button" class="add-btn" @click="addIngredient">+ Add ingredient</button>
    </fieldset>

    <fieldset class="field">
      <legend>Steps</legend>
      <div class="list-row" v-for="(_, i) in model.steps" :key="i">
        <span class="step-index">{{ i + 1 }}</span>
        <textarea v-model="model.steps[i]" rows="2" placeholder="Preheat oven to 200°C..." />
        <button type="button" class="icon-btn" @click="removeStep(i)" aria-label="Remove step">✕</button>
      </div>
      <button type="button" class="add-btn" @click="addStep">+ Add step</button>
    </fieldset>

    <label class="field">
      <span>Tags (comma separated)</span>
      <input v-model="tagsText" type="text" placeholder="vegetarian, quick, italian" />
    </label>
  </form>
</template>

<style scoped>
.recipe-form {
  display: flex;
  flex-direction: column;
  gap: 16px;
  font-family: ui-sans-serif, system-ui, 'Segoe UI', sans-serif;
}

.field {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.field > span,
fieldset.field > legend {
  font-size: 12px;
  font-weight: 600;
  color: #555;
}

.field-row {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
}

input,
select,
textarea {
  font: inherit;
  font-size: 14px;
  padding: 8px 10px;
  border: 1px solid #d6d0c4;
  border-radius: 6px;
  background: #fff;
  color: #222;
  resize: vertical;
}

input:focus,
select:focus,
textarea:focus {
  outline: 2px solid #c1552c;
  outline-offset: -1px;
}

fieldset {
  border: none;
  padding: 0;
  margin: 0;
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.list-row {
  display: flex;
  align-items: center;
  gap: 6px;
}

.step-index {
  flex: none;
  width: 18px;
  font-size: 12px;
  font-weight: 700;
  color: #8a8072;
  text-align: right;
}

.list-row input,
.list-row textarea {
  flex: 1;
}

.icon-btn {
  flex: none;
  width: 26px;
  height: 26px;
  border: none;
  background: transparent;
  color: #a13f3f;
  cursor: pointer;
  font-size: 13px;
}

.add-btn {
  align-self: flex-start;
  border: 1px dashed #c1552c;
  background: transparent;
  color: #c1552c;
  padding: 6px 10px;
  border-radius: 6px;
  font-size: 13px;
  cursor: pointer;
}

.add-btn:hover {
  background: #fdf1ea;
}
</style>
