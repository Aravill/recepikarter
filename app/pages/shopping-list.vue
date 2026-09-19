<script setup lang="ts">
import { aggregateIngredients } from '#shared/utils/ingredient-parser'
import type { AggregatedIngredient } from '#shared/utils/ingredient-parser'
import { mealPlanShoppingEntries } from '#shared/utils/meal-plan'
import type { ShoppingList, ShoppingListItem } from '#shared/types/shopping-list'

const route = useRoute()
const router = useRouter()
const { user } = useUserSession()
const { listRecipes } = useRecipes()
const { getMealPlan } = useMealPlans()
const {
  listShoppingLists,
  saveShoppingList,
  renameShoppingList,
  setShoppingListShared,
  deleteShoppingList,
  resetShoppingList,
  setShoppingListItemChecked,
} = useShoppingLists()
const { loadDraft, saveDraft, clearDraft } = useShoppingListDraft()

// ---- Ephemeral ?ids=... view: combine several recipes on the fly ----
// Same key as app/pages/index.vue: hits Nuxt's payload cache when arriving
// from there instead of refetching, but still works standalone on a direct
// link or refresh since GET /api/recipes already returns the full table.
const { data: recipes, pending } = await useAsyncData('recipes', () => listRecipes())

const ids = computed<number[]>(() => {
  const raw = route.query.ids
  const str = Array.isArray(raw) ? raw.join(',') : (raw ?? '')
  return str
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
    .map(Number)
    .filter((n) => Number.isFinite(n))
})

// Recipes deleted since the selection was made are silently skipped rather
// than erroring the page.
const selectedRecipes = computed(() => {
  const idSet = new Set(ids.value)
  return (recipes.value ?? []).filter((r) => idSet.has(r.id))
})

// ---- Ephemeral ?plan=... view: a meal plan's slots, summed as authored ----
// Same shape as ?ids= above — a query param survives reload/direct link —
// but sourced from app/pages/meal-plan.vue's "Nákupní seznam z jídelnáře"
// button instead of app/pages/index.vue's cart. Mutually exclusive with
// ?ids= in practice (that button never sets both).
const mealPlanId = computed<number | null>(() => {
  const raw = route.query.plan
  const n = Number(Array.isArray(raw) ? raw[0] : raw)
  return Number.isFinite(n) && n > 0 ? n : null
})

// ---- Unsaved-list draft: survives a closed tab, like a recipe-edit draft
// (see useShoppingListDraft.ts) ----
// Whichever ephemeral view (?ids= or ?plan=) is open gets remembered as the
// draft, so a reopened tab can offer to continue it (see hasPendingDraft
// below) instead of just landing on the saved-lists list. Only the source
// is stored, not the computed items — those are always recomputed live.
watch(
  [ids, mealPlanId],
  ([currentIds, currentPlanId]) => {
    if (currentPlanId) saveDraft({ mealPlanId: currentPlanId })
    else if (currentIds.length) saveDraft({ recipeIds: currentIds })
  },
  { immediate: true },
)

const { data: mealPlanDetail, pending: mealPlanPending } = await useAsyncData(
  'shopping-list-meal-plan',
  () => (mealPlanId.value ? getMealPlan(mealPlanId.value) : Promise.resolve(null)),
  { watch: [mealPlanId] },
)

const mealPlanEntries = computed(() =>
  mealPlanDetail.value ? mealPlanShoppingEntries(mealPlanDetail.value.slots, recipes.value ?? []) : [],
)

const aggregated = computed(() =>
  mealPlanId.value ? aggregateIngredients(mealPlanEntries.value) : aggregateIngredients(selectedRecipes.value),
)

function lineText(item: AggregatedIngredient): string {
  if (item.kind === 'mass' || item.kind === 'volume') return `${item.displayQuantity} ${item.name}`
  return item.displayQuantity ?? item.name
}

// Ticking off items in the ephemeral view is exactly as ephemeral as the
// single-recipe shopping mode in RecipeCard.vue: navigating away forgets it.
// Only a *saved* list's checkmarks persist (see below).
const { items: checked, toggle: toggleChecked } = useToggleSet<string>()

