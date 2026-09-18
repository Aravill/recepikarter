<script setup lang="ts">
// Jídelnář has no route yet (see CLAUDE.md-adjacent design note in
// app.vue) — it renders as a disabled tab with a "brzy" badge instead of a
// NuxtLink, rather than linking to a stub page that would 404 or dead-end.
const route = useRoute()
</script>

<template>
  <nav class="tab-bar" aria-label="Sekce">
    <NuxtLink to="/shopping-list" class="tab" :class="{ active: route.path === '/shopping-list' }">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
        <path d="M4 6h16l-1.5 10h-13z" />
        <path d="M8 10v4M12 10v4M16 10v4" />
      </svg>
      Nákupák
    </NuxtLink>
    <NuxtLink to="/" class="tab" :class="{ active: route.path === '/' }">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
        <rect x="3.5" y="3.5" width="7" height="7" rx="1.5" />
        <rect x="13.5" y="3.5" width="7" height="7" rx="1.5" />
        <rect x="3.5" y="13.5" width="7" height="7" rx="1.5" />
        <rect x="13.5" y="13.5" width="7" height="7" rx="1.5" />
      </svg>
      Galerie
    </NuxtLink>
    <button type="button" class="tab disabled" disabled aria-disabled="true">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
        <rect x="3.5" y="4.5" width="17" height="16" rx="2" />
        <path d="M3.5 9.5h17M8 3v3M16 3v3" />
      </svg>
      Jídelnář
      <span class="soon">brzy</span>
    </button>
  </nav>
</template>

<style scoped>
.tab-bar {
  display: flex;
  background: var(--bg-raised);
  border-bottom: 1px solid var(--line);
}

.tab {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
  padding: 10px 4px 9px;
  background: none;
  border: none;
  cursor: pointer;
  color: var(--text-dim);
  font-family: 'IBM Plex Mono', ui-monospace, monospace;
  font-size: 11px;
  font-weight: 600;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  text-decoration: none;
  border-bottom: 2px solid transparent;
  position: relative;
}

.tab svg {
  width: 20px;
  height: 20px;
}

.tab.active {
  color: var(--accent);
  border-bottom-color: var(--accent);
}

.tab.disabled {
  cursor: default;
  opacity: 0.6;
}

.soon {
  position: absolute;
  top: 3px;
  right: calc(50% - 32px);
  font-size: 8px;
  letter-spacing: 0.04em;
  background: var(--rule);
  color: var(--surface-ink-dim);
  padding: 1px 4px;
  border-radius: 6px;
  text-transform: none;
  font-weight: 600;
}
</style>
