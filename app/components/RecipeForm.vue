<script setup lang="ts">
import { CATEGORIES, CATEGORY_LABELS, DIFFICULTIES, DIFFICULTY_LABELS } from '#shared/types/recipe'
import type { RecipeInput } from '#shared/types/recipe'
import { normalizeRecipeName } from '#shared/utils/recipe-name'

const model = defineModel<RecipeInput>({ required: true })

// The photo isn't part of RecipeInput (it's a file, not JSON, and only
// gets persisted after the recipe exists), so it rides beside the model:
// the parent owns the pending file and what to preview, this form only
// picks and clears.
const props = defineProps<{ photoUrl: string | null }>()
const emit = defineEmits<{ photoChange: [file: File | null] }>()

const PHOTO_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp']
const PHOTO_MAX_BYTES = 15 * 1024 * 1024

const photoInputRef = ref<HTMLInputElement | null>(null)
const photoError = ref('')

function pickPhoto() {
  photoInputRef.value?.click()
}

function onPhotoFileChange(e: Event) {
  const input = e.target as HTMLInputElement
  const file = input.files?.[0]
  // Reset so picking the same file again after "Odebrat" still fires change.
  input.value = ''
  if (!file) return
  if (!PHOTO_MIME_TYPES.includes(file.type)) {
    photoError.value = 'Podporované formáty jsou JPEG, PNG a WebP.'
    return
  }
  if (file.size > PHOTO_MAX_BYTES) {
    photoError.value = 'Fotka je příliš velká (max. 15 MB).'
    return
  }
  photoError.value = ''
  emit('photoChange', file)
}

function removePhoto() {
  photoError.value = ''
  emit('photoChange', null)
}

const { listTags } = useRecipes()
// Suggestions only matter once someone is typing, so they're fetched on
// the client after hydration rather than as part of the SSR response.
const { data: existingTags } = useAsyncData('recipe-tags', () => listTags(), { server: false, default: () => [] })

function parseTags(text: string): string[] {
  return text
    .split(',')
    .map((t) => t.trim())
    .filter(Boolean)
}

// The input holds its own text rather than a computed over model.tags:
// while typing "svátek, " the model can only hold ['svátek'], and echoing
// that back would eat the separator mid-keystroke. The two watchers keep
// the text and model.tags in sync in both directions (model changes come
// from the restored draft and from picking a suggestion).
const tagsText = ref(model.value.tags.join(', '))
const tagsFocused = ref(false)

watch(tagsText, (text) => {
  model.value.tags = parseTags(text)
})
watch(
  () => model.value.tags,
  (tags) => {
    if (parseTags(tagsText.value).join(',') !== tags.join(',')) tagsText.value = tags.join(', ')
  },
)

const SUGGESTION_LIMIT = 8

// Splits the field into the tags already entered and the fragment still
// being typed after the last comma. A last segment that already is an
// existing tag counts as entered, not as being typed — so focusing a
// filled-in field still whispers the rest, and picking a chip keeps it.
function splitTyped(text: string) {
  const segments = text.split(',').map((t) => t.trim())
  const last = normalizeRecipeName(segments.at(-1) ?? '')
  const lastIsTag = existingTags.value.some((tag) => normalizeRecipeName(tag) === last)
  return lastIsTag
    ? { entered: segments.filter(Boolean), fragment: '' }
    : { entered: segments.slice(0, -1).filter(Boolean), fragment: last }
}

// Existing tags matching the typed fragment, minus the ones already
// entered. With nothing typed yet, the most-used ones.
const tagSuggestions = computed(() => {
  const { entered, fragment } = splitTyped(tagsText.value)
  const chosen = new Set(entered.map(normalizeRecipeName))
  return existingTags.value
    .filter((tag) => {
      const key = normalizeRecipeName(tag)
      return !chosen.has(key) && key.includes(fragment)
    })
    .slice(0, SUGGESTION_LIMIT)
})

function pickTag(tag: string) {
  const { entered } = splitTyped(tagsText.value)
  // Trailing separator so the next tag can be typed straight away.
  tagsText.value = [...entered, tag].join(', ') + ', '
}