// ---- Saved lists: the tab's landing state, and what "save" produces ----
const {
  data: savedLists,
  pending: savedListsPending,
  refresh: refreshSavedLists,
} = await useAsyncData('shopping-lists', () => listShoppingLists())

// Kept in ?list=<id> rather than plain component state — like ?ids= above,
// this makes an open list survive a reload/direct link instead of silently
// dropping back to the saved-lists landing state.
const openListId = computed<number | null>({
  get() {
    const raw = route.query.list
    const n = Number(Array.isArray(raw) ? raw[0] : raw)
    return Number.isFinite(n) && n > 0 ? n : null
  },
  set(value) {
    router.replace({ query: value ? { list: String(value) } : {} })
  },
})
const openList = computed(() => savedLists.value?.find((l) => l.id === openListId.value) ?? null)
const isOwner = computed(() => !!openList.value && openList.value.ownerUsername === user.value?.username)

function closeOpenList() {
  openListId.value = null
}

// ---- Unsaved-list draft, continued: offering to resume it on landing ----
// Read in onMounted, not at setup: the draft lives in localStorage, which
// SSR can't see, and rendering the hint server-side would mismatch (same
// reasoning as hasPendingDraft in app/pages/index.vue).
const hasPendingDraft = ref(false)
onMounted(() => {
  hasPendingDraft.value = loadDraft() !== null
})

function resumeDraft() {
  const draft = loadDraft()
  if (!draft) return
  const query = 'mealPlanId' in draft ? { plan: String(draft.mealPlanId) } : { ids: draft.recipeIds.join(',') }
  router.push({ path: '/shopping-list', query })
}

function discardDraft() {
  clearDraft()
  hasPendingDraft.value = false
  router.replace({ query: {} })
}

function replaceSavedList(updated: ShoppingList) {
  if (!savedLists.value) return
  savedLists.value = savedLists.value.map((l) => (l.id === updated.id ? updated : l))
}

// No websocket sync (out of scope) — refetching when the tab regains focus
// is enough to pick up another household member's ticks on a shared list,
// or a list they just saved/renamed/shared, without a manual reload.
function onWindowFocus() {
  refreshSavedLists()
}
onMounted(() => window.addEventListener('focus', onWindowFocus))
onUnmounted(() => window.removeEventListener('focus', onWindowFocus))

// ---- Toast (same pattern as app/pages/index.vue's import-prompt toast) ----
const toast = ref('')
let toastTimer: ReturnType<typeof setTimeout> | null = null
function showToast(message: string) {
  toast.value = message
  if (toastTimer) clearTimeout(toastTimer)
  toastTimer = setTimeout(dismissToast, 5000)
}
function dismissToast() {
  toast.value = ''
  if (toastTimer) clearTimeout(toastTimer)
}
onUnmounted(dismissToast)

// ---- Save the ephemeral view under a name ----
const saveFormOpen = ref(false)
const saveName = ref('')
const saving = ref(false)
const saveError = ref('')

function openSaveForm() {
  saveFormOpen.value = true
  saveError.value = ''
  saveName.value = ''
}
function closeSaveForm() {
  saveFormOpen.value = false
  saveError.value = ''
}
async function onSave() {
  const name = saveName.value.trim()
  if (!name) return
  saveError.value = ''
  saving.value = true
  try {
    const created = mealPlanId.value
      ? await saveShoppingList(name, { mealPlanId: mealPlanId.value })
      : await saveShoppingList(name, { recipeIds: ids.value })
    savedLists.value = [created, ...(savedLists.value ?? [])]
    saveFormOpen.value = false
    // The list lives under its own id now — the draft it came from is spent.
    clearDraft()
    hasPendingDraft.value = false
    // Also drops ?ids=/?plan= (the setter replaces the whole query) now that
    // the list lives under its own id — otherwise the ephemeral view would
    // keep showing instead of the list just saved.
    openListId.value = created.id
    showToast('Seznam byl uložen.')
  } catch (e) {
    const err = e as { data?: { statusMessage?: string } }
    saveError.value = err?.data?.statusMessage || 'Uložení se nezdařilo.'
  } finally {
    saving.value = false
  }
}

