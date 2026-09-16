<script setup lang="ts">
import Fuse from 'fuse.js'
import { czechStemLight } from '#shared/utils/czech-stem'
import { SEARCH_KEY_LABELS, parseSearchQuery } from '#shared/utils/search-query'
import { PROMPT_LANGS, PROMPT_LANG_LABELS, buildImportPrompt } from '#shared/utils/import-prompt'
import type { PromptLang } from '#shared/utils/import-prompt'
import type { SearchKey } from '#shared/utils/search-query'
import { CATEGORIES, CATEGORY_LABELS, DIFFICULTIES, DIFFICULTY_LABELS } from '#shared/types/recipe'
import type { Category, Difficulty, Recipe } from '#shared/types/recipe'
import { recipePhotoUrl } from '#shared/utils/recipe-photo'

const { listRecipes, importRecipes } = useRecipes()
const { hasDraft } = useRecipeDraft()
const { data: recipes, pending, refresh } = await useAsyncData('recipes', () => listRecipes())

const search = ref('')
const selectedCategory = ref<Category | null>(null)
const selectedDifficulty = ref<Difficulty | null>(null)
const sortBy = ref<'updated' | 'name' | 'time' | 'difficulty' | 'created-desc' | 'created-asc'>('updated')
type ViewMode = 'cards' | 'list' | 'gallery'
const viewMode = ref<ViewMode>('cards')
const VIEW_MODES: { mode: ViewMode; glyph: string; label: string }[] = [
  { mode: 'cards', glyph: '⊞', label: 'Zobrazit karty' },
  { mode: 'list', glyph: '☰', label: 'Zobrazit seznam' },
  { mode: 'gallery', glyph: '▦', label: 'Zobrazit galerii' },
]
// Picking several recipes to combine into one shopping list (see
// app/pages/shopping-list.vue). Only meaningful in the gallery/list views —
// the cards/carousel view already has its own unrelated single-recipe
// shopping mode (see CardStack.vue) — so switching to "cards" drops it.
const selectMode = ref(false)
const selected = ref(new Set<number>())

watch(viewMode, (mode) => {
  if (mode === 'cards') {
    selectMode.value = false
    selected.value = new Set()
  }
})

function toggleSelectMode() {
  selectMode.value = !selectMode.value
  if (!selectMode.value) selected.value = new Set()
}

function onRecipeTileClick(id: number, e: MouseEvent) {
  if (!selectMode.value) return
  e.preventDefault()
  const next = new Set(selected.value)
  if (next.has(id)) next.delete(id)
  else next.add(id)
  selected.value = next
}

function goToShoppingList() {
  navigateTo(`/shopping-list?ids=${[...selected.value].join(',')}`)
}

const categoryMenuOpen = ref(false)
const categoryMenuRef = ref<HTMLElement | null>(null)
const difficultyMenuOpen = ref(false)
const difficultyMenuRef = ref<HTMLElement | null>(null)
const importInputRef = ref<HTMLInputElement | null>(null)
const promptMenuOpen = ref(false)
const promptMenuRef = ref<HTMLElement | null>(null)
const importing = ref(false)
const importMsg = ref('')

function onDocumentClick(e: MouseEvent) {
  const target = e.target as Node
  if (categoryMenuOpen.value && categoryMenuRef.value && !categoryMenuRef.value.contains(target)) {
    categoryMenuOpen.value = false
  }
  if (difficultyMenuOpen.value && difficultyMenuRef.value && !difficultyMenuRef.value.contains(target)) {
    difficultyMenuOpen.value = false
  }
  if (promptMenuOpen.value && promptMenuRef.value && !promptMenuRef.value.contains(target)) {
    promptMenuOpen.value = false
  }
}

// Read in onMounted, not at setup: the draft lives in localStorage, which
// SSR can't see, and rendering the hint server-side would mismatch.
const hasPendingDraft = ref(false)

onMounted(() => {
  document.addEventListener('click', onDocumentClick)
  hasPendingDraft.value = hasDraft()
})
onUnmounted(() => document.removeEventListener('click', onDocumentClick))

