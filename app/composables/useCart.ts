// Which recipes the user has picked to combine into one shopping list (see
// app/pages/shopping-list.vue). A single app-wide selection via useState
// (not a per-component ref) — so it stays in sync between every view mode
// on the gallery page and the count badge on the Nákupák tab (see
// TabBar.vue), no matter where a recipe was added. Deliberately not
// persisted across reloads, same as every other shopping-related state in
// the app — a plain array rather than a Set so it survives Nuxt's payload
// serialization without a custom reducer.
export function useCart() {
  const ids = useState<number[]>('cart-ids', () => [])

  function has(id: number) {
    return ids.value.includes(id)
  }

  function toggle(id: number) {
    ids.value = has(id) ? ids.value.filter((existing) => existing !== id) : [...ids.value, id]
  }

  function clear() {
    ids.value = []
  }

  return { ids, has, toggle, clear }
}
