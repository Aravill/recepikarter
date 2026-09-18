<script setup lang="ts">
import { MEAL_TYPES, MEAL_TYPE_LABELS, emptyMealPlanInput } from '#shared/types/meal-plan'
import type { MealPlanInput, MealPlanSlot, MealType } from '#shared/types/meal-plan'
import {
  mealPlanBadgeState,
  mealPlanColorIndex,
  mealPlanDateRange,
  mealPlanMissingCount,
  mealPlanSlotKey,
  parseServingsCount,
  remainingPortions,
} from '#shared/utils/meal-plan'
import { normalizeRecipeName } from '#shared/utils/recipe-name'
import type { Recipe } from '#shared/types/recipe'

const route = useRoute()
const router = useRouter()
const { listRecipes } = useRecipes()
const {
  listMealPlans,
  getMealPlan,
  createMealPlan,
  updateMealPlan,
  deleteMealPlan,
  setMealPlanSlot,
  addMealPlanTrayRecipe,
  removeMealPlanTrayRecipe,
} = useMealPlans()

// Same key as app/pages/index.vue and shopping-list.vue — hits Nuxt's
// payload cache when arriving from either of those instead of refetching.
const { data: recipes } = await useAsyncData('recipes', () => listRecipes())
const recipeById = computed(() => new Map((recipes.value ?? []).map((r) => [r.id, r])))

// ---- Landing state: saved plans ----
const { data: plans, pending: plansPending } = await useAsyncData('meal-plans', () => listMealPlans())

// Kept in ?plan=<id>, same pattern as shopping-list.vue's ?list=<id> — an
// open plan survives a reload/direct link instead of dropping back to the
// landing list.
const planId = computed<number | null>({
  get() {
    const raw = route.query.plan
    const n = Number(Array.isArray(raw) ? raw[0] : raw)
    return Number.isFinite(n) && n > 0 ? n : null
  },
  set(value) {
    router.replace({ query: value ? { plan: String(value) } : {} })
  },
})

const {
  data: detail,
  pending: detailPending,
  refresh: refreshDetail,
} = await useAsyncData('meal-plan-detail', () => (planId.value ? getMealPlan(planId.value) : Promise.resolve(null)), {
  watch: [planId],
})

function closePlan() {
  planId.value = null
}

// ---- Toast (same pattern as app/pages/shopping-list.vue) ----
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

// ---- Create a new plan ----
const createFormOpen = ref(false)
const createInput = ref<MealPlanInput>(emptyMealPlanInput())
const creating = ref(false)
const createError = ref('')

function openCreateForm() {
  createInput.value = emptyMealPlanInput()
  createError.value = ''
  createFormOpen.value = true
}
function closeCreateForm() {
  createFormOpen.value = false
  createError.value = ''
}
async function onCreate() {
  createError.value = ''
  creating.value = true
  try {
    const created = await createMealPlan(createInput.value)
    plans.value = [created, ...(plans.value ?? [])]
    createFormOpen.value = false
    planId.value = created.id
  } catch (e) {
    const err = e as { data?: { statusMessage?: string } }
    createError.value = err?.data?.statusMessage || 'Vytvoření se nezdařilo.'
  } finally {
    creating.value = false
  }
}

const deletingId = ref<number | null>(null)
async function onDeletePlan(id: number) {
  if (!confirm('Smazat tento plán? Tuto akci nelze vrátit zpět.')) return
  deletingId.value = id
  try {
    await deleteMealPlan(id)
    plans.value = (plans.value ?? []).filter((p) => p.id !== id)
    if (planId.value === id) planId.value = null
  } catch {
    showToast('Smazání se nezdařilo.')
  } finally {
    deletingId.value = null
  }
}

// ---- Plan meta form ("Uložit plán") ----
const metaForm = ref<MealPlanInput>(emptyMealPlanInput())
const savingMeta = ref(false)
const metaError = ref('')

// Re-seeds the form whenever a different (or freshly loaded) plan opens —
// not a two-way binding straight to `detail`, since edits shouldn't take
// effect until "Uložit plán" is clicked.
watch(
  () => detail.value?.plan,
  (plan) => {
    if (plan) metaForm.value = { name: plan.name, dateStart: plan.dateStart, dateEnd: plan.dateEnd, peopleCount: plan.peopleCount }
  },
  { immediate: true },
)