// ---- Open list actions: toggle items, reset, rename, share, delete ----
async function onToggleSavedItem(item: ShoppingListItem) {
  const list = openList.value
  if (!list) return
  const nextChecked = !item.checked
  // Optimistic local update — reverted below if the persist call fails.
  replaceSavedList({
    ...list,
    items: list.items.map((i) => (i.key === item.key ? { ...i, checked: nextChecked } : i)),
  })
  try {
    replaceSavedList(await setShoppingListItemChecked(list.id, item.key, nextChecked))
  } catch {
    replaceSavedList({
      ...list,
      items: list.items.map((i) => (i.key === item.key ? { ...i, checked: item.checked } : i)),
    })
    showToast('Uložení se nezdařilo, zkuste to znovu.')
  }
}

const resetting = ref(false)
async function onReset() {
  const list = openList.value
  if (!list) return
  resetting.value = true
  try {
    replaceSavedList(await resetShoppingList(list.id))
  } catch {
    showToast('Reset se nezdařil, zkuste to znovu.')
  } finally {
    resetting.value = false
  }
}

const togglingShared = ref(false)
async function onToggleShared() {
  const list = openList.value
  if (!list) return
  togglingShared.value = true
  try {
    replaceSavedList(await setShoppingListShared(list.id, !list.shared))
  } catch {
    showToast('Změna sdílení se nezdařila.')
  } finally {
    togglingShared.value = false
  }
}

const renaming = ref(false)
const renameValue = ref('')
function startRename() {
  const list = openList.value
  if (!list) return
  renameValue.value = list.name
  renaming.value = true
}
function cancelRename() {
  renaming.value = false
}
async function onRename() {
  const list = openList.value
  const name = renameValue.value.trim()
  if (!list || !name) return
  try {
    replaceSavedList(await renameShoppingList(list.id, name))
    renaming.value = false
  } catch {
    showToast('Přejmenování se nezdařilo.')
  }
}

const deletingId = ref<number | null>(null)
async function onDeleteList(list: ShoppingList) {
  if (!confirm(`Smazat seznam „${list.name}“? Tuto akci nelze vrátit zpět.`)) return
  deletingId.value = list.id
  try {
    await deleteShoppingList(list.id)
    savedLists.value = (savedLists.value ?? []).filter((l) => l.id !== list.id)
    if (openListId.value === list.id) openListId.value = null
  } catch {
    showToast('Smazání se nezdařilo.')
  } finally {
    deletingId.value = null
  }
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('cs', { day: 'numeric', month: 'numeric', year: 'numeric' })
}
</script>

