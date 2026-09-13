<script setup lang="ts">
import { emptyRecipeInput } from '#shared/types/recipe'
import type { RecipeInput } from '#shared/types/recipe'
import { recipePhotoUrl } from '#shared/utils/recipe-photo'

const route = useRoute()
const { getRecipeById, createRecipe, updateRecipe, deleteRecipe, markExported, uploadPhoto, deletePhoto } =
  useRecipes()
const { loadDraft, saveDraft, clearDraft, isDraftEmpty } = useRecipeDraft()

const isNew = computed(() => route.params.id === 'new')
const recipeId = computed(() => Number(route.params.id))

const { data: existing, error: fetchError } = await useAsyncData(
  () => `recipe-${route.params.id}`,
  () => (isNew.value ? Promise.resolve(null) : getRecipeById(recipeId.value)),
)

const form = ref<RecipeInput>(emptyRecipeInput())
if (existing.value) {
  const {
    id: _id,
    createdAt: _createdAt,
    updatedAt: _updatedAt,
    lastExportedAt: _lastExportedAt,
    photoFile: _photoFile,
    ...rest
  } = existing.value
  form.value = rest
}

// The photo is saved with the rest of the form, not the moment it's
// picked: until "Uložit" the file only lives here (a new recipe has no id
// to upload against yet, and this keeps one rule for every field). It's
// deliberately not part of the localStorage draft — a File can't be.
const pendingPhoto = ref<File | null>(null)
const pendingPhotoUrl = ref<string | null>(null)
const photoRemoved = ref(false)
// Set by the create flow when the recipe saved but its photo didn't, read
// by the recipe's page after the redirect so the failure isn't silent.
const photoUploadFailed = useState('photo-upload-failed', () => false)

const photoUrl = computed(() => {
  if (pendingPhoto.value) return pendingPhotoUrl.value
  if (photoRemoved.value || !existing.value) return null
  return recipePhotoUrl(existing.value, 'full')
})

function onPhotoChange(file: File | null) {
  if (pendingPhotoUrl.value) URL.revokeObjectURL(pendingPhotoUrl.value)
  pendingPhoto.value = file
  pendingPhotoUrl.value = file ? URL.createObjectURL(file) : null
  photoRemoved.value = !file
}

function resetPhotoState() {
  onPhotoChange(null)
  photoRemoved.value = false
}

const side = ref<'front' | 'back'>('front')
const sheetExpanded = ref(isNew.value)
// 'saved' briefly shows a checkmark on the save button before the sheet
// collapses (edit) or the page navigates to the new recipe (create), so
// a successful save is visible rather than just the label flipping back.
const saveState = ref<'idle' | 'saving' | 'saved'>('idle')
const SAVED_FEEDBACK_MS = 1100
let savedTimer: ReturnType<typeof setTimeout> | null = null
const deleting = ref(false)
const exporting = ref(false)
const errorMsg = ref('')
const flipCardRef = ref<{ frontEl: HTMLElement | null; backEl: HTMLElement | null } | null>(null)

// Autosave the new-recipe form so a closed tab or a stray back click
// doesn't lose it. Only for new recipes: an edit already has the saved
// row to fall back on, and a stale edit draft could silently overwrite
// changes made from another device.
const draftRestored = ref(false)
const draftDirty = computed(() => isNew.value && !isDraftEmpty(form.value))
let draftToastTimer: ReturnType<typeof setTimeout> | null = null

// The toast sits over the sheet footer on mobile, so it has to go away on
// its own rather than block the save button until someone dismisses it.
function dismissDraftToast() {
  draftRestored.value = false
  if (draftToastTimer) clearTimeout(draftToastTimer)
}

onMounted(() => {
  if (photoUploadFailed.value) {
    photoUploadFailed.value = false
    errorMsg.value = 'Recept je uložený, ale fotku se nepodařilo nahrát. Zkuste ji přidat znovu.'
  }
  if (!isNew.value) return
  const draft = loadDraft()
  if (draft) {
    form.value = draft
    draftRestored.value = true
    draftToastTimer = setTimeout(dismissDraftToast, 6000)
  }
})

