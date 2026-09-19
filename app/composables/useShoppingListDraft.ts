// What survives a closed tab or a stray navigation away from an unsaved
// generated shopping list — app/pages/shopping-list.vue's ephemeral
// ?ids=/?plan= views. Same localStorage-draft pattern as
// useRecipeDraft.ts (keyed per username, so another household member on
// the same device doesn't get offered someone else's unfinished list), but
// simpler: there's no form to snapshot, just enough to rebuild the view's
// own URL — the items themselves are always recomputed live from it.
const DRAFT_STORAGE_PREFIX = 'recepikarter-shopping-draft:'

export type ShoppingListDraftSource = { recipeIds: number[] } | { mealPlanId: number }

export function useShoppingListDraft() {
  const { user } = useUserSession()

  const storageKey = computed(() =>
    user.value?.username ? `${DRAFT_STORAGE_PREFIX}${user.value.username}` : null,
  )

  // Client-only by nature — every function is a no-op during SSR, so
  // callers should read the draft in onMounted, not at setup time, to
  // avoid a hydration mismatch (see useRecipeDraft.ts).
  function loadDraft(): ShoppingListDraftSource | null {
    if (!import.meta.client || !storageKey.value) return null
    try {
      const raw = localStorage.getItem(storageKey.value)
      if (!raw) return null
      const parsed = JSON.parse(raw) as { recipeIds?: unknown; mealPlanId?: unknown }
      if (Array.isArray(parsed.recipeIds)) {
        const recipeIds = parsed.recipeIds.filter((n): n is number => typeof n === 'number' && Number.isInteger(n))
        return recipeIds.length ? { recipeIds } : null
      }
      if (typeof parsed.mealPlanId === 'number' && Number.isInteger(parsed.mealPlanId) && parsed.mealPlanId > 0) {
        return { mealPlanId: parsed.mealPlanId }
      }
      return null
    } catch {
      return null
    }
  }

  function hasDraft(): boolean {
    return loadDraft() !== null
  }

  function saveDraft(source: ShoppingListDraftSource) {
    if (!import.meta.client || !storageKey.value) return
    try {
      localStorage.setItem(storageKey.value, JSON.stringify(source))
    } catch {
      // Storage full or disabled (private mode) — losing this is not worth
      // breaking the page over.
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

  return { loadDraft, hasDraft, saveDraft, clearDraft }
}