async function onSaveMeta() {
  if (!planId.value) return
  metaError.value = ''
  savingMeta.value = true
  try {
    await updateMealPlan(planId.value, metaForm.value)
    await refreshDetail()
    showToast('Plán byl uložen.')
  } catch (e) {
    const err = e as { data?: { statusMessage?: string } }
    metaError.value = err?.data?.statusMessage || 'Uložení se nezdařilo.'
  } finally {
    savingMeta.value = false
  }
}

// ---- Calendar grid ----
// A lookup map plus a precomputed row/cell structure, rather than calling
// .find() repeatedly from the template — each cell's markup touches its
// slot's data half a dozen times (classes, style, draggable, drag payload,
// label), and every date × meal_type row is guaranteed to have a slot (see
// syncMealPlanSlots in server/utils/db.ts).
const slotByKey = computed(() => {
  const map = new Map<string, MealPlanSlot>()
  for (const s of detail.value?.slots ?? []) map.set(mealPlanSlotKey(s.date, s.mealType), s)
  return map
})

interface GridCell {
  date: string
  mealType: MealType
  slot: MealPlanSlot
  key: string
}

const gridRows = computed(() => {
  if (!detail.value) return []
  const dates = mealPlanDateRange(detail.value.plan.dateStart, detail.value.plan.dateEnd)
  return dates.map((date) => ({
    date,
    label: formatDateLabel(date),
    cells: MEAL_TYPES.map(
      (mealType): GridCell => ({
        date,
        mealType,
        key: mealPlanSlotKey(date, mealType),
        slot: slotByKey.value.get(mealPlanSlotKey(date, mealType))!,
      }),
    ),
  }))
})

const missing = computed(() =>
  detail.value ? mealPlanMissingCount(detail.value.slots, detail.value.plan.peopleCount) : { slots: 0, portions: 0 },
)

function formatDateLabel(date: string) {
  return new Date(`${date}T00:00:00`).toLocaleDateString('cs', { weekday: 'short', day: 'numeric', month: 'numeric' })
}

function recipeColorStyle(recipeId: number) {
  return { '--slot-accent': `var(--mp-color-${mealPlanColorIndex(recipeId)})` }
}

// Persists one slot's state and merges the result into the already-loaded
// detail locally, instead of a full refresh — every drop should feel
// instant, and a plan's other slots/tray never change as a side effect of
// one drop.
async function persistSlot(date: string, mealType: MealType, patch: { recipeId: number | null; isSkip: boolean }) {
  if (!planId.value || !detail.value) return
  try {
    const updated = await setMealPlanSlot(planId.value, { date, mealType, ...patch })
    const slots = detail.value.slots.map((s) => (s.date === date && s.mealType === mealType ? (updated as MealPlanSlot) : s))
    detail.value = { ...detail.value, slots }
  } catch {
    showToast('Uložení slotu se nezdařilo, zkuste to znovu.')
  }
}

// ---- Drag and drop ----
// Native HTML5 DnD (no library elsewhere in the app to reuse — see
// CLAUDE.md-adjacent design note). A drop payload is one of:
//   { type: 'skip' }                — the always-available skip badge
//   { type: 'recipe', recipeId }    — a tray badge
// draggingFrom tracks a slot-origin drag (as opposed to a tray-origin one)
// so dragend can tell whether "no valid drop happened" should unassign a
// slot (drag out of the grid) — tray badges never get unassigned this way.
const DND_MIME = 'application/x-meal-plan'
type DndPayload = { type: 'skip' } | { type: 'recipe'; recipeId: number }
let draggingFrom: { date: string; mealType: MealType } | null = null
const hoverKey = ref<string | null>(null)

function onTrayDragStart(e: DragEvent, payload: DndPayload) {
  e.dataTransfer?.setData(DND_MIME, JSON.stringify(payload))
  if (e.dataTransfer) e.dataTransfer.effectAllowed = 'copy'
  draggingFrom = null
}

function onSlotDragStart(e: DragEvent, date: string, mealType: MealType, slot: MealPlanSlot) {
  const payload: DndPayload = slot.isSkip ? { type: 'skip' } : { type: 'recipe', recipeId: slot.recipeId! }
  e.dataTransfer?.setData(DND_MIME, JSON.stringify(payload))
  if (e.dataTransfer) e.dataTransfer.effectAllowed = 'move'
  draggingFrom = { date, mealType }
}