// Czech declines nouns/adjectives across cases ("mouka"/"mouky"/"moukou"),
// so plain substring/fuzzy matching on raw text misses most real searches.
// Stemming each word first (before stripping diacritics — the stemmer's
// suffix rules rely on them) collapses those forms to a shared stem, applied
// identically to both indexed text and the live query below. Usernames
// aren't Czech words, so the author field skips the stemmer.
function normalize(s: string, { stem = true } = {}) {
  const words = s
    .toLowerCase()
    .split(/[\s,;.()]+/)
    .filter(Boolean)
    .map((word) => (stem ? czechStemLight(word) : word))
    .join(' ')
  return words.normalize('NFD').replace(/[̀-ͯ]/g, '')
}

interface SearchableRecipe extends Recipe {
  _searchName: string
  _searchIngredients: string[]
  _searchTags: string[]
  _searchAuthor: string
}

// Which Fuse key a "key:" prefix restricts the search to (see
// shared/utils/search-query.ts); no prefix searches all of them.
const SEARCH_FIELDS: Record<SearchKey, keyof SearchableRecipe> = {
  name: '_searchName',
  ingredient: '_searchIngredients',
  tag: '_searchTags',
  author: '_searchAuthor',
}

const fuse = computed(() => {
  const list: SearchableRecipe[] = (recipes.value ?? []).map((r) => ({
    ...r,
    _searchName: normalize(r.name),
    _searchIngredients: r.ingredients.map((i) => normalize(i)),
    _searchTags: r.tags.map((t) => normalize(t)),
    _searchAuthor: normalize(r.author, { stem: false }),
  }))
  return new Fuse(list, {
    keys: Object.values(SEARCH_FIELDS),
    threshold: 0.35,
    ignoreLocation: true,
  })
})

const parsedSearch = computed(() => parseSearchQuery(search.value))
const searchKey = computed(() => parsedSearch.value.key)

const searched = computed<Recipe[]>(() => {
  const { key, term } = parsedSearch.value
  const q = normalize(term, { stem: key !== 'author' })
  if (!q) return recipes.value ?? []
  // Fuse's object-form query restricts matching to a single key.
  const query = key ? { [SEARCH_FIELDS[key]]: q } : q
  return fuse.value.search(query).map((r) => r.item)
})

const filtered = computed(() =>
  searched.value.filter((r) => {
    const matchesCategory = !selectedCategory.value || r.category === selectedCategory.value
    const matchesDifficulty = !selectedDifficulty.value || r.cookTimeDifficulty === selectedDifficulty.value
    return matchesCategory && matchesDifficulty
  }),
)

const DIFFICULTY_ORDER: Record<Difficulty, number> = { Easy: 0, Medium: 1, Hard: 2 }

const sorted = computed(() => {
  const list = [...filtered.value]
  switch (sortBy.value) {
    case 'name':
      return list.sort((a, b) => a.name.localeCompare(b.name, 'cs'))
    case 'time':
      return list.sort((a, b) => a.cookTime - b.cookTime)
    case 'difficulty':
      return list.sort((a, b) => DIFFICULTY_ORDER[a.cookTimeDifficulty] - DIFFICULTY_ORDER[b.cookTimeDifficulty])
    case 'created-desc':
      return list.sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    case 'created-asc':
      return list.sort((a, b) => a.createdAt.localeCompare(b.createdAt))
    case 'updated':
    default:
      return list.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
  }
})

function selectCategory(category: Category | null) {
  selectedCategory.value = category === selectedCategory.value ? null : category
  categoryMenuOpen.value = false
}

function selectDifficulty(difficulty: Difficulty | null) {
  selectedDifficulty.value = difficulty === selectedDifficulty.value ? null : difficulty
  difficultyMenuOpen.value = false
}

function triggerImport() {
  importMsg.value = ''
  importInputRef.value?.click()
}