<template>
  <div class="shopping-list-page">
    <template v-if="ids.length || mealPlanId">
      <h1>Nákupák</h1>

      <p v-if="pending || mealPlanPending" class="empty">Načítám…</p>
      <p v-else-if="mealPlanId && !aggregated.length" class="empty">Jídelnář nemá žádné naplánované recepty.</p>
      <p v-else-if="!mealPlanId && !selectedRecipes.length" class="empty">Nebyly vybrány žádné recepty.</p>

      <template v-else>
        <p v-if="mealPlanId" class="source-recipes">Z jídelnáře „{{ mealPlanDetail?.plan.name }}“</p>
        <p v-else class="source-recipes">Z receptů: {{ selectedRecipes.map((r) => r.name).join(', ') }}</p>

        <div class="save-row">
          <template v-if="!saveFormOpen">
            <button type="button" class="btn-primary" @click="openSaveForm">Uložit seznam</button>
            <button type="button" class="discard-btn" @click="discardDraft">Zahodit</button>
          </template>
          <form v-else class="save-form" @submit.prevent="onSave">
            <div class="field">
              <label for="sl-name">Název seznamu</label>
              <input id="sl-name" v-model="saveName" type="text" required maxlength="120" autofocus>
            </div>
            <p v-if="saveError" class="form-error">{{ saveError }}</p>
            <div class="form-actions">
              <button type="button" class="btn-secondary" @click="closeSaveForm">Zrušit</button>
              <button type="submit" class="btn-primary" :disabled="saving">
                {{ saving ? 'Ukládám…' : 'Uložit' }}
              </button>
            </div>
          </form>
        </div>

        <ul class="items">
          <li v-for="item in aggregated" :key="item.key" :class="{ checked: checked.has(item.key) }">
            <label class="item-check">
              <input type="checkbox" :checked="checked.has(item.key)" @change="toggleChecked(item.key)">
              <span class="item-text">{{ lineText(item) }}</span>
            </label>
            <p v-if="item.sources.length > 1" class="item-sources">
              z: {{ item.sources.map((s) => `${s.recipeName} (${s.raw})`).join(', ') }}
            </p>
          </li>
        </ul>
      </template>
    </template>

    <template v-else-if="openList">
      <button type="button" class="back-link" @click="closeOpenList">← Uložené seznamy</button>

      <div class="list-title-row">
        <template v-if="renaming">
          <input
            v-model="renameValue"
            type="text"
            class="rename-input"
            maxlength="120"
            autofocus
            @keyup.enter="onRename"
            @keyup.esc="cancelRename"
          >
          <button type="button" class="icon-btn" title="Uložit název" @click="onRename">✓</button>
          <button type="button" class="icon-btn" title="Zrušit přejmenování" @click="cancelRename">✕</button>
        </template>
        <template v-else>
          <h1>{{ openList.name }}</h1>
          <button v-if="isOwner" type="button" class="icon-btn" title="Přejmenovat" @click="startRename">✎</button>
        </template>
        <span v-if="openList.shared" class="badge badge-shared">Sdíleno</span>
      </div>
      <p v-if="!isOwner" class="owner-hint">Vlastník: {{ openList.ownerUsername }}</p>

      <div class="list-actions">
        <button type="button" class="btn-secondary" :disabled="resetting" @click="onReset">
          {{ resetting ? 'Resetuji…' : 'Odškrtnout vše' }}
        </button>
        <button v-if="isOwner" type="button" class="btn-secondary" :disabled="togglingShared" @click="onToggleShared">
          {{ openList.shared ? 'Zrušit sdílení' : 'Sdílet' }}
        </button>
        <button
          v-if="isOwner"
          type="button"
          class="btn-danger"
          :disabled="deletingId === openList.id"
          @click="onDeleteList(openList)"
        >
          {{ deletingId === openList.id ? 'Mažu…' : 'Smazat' }}
        </button>
      </div>

      <ul v-if="openList.items.length" class="items">
        <li v-for="item in openList.items" :key="item.key" :class="{ checked: item.checked }">
          <label class="item-check">
            <input type="checkbox" :checked="item.checked" @change="onToggleSavedItem(item)">
            <span class="item-text">{{ lineText(item) }}</span>
          </label>
          <p v-if="item.sources.length > 1" class="item-sources">
            z: {{ item.sources.map((s) => `${s.recipeName} (${s.raw})`).join(', ') }}
          </p>
        </li>
      </ul>
      <p v-else class="empty">Tento seznam je prázdný.</p>
    </template>

    <template v-else>
      <h1>Nákupák</h1>

      <button v-if="hasPendingDraft" type="button" class="btn-primary resume-draft-btn" @click="resumeDraft">
        ✎ Pokračovat v nedokončeném nákupu
      </button>

      <p v-if="savedListsPending" class="empty">Načítám…</p>
      <p v-else-if="!savedLists?.length" class="empty">
        Zatím nemáte žádné uložené seznamy. Vyberte recepty v Galerii a uložte je jako nákupní seznam.
      </p>
      <ul v-else class="saved-lists">
        <li v-for="list in savedLists" :key="list.id" class="saved-list-row">
          <button type="button" class="saved-list-main" @click="openListId = list.id">
            <span class="saved-list-name">{{ list.name }}</span>
            <span class="saved-list-meta">
              <span>{{ list.items.length }} položek</span>
              <span v-if="list.shared" class="badge badge-shared">Sdíleno</span>
              <span v-if="list.ownerUsername !== user?.username" class="badge">{{ list.ownerUsername }}</span>
              <span class="saved-list-date">{{ formatDate(list.updatedAt) }}</span>
            </span>
          </button>
          <button
            v-if="list.ownerUsername === user?.username"
            type="button"
            class="delete-btn"
            title="Smazat seznam"
            :disabled="deletingId === list.id"
            @click="onDeleteList(list)"
          >
            ✕
          </button>
        </li>
      </ul>
    </template>

    <InfoToast v-if="toast" :message="toast" @dismiss="dismissToast" />
  </div>