// Fires on the drag's source after it ends. dropEffect is 'none' when it
// wasn't released over a valid drop target (a slot cell) — i.e. dropped
// outside the calendar grid entirely, which is this feature's only
// unassign gesture (see the spec: no trash icon/button).
function onSlotDragEnd(e: DragEvent) {
  if (draggingFrom && e.dataTransfer?.dropEffect === 'none') {
    persistSlot(draggingFrom.date, draggingFrom.mealType, { recipeId: null, isSkip: false })
  }
  draggingFrom = null
  hoverKey.value = null
}

function onCellDragOver(e: DragEvent) {
  e.preventDefault()
  if (e.dataTransfer) e.dataTransfer.dropEffect = draggingFrom ? 'move' : 'copy'
}

function onCellDragEnter(key: string) {
  hoverKey.value = key
}

function onCellDragLeave(key: string) {
  if (hoverKey.value === key) hoverKey.value = null
}

function onCellDrop(e: DragEvent, date: string, mealType: MealType) {
  e.preventDefault()
  hoverKey.value = null
  const raw = e.dataTransfer?.getData(DND_MIME)
  if (!raw) return
  const payload = JSON.parse(raw) as DndPayload
  const patch = payload.type === 'skip' ? { recipeId: null, isSkip: true } : { recipeId: payload.recipeId, isSkip: false }
  persistSlot(date, mealType, patch)

  // A slot-to-slot drag moves the assignment — clear the origin too, and
  // suppress onSlotDragEnd's unassign fallback (the drop *did* land on a
  // valid target, dropEffect will read 'move', not 'none').
  if (draggingFrom && (draggingFrom.date !== date || draggingFrom.mealType !== mealType)) {
    persistSlot(draggingFrom.date, draggingFrom.mealType, { recipeId: null, isSkip: false })
  }
  draggingFrom = null
}

// ---- Tray ----
const trayRecipes = computed(() => {
  if (!detail.value) return []
  return detail.value.trayRecipeIds
    .map((id) => recipeById.value.get(id))
    .filter((r): r is Recipe => !!r)
})

const trayBadges = computed(() => {
  if (!detail.value) return []
  const plan = detail.value.plan
  const slots = detail.value.slots
  return trayRecipes.value.map((recipe) => {
    const remaining = remainingPortions(recipe, plan, slots)
    return {
      recipe,
      remaining,
      state: mealPlanBadgeState(remaining, plan.peopleCount),
      total: parseServingsCount(recipe.servings),
    }
  })
})

const removingTrayId = ref<number | null>(null)
async function onRemoveFromTray(recipeId: number) {
  if (!planId.value || !detail.value) return
  removingTrayId.value = recipeId
  try {
    const { trayRecipeIds } = await removeMealPlanTrayRecipe(planId.value, recipeId)
    detail.value = { ...detail.value, trayRecipeIds }
  } catch {
    showToast('Odebrání se nezdařilo.')
  } finally {
    removingTrayId.value = null
  }
}

// ---- Add a recipe to the tray ----
const addRecipeOpen = ref(false)
const addRecipeQuery = ref('')
const addingRecipeId = ref<number | null>(null)

const addRecipeResults = computed(() => {
  if (!detail.value) return []
  const inTray = new Set(detail.value.trayRecipeIds)
  const q = normalizeRecipeName(addRecipeQuery.value)
  return (recipes.value ?? [])
    .filter((r) => !inTray.has(r.id))
    .filter((r) => !q || normalizeRecipeName(r.name).includes(q))
    .slice(0, 20)
})

function openAddRecipe() {
  addRecipeOpen.value = true
  addRecipeQuery.value = ''
}
function closeAddRecipe() {
  addRecipeOpen.value = false
}
async function onAddRecipe(recipe: Recipe) {
  if (!planId.value || !detail.value) return
  addingRecipeId.value = recipe.id
  try {
    const { trayRecipeIds } = await addMealPlanTrayRecipe(planId.value, recipe.id)
    detail.value = { ...detail.value, trayRecipeIds }
  } catch {
    showToast('Přidání se nezdařilo.')
  } finally {
    addingRecipeId.value = null
  }
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('cs', { day: 'numeric', month: 'numeric', year: 'numeric' })
}
</script>