onUnmounted(() => {
  if (draftToastTimer) clearTimeout(draftToastTimer)
  if (savedTimer) clearTimeout(savedTimer)
  if (pendingPhotoUrl.value) URL.revokeObjectURL(pendingPhotoUrl.value)
})

watch(
  form,
  (value) => {
    if (isNew.value) saveDraft(value)
  },
  { deep: true },
)

function onDiscardDraft() {
  if (!confirm('Zahodit rozpracovaný recept?')) return
  form.value = emptyRecipeInput()
  clearDraft()
  dismissDraftToast()
}

function toggleSheet() {
  sheetExpanded.value = !sheetExpanded.value
}

function setSide(next: 'front' | 'back') {
  side.value = next
}

async function onExportPng() {
  const frontEl = flipCardRef.value?.frontEl
  const backEl = flipCardRef.value?.backEl
  if (!frontEl || !backEl) return
  errorMsg.value = ''
  exporting.value = true
  try {
    await exportCardPng(frontEl, backEl, form.value.name)
    // Only a saved recipe has an id to record against; a new, unsaved one
    // has nothing in the DB yet to mark.
    if (!isNew.value) await markExported(recipeId.value)
  } catch {
    errorMsg.value = 'Export obrázku se nezdařil.'
  } finally {
    exporting.value = false
  }
}

function onExportJson() {
  exportRecipeJson(form.value)
}

function onPrint() {
  window.print()
}

async function onSave() {
  errorMsg.value = ''
  saveState.value = 'saving'
  try {
    const payload: RecipeInput = {
      ...form.value,
      ingredients: form.value.ingredients.map((s) => s.trim()).filter(Boolean),
      steps: form.value.steps.map((s) => s.trim()).filter(Boolean),
    }
    if (isNew.value) {
      const created = await createRecipe(payload)
      // The recipe exists now, so a failed upload must not fail the save
      // (retrying would create a duplicate) — flag it for the redirect.
      if (pendingPhoto.value) {
        await uploadPhoto(created.id, pendingPhoto.value).catch(() => {
          photoUploadFailed.value = true
        })
      }
      // The form stays live (and the draft watcher armed) while the
      // checkmark shows, so clear the draft right before leaving, not now.
      showSaved(() => {
        clearDraft()
        return navigateTo(`/recipes/${created.id}`)
      })
    } else {
      let updated = await updateRecipe(recipeId.value, payload)
      if (pendingPhoto.value) {
        updated = await uploadPhoto(recipeId.value, pendingPhoto.value)
      } else if (photoRemoved.value && existing.value?.photoFile) {
        await deletePhoto(recipeId.value)
        updated = { ...updated, photoFile: null }
      }
      existing.value = updated
      resetPhotoState()
      const {
        id: _id,
        createdAt: _createdAt,
        updatedAt: _updatedAt,
        lastExportedAt: _lastExportedAt,
        photoFile: _photoFile,
        ...rest
      } = updated
      form.value = rest
      showSaved(() => {
        sheetExpanded.value = false
      })
    }
  } catch (e) {
    const err = e as { data?: { statusMessage?: string } }
    errorMsg.value = err?.data?.statusMessage || 'Uložení se nezdařilo.'
    saveState.value = 'idle'
  }
}