function onTagsBlur() {
  tagsFocused.value = false
  tagsText.value = model.value.tags.join(', ')
}

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
    <span class="section-heading">Fotka</span>
    <input
      ref="photoInputRef"
      type="file"
      accept="image/jpeg,image/png,image/webp"
      capture="environment"
      hidden
      @change="onPhotoFileChange"
    >
    <div v-if="props.photoUrl" class="photo-field">
      <div class="photo-thumb"><img :src="props.photoUrl" alt=""></div>
      <div class="photo-actions">
        <button type="button" class="photo-btn" @click="pickPhoto">Nahradit</button>
        <button type="button" class="photo-btn danger" @click="removePhoto">Odebrat</button>
      </div>
    </div>
    <button v-else type="button" class="photo-drop" @click="pickPhoto">
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
        <path d="M4 8h3l2-3h6l2 3h3v11H4z" />
        <circle cx="12" cy="13" r="3.2" />
      </svg>
      <span class="photo-drop-title">Přidat fotku jídla</span>
      <span class="photo-drop-hint">Vyfotit nebo vybrat z galerie · JPEG, PNG, WebP</span>
    </button>
    <p v-if="photoError" class="photo-error">{{ photoError }}</p>
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
      <input
        id="f-tags"
        v-model="tagsText"
        type="text"
        placeholder="svátek, rychlovka, vegetariánské"
        autocomplete="off"
        @focus="tagsFocused = true"
        @blur="onTagsBlur"
      />
    </div>
    <!-- mousedown.prevent keeps focus in the input so the chips don't
         vanish on blur before the click lands -->
    <div v-if="tagsFocused && tagSuggestions.length" class="tag-suggestions" aria-label="Použité tagy">
      <button
        v-for="tag in tagSuggestions"
        :key="tag"
        type="button"
        class="tag-chip"
        @mousedown.prevent
        @click="pickTag(tag)"
      >
        {{ tag }}
      </button>
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

.tag-suggestions {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.tag-chip {
  font-family: 'IBM Plex Mono', ui-monospace, monospace;
  font-size: 11.5px;
  padding: 5px 10px;
  border-radius: 999px;
  border: 1px dashed var(--rule);
  background: none;
  color: var(--surface-ink-dim);
  cursor: pointer;
}

.tag-chip:hover,
.tag-chip:focus-visible {
  border-style: solid;
  border-color: var(--accent);
  color: var(--accent);
}

.photo-drop {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  padding: 22px 16px;
  border: 1px dashed var(--rule);
  border-radius: 10px;
  background: none;
  color: var(--accent);
  cursor: pointer;
  font-family: 'IBM Plex Sans', sans-serif;
}

.photo-drop:hover,
.photo-drop:focus-visible {
  border-style: solid;
  border-color: var(--accent);
}

.photo-drop-title {
  font-size: 14px;
  font-weight: 600;
  color: var(--surface-ink);
}

.photo-drop-hint {
  font-size: 12px;
  color: var(--surface-ink-dim);
}

.photo-field {
  display: flex;
  gap: 12px;
  align-items: stretch;
}

.photo-thumb {
  width: 112px;
  aspect-ratio: 4 / 3;
  border-radius: 10px;
  overflow: hidden;
  flex: none;
  background: var(--rule);
}

.photo-thumb img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
}

.photo-actions {
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: flex-start;
  gap: 6px;
}

.photo-btn {
  font-family: 'IBM Plex Sans', sans-serif;
  font-size: 13px;
  padding: 7px 12px;
  border-radius: 8px;
  border: 1px solid var(--rule);
  background: transparent;
  color: var(--surface-ink);
  cursor: pointer;
}

.photo-btn:hover {
  border-color: var(--surface-ink-dim);
}

.photo-btn.danger {
  color: var(--hard);
  border-color: var(--hard);
}

.photo-error {
  margin: 0;
  font-size: 13px;
  color: var(--hard);
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
