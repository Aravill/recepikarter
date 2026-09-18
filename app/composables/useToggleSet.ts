// The copy-on-write "toggle membership in a Set" idiom used for
// checkbox-style selection scoped to a single component instance (e.g.
// shopping-list item check-off, see app/pages/shopping-list.vue) — a new Set
// is assigned rather than mutated in place so Vue's ref reactivity picks up
// the change. State shared across components/pages (the shopping cart)
// lives in useCart.ts instead, which useState's for that reason.
export function useToggleSet<T>() {
  const items = ref(new Set<T>())

  function toggle(item: T) {
    const next = new Set(items.value)
    if (next.has(item)) next.delete(item)
    else next.add(item)
    items.value = next
  }

  function clear() {
    items.value = new Set()
  }

  return { items, toggle, clear }
}