async function onImportFileChange(e: Event) {
  const input = e.target as HTMLInputElement
  const file = input.files?.[0]
  // Reset so picking the same file again still fires a change event.
  input.value = ''
  if (!file) return

  importing.value = true
  importMsg.value = ''
  try {
    const parsed = JSON.parse(await file.text())
    const result = await importRecipes(Array.isArray(parsed) ? parsed : [parsed])
    await refresh()
    const parts: string[] = []
    if (result.created.length) parts.push(`Naimportováno: ${result.created.length}`)
    if (result.skipped.length) parts.push(`Přeskočeno: ${result.skipped.map((s) => s.name).join(', ')}`)
    importMsg.value = parts.join(' · ')
  } catch (err) {
    const error = err as { data?: { statusMessage?: string } }
    importMsg.value = error?.data?.statusMessage || 'Import se nezdařil, soubor není platný JSON recept.'
  } finally {
    importing.value = false
  }
}

// Copies the LLM prompt (see shared/utils/import-prompt.ts), in the
// instruction language the user picks, so they can paste it into whatever
// chat model they use along with a recipe from the web, then bring the
// resulting JSON back through the ⬆ import button. The toast spells that
// round trip out, since the button alone can't.
const promptToast = ref('')
let promptToastTimer: ReturnType<typeof setTimeout> | null = null

function showPromptToast(message: string) {
  promptToast.value = message
  if (promptToastTimer) clearTimeout(promptToastTimer)
  promptToastTimer = setTimeout(dismissPromptToast, 8000)
}

function dismissPromptToast() {
  promptToast.value = ''
  if (promptToastTimer) clearTimeout(promptToastTimer)
}

onUnmounted(dismissPromptToast)

// The home server is typically reached over plain http on the LAN, where
// navigator.clipboard is undefined (secure contexts only) — fall back to
// the legacy selection-based copy there.
function copyText(text: string): Promise<boolean> {
  if (navigator.clipboard?.writeText) {
    return navigator.clipboard.writeText(text).then(
      () => true,
      () => false,
    )
  }
  // Not readonly, and the range is set explicitly: iOS Safari ignores
  // select() on a readonly textarea, then execCommand still reports success.
  const area = document.createElement('textarea')
  area.value = text
  area.setAttribute('aria-hidden', 'true')
  area.style.position = 'fixed'
  area.style.opacity = '0'
  document.body.appendChild(area)
  area.focus()
  area.select()
  area.setSelectionRange(0, text.length)
  let ok = false
  try {
    ok = document.execCommand('copy')
  } finally {
    area.remove()
  }
  return Promise.resolve(ok)
}

async function copyImportPrompt(lang: PromptLang) {
  promptMenuOpen.value = false
  const ok = await copyText(buildImportPrompt(lang))
  showPromptToast(
    ok
      ? 'Prompt zkopírován. Vložte ho do ChatGPT, Claude nebo jiné AI, za něj přidejte recept z webu a výsledný JSON nahrajte tlačítkem ⬆.'
      : 'Kopírování do schránky se nezdařilo. Zkuste to znovu nebo použijte jiný prohlížeč.',
  )
}
</script>