</template>

<style scoped>
.shopping-list-page {
  max-width: 640px;
  margin: 0 auto;
}

h1 {
  margin: 0 0 14px;
  font-family: 'Fraunces', Georgia, serif;
  font-weight: 600;
  font-size: 24px;
  color: var(--text);
}

.back-link {
  display: inline-block;
  margin-bottom: 10px;
  font-family: 'IBM Plex Mono', ui-monospace, monospace;
  font-size: 12px;
  color: var(--text-dim);
  text-decoration: none;
  background: none;
  border: none;
  cursor: pointer;
  padding: 0;
}

.empty {
  color: var(--text-dim);
  padding: 40px 0;
  text-align: center;
}

.source-recipes {
  font-family: 'IBM Plex Mono', ui-monospace, monospace;
  font-size: 11.5px;
  color: var(--text-dim);
  padding-bottom: 14px;
}

.save-row {
  display: flex;
  align-items: center;
  gap: 12px;
  padding-bottom: 14px;
}

.discard-btn {
  font-family: 'IBM Plex Sans', sans-serif;
  font-size: 13px;
  color: var(--text-dim);
  background: none;
  border: none;
  cursor: pointer;
  padding: 4px 0;
}

.discard-btn:hover {
  color: var(--hard);
}

.resume-draft-btn {
  display: block;
  width: 100%;
  margin-bottom: 14px;
  text-align: center;
}

.save-form {
  background: var(--surface);
  border-radius: 12px;
  padding: 14px 16px;
  display: flex;
  flex-direction: column;
  gap: 12px;
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
  letter-spacing: 0.06em;
  text-transform: uppercase;
  color: var(--surface-ink-dim);
}

.field input {
  font: 400 15px 'IBM Plex Sans', sans-serif;
  padding: 10px 12px;
  border-radius: 8px;
  border: 1px solid var(--rule);
  background: var(--surface);
  color: var(--surface-ink);
}

.form-error {
  margin: 0;
  font-size: 12.5px;
  color: var(--hard);
}

.form-actions {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
}

.btn-primary {
  font-family: 'IBM Plex Sans', sans-serif;
  font-weight: 600;
  font-size: 13.5px;
  border: none;
  border-radius: 8px;
  padding: 10px 14px;
  background: var(--accent);
  color: #fdf9f2;
  cursor: pointer;
}

.btn-primary:disabled {
  opacity: 0.7;
  cursor: default;
}

.btn-secondary {
  font-family: 'IBM Plex Sans', sans-serif;
  font-weight: 600;
  font-size: 13px;
  border: 1px solid var(--rule);
  border-radius: 8px;
  padding: 9px 12px;
  background: var(--surface);
  color: var(--surface-ink);
  cursor: pointer;
}

.btn-secondary:disabled {
  opacity: 0.6;
  cursor: default;
}

.btn-danger {
  font-family: 'IBM Plex Sans', sans-serif;
  font-weight: 600;
  font-size: 13px;
  border: 1px solid var(--hard);
  border-radius: 8px;
  padding: 9px 12px;
  background: transparent;
  color: var(--hard);
  cursor: pointer;
}

