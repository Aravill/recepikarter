<script setup lang="ts">
import { emptyRecipeInput } from '#shared/types/recipe'
import type { RecipeInput } from '#shared/types/recipe'

const route = useRoute()
const { getRecipeById, createRecipe, updateRecipe, deleteRecipe } = useRecipes()

const isNew = computed(() => route.params.id === 'new')
const recipeId = computed(() => Number(route.params.id))

const { data: existing, error: fetchError } = await useAsyncData(
  () => `recipe-${route.params.id}`,
  () => (isNew.value ? Promise.resolve(null) : getRecipeById(recipeId.value)),
)

const form = ref<RecipeInput>(emptyRecipeInput())
if (existing.value) {
  const { id: _id, createdAt: _createdAt, updatedAt: _updatedAt, ...rest } = existing.value
  form.value = rest
}

const side = ref<'front' | 'back'>('front')
const sheetExpanded = ref(isNew.value)
const saving = ref(false)
const deleting = ref(false)
const errorMsg = ref('')

function toggleSheet() {
  sheetExpanded.value = !sheetExpanded.value
}

async function onSave() {
  errorMsg.value = ''
  saving.value = true
  try {
    const payload: RecipeInput = {
      ...form.value,
      ingredients: form.value.ingredients.map((s) => s.trim()).filter(Boolean),
      steps: form.value.steps.map((s) => s.trim()).filter(Boolean),
    }
    if (isNew.value) {
      const created = await createRecipe(payload)
      await navigateTo(`/recipes/${created.id}`)
    } else {
      const updated = await updateRecipe(recipeId.value, payload)
      const { id: _id, createdAt: _createdAt, updatedAt: _updatedAt, ...rest } = updated
      form.value = rest
      sheetExpanded.value = false
    }
  } catch (e) {
    const err = e as { data?: { statusMessage?: string } }
    errorMsg.value = err?.data?.statusMessage || 'Uložení se nezdařilo.'
  } finally {
    saving.value = false
  }
}

async function onDelete() {
  if (!confirm(`Smazat „${form.value.name}“? Tuto akci nelze vrátit zpět.`)) return
  errorMsg.value = ''
  deleting.value = true
  try {
    await deleteRecipe(recipeId.value)
    await navigateTo('/')
  } catch {
    errorMsg.value = 'Smazání se nezdařilo.'
    deleting.value = false
  }
}
</script>

<template>
  <div v-if="fetchError" class="not-found">
    <p>Recept nenalezen.</p>
    <NuxtLink to="/">Zpět na seznam</NuxtLink>
  </div>

  <div v-else class="detail-screen">
    <button class="floating-back" aria-label="Zpět" @click="navigateTo('/')">‹</button>

    <div class="detail-preview">
      <div class="preview-tabs">
        <button :class="{ active: side === 'front' }" @click="side = 'front'">Přední strana</button>
        <button :class="{ active: side === 'back' }" @click="side = 'back'">Zadní strana</button>
      </div>

      <RecipeCard :recipe="form" :side="side" />
    </div>

    <div class="sheet" :class="{ expanded: sheetExpanded }">
      <div class="sheet-handle" @click="toggleSheet">
        <span class="sheet-grabber" />
        <span class="sheet-handle-row">
          <span class="sheet-handle-label">
            <span class="chevron">▴</span>
            {{ isNew ? 'Nový recept' : 'Upravit recept' }}
          </span>
          <span class="sheet-quick-actions">
            <button class="sheet-icon-btn" title="Stáhnout PNG" @click.stop>⬇</button>
            <button class="sheet-icon-btn" title="Tisk" @click.stop>⎙</button>
          </span>
        </span>
      </div>

      <div class="sheet-scroll">
        <p v-if="errorMsg" class="form-error">{{ errorMsg }}</p>
        <RecipeForm v-model="form" />
      </div>

      <div class="sheet-footer">
        <button v-if="!isNew" class="btn btn-danger" :disabled="deleting" @click="onDelete">🗑</button>
        <button class="btn btn-primary" :disabled="saving" @click="onSave">
          {{ saving ? 'Ukládám…' : 'Uložit' }}
        </button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.not-found {
  min-height: 60vh;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 12px;
  color: var(--text-dim);
}

/* Preview fills the screen by default; the sheet (drag/tap up) reveals editing. */
.detail-screen {
  position: relative;
  min-height: 100vh;
  overflow: hidden;
  margin: -18px;
}

.detail-preview {
  position: absolute;
  inset: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  padding-top: 20px;
  gap: 16px;
}

.floating-back {
  position: absolute;
  top: 16px;
  left: 16px;
  width: 34px;
  height: 34px;
  border-radius: 50%;
  background: rgba(36, 31, 26, 0.72);
  border: 1px solid rgba(255, 255, 255, 0.18);
  color: #fdf9f2;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 19px;
  cursor: pointer;
  z-index: 5;
}