<template>
  <div class="list-page">
    <div class="search-wrap">
      <div class="search-row">
        <div class="search-field" :class="{ keyed: !!searchKey }">
          <input
            v-model="search"
            class="search-input"
            type="search"
            placeholder="Hledat… nebo autor:, tag:, ingredience:"
          />
          <span v-if="searchKey" class="search-key" aria-live="polite">{{ SEARCH_KEY_LABELS[searchKey] }}</span>
        </div>
        <div ref="categoryMenuRef" class="filter-menu">
          <button
            type="button"
            class="filter-btn"
            :class="{ active: !!selectedCategory }"
            aria-label="Filtrovat podle kategorie"
            @click="categoryMenuOpen = !categoryMenuOpen"
          >
            🏷️
          </button>
          <div v-if="categoryMenuOpen" class="filter-dropdown">
            <button
              type="button"
              class="filter-option"
              :class="{ active: !selectedCategory }"
              @click="selectCategory(null)"
            >
              Vše
            </button>
            <button
              v-for="category in CATEGORIES"
              :key="category"
              type="button"
              class="filter-option"
              :class="{ active: selectedCategory === category }"
              @click="selectCategory(category)"
            >
              {{ CATEGORY_LABELS[category] }}
            </button>
          </div>
        </div>
        <div ref="difficultyMenuRef" class="filter-menu">
          <button
            type="button"
            class="filter-btn"
            :class="{ active: !!selectedDifficulty }"
            aria-label="Filtrovat podle obtížnosti"
            @click="difficultyMenuOpen = !difficultyMenuOpen"
          >
            🎚️
          </button>
          <div v-if="difficultyMenuOpen" class="filter-dropdown">
            <button
              type="button"
              class="filter-option"
              :class="{ active: !selectedDifficulty }"
              @click="selectDifficulty(null)"
            >
              Vše
            </button>
            <button
              v-for="difficulty in DIFFICULTIES"
              :key="difficulty"
              type="button"
              class="filter-option"
              :class="{ active: selectedDifficulty === difficulty }"
              @click="selectDifficulty(difficulty)"
            >
              <span class="dot" :style="{ background: `var(--${difficulty.toLowerCase()})` }" />
              {{ DIFFICULTY_LABELS[difficulty] }}
            </button>
          </div>
        </div>
      </div>
    </div>

    <div class="pill-row">
      <button v-if="selectedCategory" class="pill active" @click="selectCategory(null)">
        {{ CATEGORY_LABELS[selectedCategory] }} <span class="pill-remove">✕</span>
      </button>
      <button v-if="selectedDifficulty" class="pill active" @click="selectDifficulty(null)">
        <span class="dot" :style="{ background: `var(--${selectedDifficulty.toLowerCase()})` }" />
        {{ DIFFICULTY_LABELS[selectedDifficulty] }} <span class="pill-remove">✕</span>
      </button>
    </div>

    <div class="sort-row">
      <span class="count">{{ pending ? 'Načítám…' : `Nalezeno: ${sorted.length}` }}</span>
      <div class="sort-row-actions">
        <label class="sort-by" aria-label="Řadit">
          <span class="sort-icon" aria-hidden="true">↕</span>
          <select v-model="sortBy">
            <option value="updated">naposledy upraveno</option>
            <option value="name">název</option>
            <option value="time">čas přípravy</option>
            <option value="difficulty">obtížnost</option>
            <option value="created-desc">datum vytvoření (nejnovější)</option>
            <option value="created-asc">datum vytvoření (nejstarší)</option>
          </select>
        </label>
        <div class="view-modes" role="group" aria-label="Zobrazení">
          <button
            v-for="view in VIEW_MODES"
            :key="view.mode"
            type="button"
            class="view-mode"
            :class="{ active: viewMode === view.mode }"
            :aria-label="view.label"
            :aria-pressed="viewMode === view.mode"
            @click="viewMode = view.mode"
          >
            {{ view.glyph }}
          </button>
        </div>
        <button
          v-if="viewMode !== 'cards'"
          type="button"
          class="view-toggle"
          :class="{ active: selectMode }"
          aria-label="Vybrat recepty pro nákupní seznam"
          :aria-pressed="selectMode"
          @click="toggleSelectMode"
        >
          🛒
        </button>
        <button
          type="button"
          class="view-toggle"
          aria-label="Nahrát recept z JSON"
          :disabled="importing"
          @click="triggerImport"
        >
          ⬆
        </button>
        <input
          ref="importInputRef"
          type="file"
          accept="application/json"
          hidden
          @change="onImportFileChange"
        />
      </div>
    </div>

    <p v-if="importMsg" class="import-msg">{{ importMsg }}</p>

    <p v-if="!pending && !(recipes ?? []).length" class="empty">
      Nemáte žádné recepty. <NuxtLink to="/recipes/new">Vytvořte první</NuxtLink>.
    </p>
    <p v-else-if="!pending && !sorted.length" class="empty">Žádné recepty neodpovídají hledání ani filtru.</p>

    <div v-else-if="viewMode === 'cards'" class="carousel-wrap">
      <CardStack :recipes="sorted" />
    </div>

    <div v-else-if="viewMode === 'gallery'" class="gallery">
      <NuxtLink
        v-for="recipe in sorted"
        v-slot="{ href, navigate }"
        :key="recipe.id"
        :to="`/recipes/${recipe.id}`"
        custom
      >
        <a
          :href="href"
          class="tile"
          :class="{ 'no-photo': !recipe.photoFile, selected: selectMode && selected.has(recipe.id) }"
          :style="{ '--edge': `var(--${recipe.cookTimeDifficulty.toLowerCase()})` }"
          @click="selectMode ? onRecipeTileClick(recipe.id, $event) : navigate($event)"
        >
          <span v-if="selectMode" class="select-check" :class="{ checked: selected.has(recipe.id) }" aria-hidden="true" />
          <img v-if="recipe.photoFile" :src="recipePhotoUrl(recipe, 'thumb')!" alt="" class="tile-photo" loading="lazy">
          <span class="tile-cap">
            <span class="tile-eyebrow">{{ CATEGORY_LABELS[recipe.category] }}</span>
            <span class="tile-name">{{ recipe.name }}</span>
            <span class="tile-meta">
              {{ recipe.cookTime }} min<template v-if="recipe.servings">
                · {{ recipe.servings }} {{ recipe.servings === '1' ? 'porce' : 'porcí' }}</template>
            </span>
            <span v-if="!recipe.photoFile" class="tile-add">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                <path d="M4 8h3l2-3h6l2 3h3v11H4z" />
                <circle cx="12" cy="13" r="3.2" />
              </svg>
              přidat fotku
            </span>
          </span>
        </a>
      </NuxtLink>
    </div>

    <div v-else class="list">
      <NuxtLink
        v-for="recipe in sorted"
        v-slot="{ href, navigate }"
        :key="recipe.id"
        :to="`/recipes/${recipe.id}`"
        custom
      >
        <a
          :href="href"
          class="row"
          :class="{ selected: selectMode && selected.has(recipe.id) }"
          :style="{ borderLeftColor: `var(--${recipe.cookTimeDifficulty.toLowerCase()})` }"
          @click="selectMode ? onRecipeTileClick(recipe.id, $event) : navigate($event)"
        >
          <span v-if="selectMode" class="select-check" :class="{ checked: selected.has(recipe.id) }" aria-hidden="true" />
          <div class="row-main">
            <div class="row-name">{{ recipe.name }}</div>
            <div class="row-meta">
              <span>{{ CATEGORY_LABELS[recipe.category] }}</span>
              <span>·</span>
              <span>{{ recipe.cookTime }} min</span>
              <span v-if="recipe.servings">·</span>
              <span v-if="recipe.servings">{{ recipe.servings }} {{ recipe.servings === '1' ? 'porce' : 'porcí' }}</span>
            </div>
          </div>
          <span class="row-chevron">›</span>
        </a>
      </NuxtLink>
    </div>

    <div v-if="!pending" class="actions-row">
      <NuxtLink to="/recipes/new" class="new-recipe-btn">
        {{ hasPendingDraft ? '✎ Pokračovat v rozpracovaném receptu' : '+ Nový recept' }}
      </NuxtLink>
      <div ref="promptMenuRef" class="prompt-menu">
        <button
          type="button"
          class="prompt-btn"
          :class="{ active: promptMenuOpen }"
          aria-label="Zkopírovat prompt pro AI, který převede recept z webu na JSON k nahrání"
          title="Zkopírovat prompt pro AI"
          aria-haspopup="menu"
          :aria-expanded="promptMenuOpen"
          @click="promptMenuOpen = !promptMenuOpen"
        >
          ✨
        </button>
        <div v-if="promptMenuOpen" class="filter-dropdown prompt-dropdown" role="menu">
          <span class="prompt-dropdown-title">Jazyk instrukcí pro AI</span>
          <button
            v-for="lang in PROMPT_LANGS"
            :key="lang"
            type="button"
            class="filter-option"
            role="menuitem"
            @click="copyImportPrompt(lang)"
          >
            {{ PROMPT_LANG_LABELS[lang] }}
          </button>
        </div>
      </div>
    </div>

    <InfoToast v-if="promptToast" :message="promptToast" @dismiss="dismissPromptToast" />

    <div v-if="selectMode && selected.size" class="selection-bar">
      <span>{{ selected.size }} vybráno</span>
      <button type="button" class="selection-bar-btn" @click="goToShoppingList">
        🛒 Vytvořit nákupní seznam
      </button>
    </div>
  </div>
