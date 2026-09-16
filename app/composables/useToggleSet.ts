// The copy-on-write "toggle membership in a Set" idiom shared by every
// checkbox-style selection in the app (shopping-mode ingredient check-off,
// gallery/list recipe selection, shopping-list item check-off) — a new Set
// is assigned rather than mutated in place so Vue's ref reactivity picks up
// the change.
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