.btn-danger:disabled {
  opacity: 0.6;
  cursor: default;
}

.list-title-row {
  display: flex;
  align-items: center;
  gap: 8px;
}

.list-title-row h1 {
  margin: 0;
  font-size: 22px;
}

.rename-input {
  flex: 1;
  min-width: 0;
  font: 600 20px 'Fraunces', Georgia, serif;
  padding: 6px 10px;
  border-radius: 8px;
  border: 1px solid var(--rule);
  background: var(--surface);
  color: var(--surface-ink);
}

.icon-btn {
  flex: none;
  background: none;
  border: none;
  color: var(--text-dim);
  font-size: 14px;
  cursor: pointer;
  padding: 2px 4px;
}

.icon-btn:hover {
  color: var(--text);
}

.owner-hint {
  margin: 4px 0 10px;
  font-family: 'IBM Plex Mono', ui-monospace, monospace;
  font-size: 11.5px;
  color: var(--text-dim);
}

.list-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  padding: 10px 0 16px;
}

.badge {
  font-family: 'IBM Plex Mono', ui-monospace, monospace;
  font-size: 10.5px;
  font-weight: 600;
  padding: 3px 8px;
  border-radius: 999px;
  background: var(--rule);
  color: var(--surface-ink-dim);
}

.badge-shared {
  background: rgba(184, 80, 42, 0.14);
  color: var(--accent);
}

.items {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.items li {
  background: var(--surface);
  border-radius: 12px;
  padding: 10px 12px;
}

.item-check {
  display: flex;
  align-items: flex-start;
  gap: 10px;
  cursor: pointer;
}

.item-check input {
  appearance: none;
  margin: 2px 0 0;
  flex: none;
  width: 16px;
  height: 16px;
  border-radius: 5px;
  border: 1.5px solid var(--accent);
  background: var(--surface);
  display: grid;
  place-content: center;
  cursor: pointer;
}

.item-check input::before {
  content: '';
  width: 9px;
  height: 9px;
  transform: scale(0);
  transition: transform 0.12s ease-in-out;
  background: var(--accent);
  clip-path: polygon(14% 44%, 0 65%, 50% 100%, 100% 16%, 80% 0%, 43% 62%);
}

.item-check input:checked::before {
  transform: scale(1);
}

.item-check input:focus-visible {
  outline: 2px solid var(--accent);
  outline-offset: 2px;
}

.item-text {
  font-family: 'IBM Plex Sans', sans-serif;
  font-size: 15px;
  color: var(--surface-ink);
}

.items li.checked .item-text {
  color: var(--surface-ink-dim);
  text-decoration: line-through;
}

.item-sources {
  margin: 6px 0 0 26px;
  font-family: 'IBM Plex Mono', ui-monospace, monospace;
  font-size: 10.5px;
  color: var(--surface-ink-dim);
}

.saved-lists {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.saved-list-row {
  display: flex;
  align-items: center;
  gap: 8px;
  background: var(--surface);
  border-radius: 12px;
  padding: 4px;
}

.saved-list-main {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 4px;
  text-align: left;
  background: none;
  border: none;
  cursor: pointer;
  padding: 9px 10px;
  border-radius: 10px;
}

.saved-list-main:hover {
  background: var(--rule);
}

.saved-list-name {
  font-family: 'IBM Plex Sans', sans-serif;
  font-weight: 600;
  font-size: 15px;
  color: var(--surface-ink);
}

.saved-list-meta {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 8px;
  font-family: 'IBM Plex Mono', ui-monospace, monospace;
  font-size: 11px;
  color: var(--surface-ink-dim);
}

.saved-list-date {
  margin-left: auto;
}

.delete-btn {
  flex: none;
  background: none;
  border: none;
  color: var(--surface-ink-dim);
  font-size: 13px;
  cursor: pointer;
  padding: 8px 10px;
}

.delete-btn:hover {
  color: var(--hard);
}

.delete-btn:disabled {
  opacity: 0.6;
  cursor: default;
}
</style>