</template>

<style scoped>
.list-page {
  display: flex;
  flex-direction: column;
  max-width: 640px;
  margin: 0 auto;
}

/* Desktop: the card carousel shows three full-size cards side by side (see
   CardStack's stage), which needs more than the single 640px column. Only
   the carousel gets the extra room — search, filters, the row list and the
   button stay a centered 640px column. */
@media (min-width: 900px) {
  .list-page {
    max-width: 1000px;
  }

  .list-page > :not(.carousel-wrap, .gallery) {
    width: 100%;
    max-width: 640px;
    margin-inline: auto;
  }
}

.search-wrap {
  padding-bottom: 10px;
}

.search-row {
  display: flex;
  gap: 8px;
}

.search-field {
  position: relative;
  flex: 1;
  min-width: 0;
  display: flex;
}

.search-input {
  flex: 1;
  min-width: 0;
  font: 400 14.5px 'IBM Plex Sans', sans-serif;
  padding: 11px 13px;
  border-radius: 8px;
  border: 1px solid var(--line);
  background: var(--bg-raised);
  color: var(--text);
  transition:
    border-color 0.15s ease,
    box-shadow 0.15s ease;
}

/* A recognised "key:" prefix restricts the search to one field — make that
   state unmistakable: accent border, soft glow, and a chip naming the field
   so a typo'd key (which silently falls back to plain search) is visible. */
