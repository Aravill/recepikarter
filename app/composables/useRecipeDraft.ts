import { CATEGORIES, DIFFICULTIES, emptyRecipeInput } from '#shared/types/recipe'
import type { RecipeInput } from '#shared/types/recipe'

// localStorage rather than sessionStorage: the whole point is surviving an
// accidentally closed tab, and sessionStorage dies with it. Keyed per
// username so another household member on the same device doesn't open
// "Nový recept" into someone else's half-written draft.
const DRAFT_STORAGE_PREFIX = 'recepikarter-draft:'

function isDraftEmpty(input: RecipeInput): boolean {
  return JSON.stringify(input) === JSON.stringify(emptyRecipeInput())
}

// Persists the in-progress "new recipe" form so a closed tab or a stray
// back-button click doesn't erase it. Client-only by nature — every
// function is a no-op during SSR, so callers should read the draft in
// onMounted, not at setup time, to avoid a hydration mismatch.
export function useRecipeDraft() {
  const { user } = useUserSession()

  const storageKey = computed(() =>
    user.value?.username ? `${DRAFT_STORAGE_PREFIX}${user.value.username}` : null,
  )

  function loadDraft(): RecipeInput | null {
    if (!import.meta.client || !storageKey.value) return null
    try {
      const raw = localStorage.getItem(storageKey.value)
      if (!raw) return null
      const parsed: unknown = JSON.parse(raw)
      if (typeof parsed !== 'object' || parsed === null) return null
      // Fill any field missing from an older draft so the form never sees
      // undefined where it expects an array or string.
      const draft: RecipeInput = { ...emptyRecipeInput(), ...(parsed as Partial<RecipeInput>) }
      if (!Array.isArray(draft.ingredients) || !Array.isArray(draft.steps) || !Array.isArray(draft.tags)) {
        return null
      }
      // A value outside the enums would render a blank <select> and only
      // surface as the server's 400 on save.
      if (!CATEGORIES.includes(draft.category) || !DIFFICULTIES.includes(draft.cookTimeDifficulty)) {
        return null
      }
      return isDraftEmpty(draft) ? null : draft
    } catch {
      return null
    }
  }

  function hasDraft(): boolean {
    return loadDraft() !== null
  }

  // An untouched form is not worth keeping — storing it would make the
  // homepage advertise a draft that has nothing in it.
  function saveDraft(input: RecipeInput) {
    if (!import.meta.client || !storageKey.value) return
    try {
      if (isDraftEmpty(input)) localStorage.removeItem(storageKey.value)
      else localStorage.setItem(storageKey.value, JSON.stringify(input))
    } catch {
      // Storage full or disabled (private mode) — losing autosave is not
      // worth breaking the editor over.
    }
  }

  function clearDraft() {
    if (!import.meta.client || !storageKey.value) return
    try {
      localStorage.removeItem(storageKey.value)
    } catch {
      // See saveDraft.
    }
  }

  return { loadDraft, hasDraft, saveDraft, clearDraft, isDraftEmpty }
}