<template>
  <div class="meal-plan-page">
    <template v-if="planId">
      <button type="button" class="back-link" @click="closePlan">← Plány</button>

      <p v-if="detailPending" class="empty">Načítám…</p>
      <p v-else-if="!detail" class="empty">Plán nebyl nalezen.</p>

      <template v-else>
        <form class="meta-form" @submit.prevent="onSaveMeta">
          <div class="field">
            <label for="mp-name">Název plánu</label>
            <input id="mp-name" v-model="metaForm.name" type="text" required maxlength="120" />
          </div>
          <div class="field-row">
            <div class="field">
              <label for="mp-start">Od</label>
              <input id="mp-start" v-model="metaForm.dateStart" type="date" required />
            </div>
            <div class="field">
              <label for="mp-end">Do</label>
              <input id="mp-end" v-model="metaForm.dateEnd" type="date" required />
            </div>
            <div class="field field-people">
              <label for="mp-people">Osob</label>
              <input id="mp-people" v-model.number="metaForm.peopleCount" type="number" min="1" required />
            </div>
          </div>
          <p v-if="metaError" class="form-error">{{ metaError }}</p>
          <div class="form-actions">
            <button
              type="button"
              class="btn-danger"
              :disabled="deletingId === planId"
              @click="onDeletePlan(planId)"
            >
              Smazat plán
            </button>
            <button type="submit" class="btn-primary" :disabled="savingMeta">
              {{ savingMeta ? 'Ukládám…' : 'Uložit plán' }}
            </button>
          </div>
        </form>

        <div class="missing-counter" :class="{ done: missing.portions === 0 }">
          <template v-if="missing.portions === 0">Vše naplánováno</template>
          <template v-else>{{ missing.slots }} {{ missing.slots === 1 ? 'jídlo' : 'jídel' }} · {{ missing.portions }} porcí chybí</template>
        </div>

        <div class="grid" @dragover="onCellDragOver">
          <div class="grid-header">
            <div class="grid-header-cell corner" />
            <div v-for="mealType in MEAL_TYPES" :key="mealType" class="grid-header-cell">
              {{ MEAL_TYPE_LABELS[mealType] }}
            </div>
          </div>
          <div v-for="row in gridRows" :key="row.date" class="grid-row">
            <div class="grid-row-label">{{ row.label }}</div>
            <div
              v-for="cell in row.cells"
              :key="cell.key"
              class="slot"
              :class="{
                empty: !cell.slot.recipeId && !cell.slot.isSkip,
                skip: cell.slot.isSkip,
                filled: !!cell.slot.recipeId,
                hover: hoverKey === cell.key,
              }"
              :style="cell.slot.recipeId ? recipeColorStyle(cell.slot.recipeId) : {}"
              :draggable="!!(cell.slot.recipeId || cell.slot.isSkip)"
              @dragstart="onSlotDragStart($event, cell.date, cell.mealType, cell.slot)"
              @dragend="onSlotDragEnd"
              @dragenter.prevent="onCellDragEnter(cell.key)"
              @dragleave="onCellDragLeave(cell.key)"
              @drop="onCellDrop($event, cell.date, cell.mealType)"
            >
              <template v-if="cell.slot.isSkip">Přeskočeno</template>
              <template v-else-if="cell.slot.recipeId">
                {{ recipeById.get(cell.slot.recipeId)?.name ?? 'Smazaný recept' }}
              </template>
            </div>
          </div>
        </div>

        <div class="tray">
          <div class="tray-header">
            <h2>Recepty</h2>
            <button type="button" class="btn-secondary" @click="openAddRecipe">+ Přidat recept</button>
          </div>

          <div v-if="addRecipeOpen" class="add-recipe">
            <input v-model="addRecipeQuery" type="text" placeholder="Hledat recept…" autofocus />
            <ul class="add-recipe-results">
              <li v-for="recipe in addRecipeResults" :key="recipe.id">
                <button type="button" :disabled="addingRecipeId === recipe.id" @click="onAddRecipe(recipe)">
                  {{ recipe.name }}
                </button>
              </li>
              <li v-if="!addRecipeResults.length" class="add-recipe-empty">Žádné recepty nenalezeny.</li>
            </ul>
            <button type="button" class="btn-secondary" @click="closeAddRecipe">Zavřít</button>
          </div>

          <div class="badges">
            <div
              class="badge skip-badge"
              draggable="true"
              @dragstart="onTrayDragStart($event, { type: 'skip' })"
            >
              Přeskočit
            </div>

            <div
              v-for="badge in trayBadges"
              :key="badge.recipe.id"
              class="badge recipe-badge"
              :class="badge.state"
              :style="recipeColorStyle(badge.recipe.id)"
              :draggable="badge.state === 'normal'"
              @dragstart="onTrayDragStart($event, { type: 'recipe', recipeId: badge.recipe.id })"
            >
              <span class="badge-name">{{ badge.recipe.name }}</span>
              <span v-if="badge.remaining !== null" class="badge-count">
                <template v-if="badge.state === 'leftover'">zbytek: {{ badge.remaining }}</template>
                <template v-else-if="badge.state === 'depleted'">vyčerpáno</template>
                <template v-else>{{ badge.remaining }}/{{ badge.total }}</template>
              </span>
              <button
                type="button"
                class="badge-remove"
                title="Odebrat z nabídky"
                :disabled="removingTrayId === badge.recipe.id"
                @click="onRemoveFromTray(badge.recipe.id)"
              >
                ✕
              </button>
            </div>
            <p v-if="!trayBadges.length" class="empty tray-empty">
              Zatím žádné recepty v nabídce — přidejte je tlačítkem výše.
            </p>
          </div>
        </div>
      </template>
    </template>

    <template v-else>
      <h1>Jídelnář</h1>

      <div class="save-row">
        <button v-if="!createFormOpen" type="button" class="btn-primary" @click="openCreateForm">
          Nový plán
        </button>
        <form v-else class="save-form" @submit.prevent="onCreate">
          <div class="field">
            <label for="mp-new-name">Název plánu</label>
            <input id="mp-new-name" v-model="createInput.name" type="text" required maxlength="120" autofocus />
          </div>
          <div class="field-row">
            <div class="field">
              <label for="mp-new-start">Od</label>
              <input id="mp-new-start" v-model="createInput.dateStart" type="date" required />
            </div>
            <div class="field">
              <label for="mp-new-end">Do</label>
              <input id="mp-new-end" v-model="createInput.dateEnd" type="date" required />
            </div>
            <div class="field field-people">
              <label for="mp-new-people">Osob</label>
              <input id="mp-new-people" v-model.number="createInput.peopleCount" type="number" min="1" required />
            </div>
          </div>
          <p v-if="createError" class="form-error">{{ createError }}</p>
          <div class="form-actions">
            <button type="button" class="btn-secondary" @click="closeCreateForm">Zrušit</button>
            <button type="submit" class="btn-primary" :disabled="creating">
              {{ creating ? 'Vytvářím…' : 'Vytvořit' }}
            </button>
          </div>
        </form>
      </div>

      <p v-if="plansPending" class="empty">Načítám…</p>
      <p v-else-if="!plans?.length" class="empty">Zatím nemáte žádné plány. Vytvořte první výše.</p>
      <ul v-else class="saved-lists">
        <li v-for="plan in plans" :key="plan.id" class="saved-list-row">
          <button type="button" class="saved-list-main" @click="planId = plan.id">
            <span class="saved-list-name">{{ plan.name }}</span>
            <span class="saved-list-meta">
              <span>{{ formatDate(plan.dateStart) }} – {{ formatDate(plan.dateEnd) }}</span>
              <span>{{ plan.peopleCount }} {{ plan.peopleCount === 1 ? 'osoba' : 'osob' }}</span>
            </span>
          </button>
          <button
            type="button"
            class="delete-btn"
            title="Smazat plán"
            :disabled="deletingId === plan.id"
            @click="onDeletePlan(plan.id)"
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
.meal-plan-page {
  max-width: 900px;
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

.save-row {
  padding-bottom: 14px;
}

.save-form,
.meta-form {
  background: var(--surface);
  border-radius: 12px;
  padding: 14px 16px;
  display: flex;
  flex-direction: column;
  gap: 12px;
  margin-bottom: 14px;
}

.field {
  display: flex;
  flex-direction: column;
  gap: 6px;
  flex: 1;
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

.field-row {
  display: flex;
  gap: 10px;
  flex-wrap: wrap;
}

.field-people {
  flex: none;
  width: 90px;
}

.form-error {
  margin: 0;
  font-size: 12.5px;
  color: var(--hard);
}

.form-actions {
  display: flex;
  justify-content: space-between;
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

.btn-danger:disabled,
.btn-secondary:disabled {
  opacity: 0.6;
  cursor: default;
}

.missing-counter {
  font-family: 'IBM Plex Mono', ui-monospace, monospace;
  font-size: 13px;
  font-weight: 600;
  color: var(--accent);
  padding: 4px 0 14px;
}

.missing-counter.done {
  color: var(--easy);
}

.grid {
  display: flex;
  flex-direction: column;
  gap: 4px;
  margin-bottom: 20px;
  overflow-x: auto;
}

.grid-header,
.grid-row {
  display: grid;
  grid-template-columns: 72px repeat(3, minmax(90px, 1fr));
  gap: 4px;
}

.grid-header-cell {
  font-family: 'IBM Plex Mono', ui-monospace, monospace;
  font-size: 10.5px;
  font-weight: 600;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  color: var(--text-dim);
  padding: 4px 2px;
  text-align: center;
}

.grid-header-cell.corner {
  visibility: hidden;
}

.grid-row-label {
  display: flex;
  align-items: center;
  font-family: 'IBM Plex Mono', ui-monospace, monospace;
  font-size: 12px;
  color: var(--text-dim);
  padding: 4px 2px;
  text-transform: capitalize;
}

.slot {
  min-height: 56px;
  border-radius: 10px;
  background: var(--surface);
  border: 1px solid var(--rule);
  border-left: 4px solid var(--rule);
  padding: 8px 10px;
  font-family: 'IBM Plex Sans', sans-serif;
  font-size: 13px;
  color: var(--surface-ink);
  display: flex;
  align-items: center;
  cursor: default;
}

.slot.empty {
  animation: slot-glow 2.4s ease-in-out infinite;
}

@keyframes slot-glow {
  0%,
  100% {
    box-shadow: 0 0 0 0 rgba(184, 80, 42, 0.25);
  }
  50% {
    box-shadow: 0 0 0 4px rgba(184, 80, 42, 0.12);
  }
}

.slot.skip {
  background: var(--rule);
  color: var(--surface-ink-dim);
  border-left-color: var(--rule);
  cursor: grab;
}

.slot.filled {
  border-left-color: var(--slot-accent, var(--accent));
  cursor: grab;
  font-weight: 600;
}

.slot.hover {
  outline: 2px dashed var(--accent);
  outline-offset: -2px;
}

.tray {
  padding-top: 4px;
}

.tray-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 10px;
}

.tray-header h2 {
  margin: 0;
  font-family: 'Fraunces', Georgia, serif;
  font-weight: 600;
  font-size: 18px;
  color: var(--text);
}

.add-recipe {
  background: var(--surface);
  border-radius: 12px;
  padding: 12px;
  margin-bottom: 12px;
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.add-recipe input {
  font: 400 15px 'IBM Plex Sans', sans-serif;
  padding: 10px 12px;
  border-radius: 8px;
  border: 1px solid var(--rule);
  background: var(--surface);
  color: var(--surface-ink);
}

.add-recipe-results {
  list-style: none;
  margin: 0;
  padding: 0;
  max-height: 220px;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.add-recipe-results button {
  width: 100%;
  text-align: left;
  background: none;
  border: none;
  padding: 8px 10px;
  border-radius: 8px;
  font: 400 14px 'IBM Plex Sans', sans-serif;
  color: var(--surface-ink);
  cursor: pointer;
}

.add-recipe-results button:hover {
  background: var(--rule);
}

.add-recipe-empty {
  color: var(--surface-ink-dim);
  font-size: 13px;
  padding: 8px 10px;
}

.badges {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.badge {
  display: flex;
  align-items: center;
  gap: 6px;
  border-radius: 999px;
  padding: 8px 12px;
  background: var(--surface);
  border: 1px solid var(--rule);
  border-left: 4px solid var(--rule);
  font-family: 'IBM Plex Sans', sans-serif;
  font-size: 13px;
  color: var(--surface-ink);
}

.skip-badge {
  cursor: grab;
  font-weight: 600;
  color: var(--surface-ink-dim);
}

.recipe-badge {
  border-left-color: var(--slot-accent, var(--accent));
  cursor: grab;
}

.recipe-badge.leftover {
  cursor: default;
  opacity: 0.85;
}

.recipe-badge.depleted {
  cursor: default;
  opacity: 0.45;
}

.badge-name {
  font-weight: 600;
}

.badge-count {
  font-family: 'IBM Plex Mono', ui-monospace, monospace;
  font-size: 11px;
  color: var(--surface-ink-dim);
}

.badge-remove {
  background: none;
  border: none;
  color: var(--surface-ink-dim);
  cursor: pointer;
  padding: 0 0 0 4px;
  font-size: 12px;
}

.badge-remove:hover {
  color: var(--hard);
}

.tray-empty {
  padding: 12px 0;
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