.search-field.keyed .search-input {
  padding-right: 96px;
  border-color: var(--accent);
  box-shadow: 0 0 0 3px color-mix(in srgb, var(--accent) 22%, transparent);
}

/* The key appears while the user is typing, i.e. focused — the default
   focus ring would paint over the accent border, so the glow doubles as
   the focus indicator in this state. */
.search-field.keyed .search-input:focus {
  outline: none;
  box-shadow: 0 0 0 3px color-mix(in srgb, var(--accent) 38%, transparent);
}

.search-key {
  position: absolute;
  right: 9px;
  top: 50%;
  transform: translateY(-50%);
  font: 600 11px 'IBM Plex Mono', ui-monospace, monospace;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  padding: 3px 8px;
  border-radius: 999px;
  background: var(--accent);
  color: #fdf9f2;
  pointer-events: none;
}

.search-input::placeholder {
  color: var(--text-dim);
  font-family: 'IBM Plex Mono', monospace;
  font-size: 13px;
}

.filter-menu {
  position: relative;
  flex: none;
}

.filter-btn {
  width: 42px;
  height: 100%;
  font-size: 16px;
  border-radius: 8px;
  border: 1px solid var(--line);
  background: var(--bg-raised);
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
}

.filter-btn.active {
  border-color: var(--accent);
}

.filter-dropdown {
  position: absolute;
  top: calc(100% + 6px);
  right: 0;
  min-width: 168px;
  max-height: 280px;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 2px;
  padding: 6px;
  background: var(--surface);
  border: 1px solid var(--rule);
  border-radius: 10px;
  box-shadow: 0 16px 32px -16px rgba(0, 0, 0, 0.4);
  z-index: 20;
}

.filter-option {
  display: flex;
  align-items: center;
  gap: 6px;
  text-align: left;
  font-family: 'IBM Plex Sans', sans-serif;
  font-size: 13.5px;
  padding: 8px 10px;
  border-radius: 6px;
  border: none;
  background: none;
  color: var(--surface-ink);
  cursor: pointer;
}

.filter-option.active {
  background: rgba(184, 80, 42, 0.14);
  color: var(--accent);
  font-weight: 600;
}

.filter-option .dot {
  width: 7px;
  height: 7px;
  border-radius: 50%;
  flex: none;
}

.pill-row {
  display: flex;
  gap: 8px;
  padding-bottom: 14px;
  overflow-x: auto;
}

.pill {
  flex: none;
  font-family: 'IBM Plex Mono', ui-monospace, monospace;
  font-size: 11.5px;
  font-weight: 600;
  padding: 7px 12px;
  border-radius: 999px;
  border: 1px solid var(--line);
  color: var(--text-dim);
  white-space: nowrap;
  display: flex;
  align-items: center;
  gap: 6px;
  background: none;
  cursor: pointer;
}

.pill.active {
  border-color: var(--accent);
  color: var(--text);
  background: rgba(184, 80, 42, 0.16);
}

.pill .dot {
  width: 7px;
  height: 7px;
  border-radius: 50%;
}