.preview-tabs {
  display: flex;
  gap: 6px;
  background: var(--bg-raised);
  border-radius: 8px;
  padding: 3px;
  width: fit-content;
}

.preview-tabs button {
  font-family: 'IBM Plex Mono', ui-monospace, monospace;
  font-size: 11px;
  font-weight: 600;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  padding: 6px 14px;
  border-radius: 6px;
  border: none;
  background: transparent;
  color: var(--text-dim);
  cursor: pointer;
}

.preview-tabs button.active {
  background: var(--accent);
  color: #fdf9f2;
}

.sheet {
  position: absolute;
  left: 0;
  right: 0;
  bottom: 0;
  height: 84px;
  background: var(--surface);
  border-radius: 20px 20px 0 0;
  box-shadow: 0 -16px 32px -20px rgba(0, 0, 0, 0.55);
  display: flex;
  flex-direction: column;
  overflow: hidden;
  transition: height 0.35s cubic-bezier(0.4, 0, 0.2, 1);
  z-index: 4;
}

.sheet.expanded {
  height: min(620px, 82vh);
}

.sheet-handle {
  flex: none;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 10px;
  padding: 12px 18px 13px;
  cursor: pointer;
}

.sheet-grabber {
  width: 38px;
  height: 4px;
  border-radius: 2px;
  background: var(--rule);
}

.sheet-handle-row {
  width: 100%;
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.sheet-handle-label {
  font-family: 'IBM Plex Mono', ui-monospace, monospace;
  font-size: 12px;
  font-weight: 600;
  color: var(--surface-ink);
  display: flex;
  align-items: center;
  gap: 7px;
}

.sheet-handle-label .chevron {
  display: inline-block;
  transition: transform 0.35s ease;
}

.sheet.expanded .sheet-handle-label .chevron {
  transform: rotate(180deg);
}

.sheet-quick-actions {
  display: flex;
  gap: 8px;
}

.sheet-icon-btn {
  width: 32px;
  height: 32px;
  border-radius: 8px;
  border: 1px solid var(--rule);
  background: #fff;
  color: var(--surface-ink);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 15px;
  cursor: pointer;
}

.sheet-scroll {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  padding: 2px 18px 18px;
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.form-error {
  margin: 0;
  font-size: 13px;
  color: var(--hard);
}

.sheet-footer {
  flex: none;
  display: flex;
  gap: 8px;
  padding: 12px 18px calc(12px + env(safe-area-inset-bottom, 0px));
  border-top: 1px solid var(--rule);
}

.sheet-footer .btn {
  flex: 1;
  text-align: center;
  font-family: 'IBM Plex Sans', sans-serif;
  font-weight: 600;
  font-size: 14px;
  border: none;
  border-radius: 8px;
  padding: 11px 16px;
  cursor: pointer;
}

.sheet-footer .btn:disabled {
  opacity: 0.6;
  cursor: default;
}

.sheet-footer .btn-primary {
  background: var(--accent);
  color: #fdf9f2;
}

.sheet-footer .btn-danger {
  flex: none;
  width: 44px;
  background: transparent;
  color: var(--hard);
  border: 1px solid var(--hard);
}

/* Desktop: edit panel and preview sit side by side instead of the mobile
   drag-up sheet over a full-screen preview. Same markup either way — this
   swaps the two panels from an absolute-positioned stack into a two-column
   grid, which makes the sheet's expand/collapse state irrelevant (it's
   always fully shown), so no script changes are needed. */
@media (min-width: 900px) {
  .detail-screen {
    position: static;
    min-height: auto;
    overflow: visible;
    margin: 0 auto;
    max-width: 900px;
    display: grid;
    grid-template-columns: 1fr 280px;
    grid-template-rows: auto 1fr;
    align-items: start;
    gap: 16px 32px;
    padding: 32px 0 56px;
  }

  /* Explicit grid-row on every item: without it, grid's default sparse
     packing would push the sheet (column 1) to row 2, since it comes after
     the preview (column 2) in DOM order and packing doesn't backfill an
     earlier column once the placement cursor has moved past it. */
  .floating-back {
    grid-column: 1 / -1;
    grid-row: 1;
    position: static;
    justify-self: start;
  }

  .detail-preview {
    grid-column: 2;
    grid-row: 2;
    position: sticky;
    inset: auto;
    top: 32px;
    padding-top: 0;
  }

  .sheet {
    grid-column: 1;
    grid-row: 2;
    position: static;
    height: auto;
    border-radius: 14px;
    border: 1px solid var(--rule);
    box-shadow: none;
  }

  .sheet-handle {
    cursor: default;
  }

  .sheet-grabber,
  .sheet-handle-label .chevron {
    display: none;
  }
}
</style>
