<script setup lang="ts">
const route = useRoute()

// How many recipes are currently in the cart (see useCart.ts) — shown as a
// badge so the count is visible from any tab, not just once you're on
// Nákupák itself.
const { ids: cartIds } = useCart()
</script>

<template>
  <nav class="tab-bar" aria-label="Sekce">
    <NuxtLink to="/shopping-list" class="tab" :class="{ active: route.path === '/shopping-list' }">
      <span class="icon-wrap">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
          <path d="M4 6h16l-1.5 10h-13z" />
          <path d="M8 10v4M12 10v4M16 10v4" />
        </svg>
        <span v-if="cartIds.length" class="cart-badge">{{ cartIds.length }}</span>
      </span>
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
    <NuxtLink to="/meal-plan" class="tab" :class="{ active: route.path === '/meal-plan' }">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
        <rect x="3.5" y="4.5" width="17" height="16" rx="2" />
        <path d="M3.5 9.5h17M8 3v3M16 3v3" />
      </svg>
      Jídelnář
    </NuxtLink>
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

.icon-wrap {
  position: relative;
  display: inline-flex;
}

.cart-badge {
  position: absolute;
  top: -4px;
  right: -8px;
  min-width: 14px;
  height: 14px;
  padding: 0 3px;
  border-radius: 999px;
  background: var(--accent);
  color: #fdf9f2;
  font-size: 9px;
  font-weight: 700;
  line-height: 14px;
  text-align: center;
  font-variant-numeric: tabular-nums;
}

.tab.active {
  color: var(--accent);
  border-bottom-color: var(--accent);
}
</style>