.pill-remove {
  font-size: 9px;
  opacity: 0.75;
}

.sort-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  row-gap: 8px;
  padding-bottom: 14px;
  font-family: 'IBM Plex Mono', ui-monospace, monospace;
  font-size: 11.5px;
}

.count {
  color: var(--text-dim);
}

.sort-row-actions {
  display: flex;
  align-items: center;
  gap: 10px;
}

.view-toggle {
  width: 28px;
  height: 28px;
  font-size: 14px;
  border-radius: 8px;
  border: 1px solid var(--line);
  background: var(--bg-raised);
  color: var(--text);
  cursor: pointer;
  padding: 0;
  display: flex;
  align-items: center;
  justify-content: center;
}

.view-toggle.active {
  border-color: var(--accent);
  background: rgba(184, 80, 42, 0.16);
}

.view-modes {
  display: flex;
  border: 1px solid var(--line);
  border-radius: 8px;
  background: var(--bg-raised);
  overflow: hidden;
}

.view-mode {
  width: 28px;
  height: 28px;
  font-size: 14px;
  border: none;
  background: transparent;
  color: var(--text-dim);
  cursor: pointer;
  padding: 0;
  display: flex;
  align-items: center;
  justify-content: center;
}

.view-mode.active {
  background: var(--accent);
  color: #fdf9f2;
}

.sort-by {
  display: flex;
  align-items: center;
  gap: 6px;
  color: var(--text);
}

.sort-icon {
  font-size: 13px;
}

.sort-by select {
  font: 600 11.5px 'IBM Plex Mono', ui-monospace, monospace;
  background: var(--bg-raised);
  color: var(--text);
  border: 1px solid var(--line);
  border-radius: 6px;
  padding: 5px 8px;
}

.import-msg {
  font-family: 'IBM Plex Mono', ui-monospace, monospace;
  font-size: 11.5px;
  color: var(--text-dim);
  padding-bottom: 10px;
}

.empty {
  color: var(--text-dim);
  padding: 40px 0;
  text-align: center;
}