// Holds the checkmark on screen for a moment before the follow-up action
// hides the footer (collapse) or leaves the page (navigate).
function showSaved(then: () => unknown) {
  saveState.value = 'saved'
  savedTimer = setTimeout(async () => {
    await then()
    saveState.value = 'idle'
  }, SAVED_FEEDBACK_MS)
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

    <div class="detail-preview" :class="{ 'has-photo': !!photoUrl }">
      <img v-if="photoUrl" :src="photoUrl" alt="" class="detail-hero">
      <div class="preview-tabs">
        <button :class="{ active: side === 'front' }" @click="setSide('front')">Přední strana</button>
        <button :class="{ active: side === 'back' }" @click="setSide('back')">Zadní strana</button>
      </div>

      <FlipCard ref="flipCardRef" :recipe="form" :side="side" />
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
            <button class="sheet-icon-btn" title="Stáhnout PNG" :disabled="exporting" @click.stop="onExportPng">⬇</button>
            <button class="sheet-icon-btn" title="Stáhnout JSON" @click.stop="onExportJson">{}</button>
            <button class="sheet-icon-btn" title="Tisk" @click.stop="onPrint">⎙</button>
          </span>
        </span>
      </div>

      <div class="sheet-scroll">
        <p v-if="errorMsg" class="form-error">{{ errorMsg }}</p>
        <RecipeForm v-model="form" :photo-url="photoUrl" @photo-change="onPhotoChange" />
      </div>

      <div class="sheet-footer">
        <button v-if="!isNew" class="btn btn-danger" :disabled="deleting" @click="onDelete">🗑</button>
        <button v-if="draftDirty" class="btn btn-danger" title="Zahodit rozpracovaný recept" @click="onDiscardDraft">
          ✕
        </button>
        <button
          class="btn btn-primary"
          :class="{ saved: saveState === 'saved' }"
          :disabled="saveState !== 'idle'"
          :aria-live="saveState === 'idle' ? undefined : 'polite'"
          @click="onSave"
        >
          <span v-if="saveState === 'saving'" class="save-spinner" aria-hidden="true" />
          <span v-else-if="saveState === 'saved'" class="save-check" aria-hidden="true">✓</span>
          {{ saveState === 'saving' ? 'Ukládám…' : saveState === 'saved' ? 'Uloženo' : 'Uložit' }}
        </button>
      </div>
    </div>

    <InfoToast
      v-if="draftRestored"
      message="Obnovili jsme váš rozpracovaný recept. Ukládá se průběžně, dokud ho neuložíte nebo nezahodíte."
      @dismiss="dismissDraftToast"
    />
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

.detail-preview.has-photo {
  padding-top: 0;
}

/* Photo strip above the card. Sized so the card still clears the collapsed
   sheet on a phone: header 49 + strip 140 + gap 16 + tabs 29 + gap 16 +
   card 502 = 752 px, the sheet handle starts at ~760. */
.detail-hero {
  width: 100%;
  height: 140px;
  flex: none;
  object-fit: cover;
  display: block;
  background: var(--bg-raised);
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
  background: var(--surface);
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
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  background: var(--accent);
  color: #fdf9f2;
  transition: background-color 0.2s ease;
}

.sheet-footer .btn-primary.saved,
.sheet-footer .btn-primary.saved:disabled {
  background: var(--easy);
  opacity: 1;
}

.save-spinner {
  width: 14px;
  height: 14px;
  border-radius: 50%;
  border: 2px solid rgba(253, 249, 242, 0.35);
  border-top-color: #fdf9f2;
  animation: save-spin 0.7s linear infinite;
}

.save-check {
  font-size: 15px;
  line-height: 1;
  animation: save-pop 0.35s cubic-bezier(0.2, 1.4, 0.4, 1);
}

@keyframes save-spin {
  to {
    transform: rotate(360deg);
  }
}

@keyframes save-pop {
  from {
    transform: scale(0);
  }
  to {
    transform: scale(1);
  }
}

@media (prefers-reduced-motion: reduce) {
  .save-spinner,
  .save-check {
    animation: none;
  }
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

  .detail-hero {
    width: 280px;
    height: auto;
    aspect-ratio: 4 / 3;
    border-radius: 14px;
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

/* Print just the currently visible card face at true physical size —
   everything else on the page (nav, tabs, edit sheet) is chrome that
   doesn't belong on the printed/laminated card. */
@media print {
  .floating-back,
  .preview-tabs,
  .detail-hero,
  .sheet {
    display: none;
  }

  .detail-screen {
    position: static;
    min-height: 0;
    overflow: visible;
    margin: 0;
    padding: 0;
  }

  .detail-preview {
    position: static;
    padding-top: 0;
  }

  :deep(.flip-card),
  :deep(.flip-inner),
  :deep(.card-preview) {
    width: 71.8mm;
    height: 150.5mm;
    box-shadow: none;
  }
}

@page {
  size: 71.8mm 150.5mm;
  margin: 0;
}
</style>