.list {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.row {
  background: var(--surface);
  border-radius: 14px;
  padding: 13px 14px 13px 16px;
  display: flex;
  align-items: center;
  gap: 12px;
  border-left: 4px solid var(--medium);
  text-decoration: none;
}

.row.selected {
  outline: 2px solid var(--accent);
  outline-offset: -2px;
}

/* Select-mode checkbox: purely visual, the whole tile/row's click handler
   (onRecipeTileClick) is what actually toggles selection. */
.select-check {
  flex: none;
  width: 18px;
  height: 18px;
  border-radius: 5px;
  border: 1.5px solid var(--accent);
  background: var(--surface);
}

.row .select-check {
  display: grid;
  place-content: center;
}

.select-check.checked {
  background: var(--accent);
}

.select-check.checked::before {
  content: '';
  width: 9px;
  height: 9px;
  background: #fdf9f2;
  clip-path: polygon(14% 44%, 0 65%, 50% 100%, 100% 16%, 80% 0%, 43% 62%);
}

.row-main {
  flex: 1;
  min-width: 0;
}

.row-name {
  font-family: 'Fraunces', Georgia, serif;
  font-weight: 600;
  font-size: 17px;
  color: var(--surface-ink);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.row-meta {
  font-family: 'IBM Plex Mono', ui-monospace, monospace;
  font-size: 12px;
  color: var(--surface-ink-dim);
  margin-top: 3px;
  display: flex;
  gap: 6px;
  align-items: center;
}

.row-chevron {
  color: var(--surface-ink-dim);
  font-size: 17px;
  flex: none;
}

/* Gallery: photo tiles that rhyme with the list rows — same 14px radius,
   same difficulty-coloured left edge — with the caption over a bottom
   gradient. Recipes without a photo stay in the grid as paper tiles so the
   gallery is the full collection, not just the photographed part. */
.gallery {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 10px;
}

.tile {
  --edge: var(--medium);
  position: relative;
  display: flex;
  flex-direction: column;
  justify-content: flex-end;
  aspect-ratio: 4 / 3;
  border-radius: 14px;
  overflow: hidden;
  background: var(--surface);
  border-left: 4px solid var(--edge);
  text-decoration: none;
}

.tile-photo {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.tile-cap {
  position: relative;
  display: flex;
  flex-direction: column;
  gap: 3px;
  padding: 34px 12px 12px;
  background: linear-gradient(to top, rgba(28, 22, 18, 0.82), rgba(28, 22, 18, 0));
}

.tile-eyebrow {
  font-family: 'IBM Plex Mono', ui-monospace, monospace;
  font-size: 9px;
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: rgba(253, 249, 242, 0.78);
}

.tile-name {
  font-family: 'Fraunces', Georgia, serif;
  font-weight: 600;
  font-size: 15px;
  line-height: 1.15;
  color: #fdf9f2;
}

.tile-meta {
  font-family: 'IBM Plex Mono', ui-monospace, monospace;
  font-size: 11px;
  color: rgba(253, 249, 242, 0.78);
}

.tile.selected {
  outline: 3px solid var(--accent);
  outline-offset: -3px;
}

.tile .select-check {
  position: absolute;
  top: 8px;
  right: 8px;
  z-index: 1;
  display: grid;
  place-content: center;
  box-shadow: 0 2px 6px rgba(0, 0, 0, 0.35);
}

.tile.no-photo {
  justify-content: center;
}

.tile.no-photo .tile-cap {
  align-items: center;
  text-align: center;
  padding: 12px;
  background: none;
}

.tile.no-photo .tile-name {
  color: var(--surface-ink);
}

.tile.no-photo .tile-eyebrow,
.tile.no-photo .tile-meta {
  color: var(--surface-ink-dim);
}

.tile-add {
  margin-top: 8px;
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-family: 'IBM Plex Mono', ui-monospace, monospace;
  font-size: 10.5px;
  color: var(--accent);
}

/* Like the carousel, the gallery gets the full 1000px desktop column. */
@media (min-width: 900px) {
  .gallery {
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: 14px;
  }

  .tile-name {
    font-size: 17px;
  }
}

.actions-row {
  display: flex;
  gap: 8px;
  margin-top: 18px;
}

.new-recipe-btn {
  flex: 1;
  min-width: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 13px;
  border-radius: 10px;
  background: var(--accent);
  color: #fdf9f2;
  text-decoration: none;
  font-family: 'IBM Plex Sans', sans-serif;
  font-weight: 600;
  font-size: 15px;
}

.prompt-menu {
  position: relative;
  flex: none;
  display: flex;
}

/* Square companion to the primary button: stretches to its height (13px
   padding + one 15px line ≈ 45px), so the width is pinned to match. */
.prompt-btn {
  width: 45px;
  font-size: 18px;
  border-radius: 10px;
  border: 1px solid var(--line);
  background: var(--bg-raised);
  color: var(--text);
  cursor: pointer;
  padding: 0;
  display: flex;
  align-items: center;
  justify-content: center;
}

.prompt-btn:hover,
.prompt-btn.active {
  border-color: var(--accent);
}

/* The button sits at the bottom of the page, so its menu opens upward. */
.prompt-dropdown {
  top: auto;
  bottom: calc(100% + 6px);
}

.prompt-dropdown-title {
  font-family: 'IBM Plex Mono', ui-monospace, monospace;
  font-size: 10.5px;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  color: var(--surface-ink-dim);
  padding: 6px 10px 4px;
}

.selection-bar {
  position: fixed;
  left: 50%;
  bottom: 24px;
  transform: translateX(-50%);
  z-index: 50;
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 10px 12px 10px 16px;
  background: var(--surface);
  color: var(--surface-ink);
  border: 1px solid var(--rule);
  border-radius: 999px;
  box-shadow: 0 12px 28px -12px rgba(0, 0, 0, 0.5);
  font-family: 'IBM Plex Mono', ui-monospace, monospace;
  font-size: 12px;
}

.selection-bar-btn {
  font-family: 'IBM Plex Sans', sans-serif;
  font-weight: 600;
  font-size: 13.5px;
  padding: 9px 14px;
  border: none;
  border-radius: 999px;
  background: var(--accent);
  color: #fdf9f2;
  cursor: pointer;
  white-space: nowrap;
}
</style>
