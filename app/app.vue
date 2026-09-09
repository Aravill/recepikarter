<script setup lang="ts">
const route = useRoute()
const { loggedIn, clear } = useUserSession()

const showHeader = computed(
  () => loggedIn.value && route.path !== '/login' && !route.path.startsWith('/recipes'),
)

async function onLogout() {
  await clear()
  await navigateTo('/login')
}
</script>

<template>
  <div class="app-shell">
    <NuxtRouteAnnouncer />
    <header v-if="showHeader" class="app-header">
      <NuxtLink to="/" class="brand">Recepikarter</NuxtLink>
      <div class="header-actions">
        <button class="logout-btn" @click="onLogout">Odhlásit</button>
        <NuxtLink to="/recipes/new" class="fab" aria-label="Nový recept">+</NuxtLink>
      </div>
    </header>
    <main class="app-main">
      <NuxtPage />
    </main>
  </div>
</template>

<style>
:root {
  --bg: #efe9de;
  --bg-raised: #e3dbc8;
  --line: #d8cfbe;
  --text: #221f1c;
  --text-dim: #6b6255;
  --surface: #fbf8f2;
  --surface-ink: #221f1c;
  --surface-ink-dim: #6b6255;
  --rule: #e6ddc9;
  --accent: #b8502a;
  --easy: #6f8f5c;
  --medium: #c98a2e;
  --hard: #a1423a;

  color-scheme: light;
}

* {
  box-sizing: border-box;
}

body {
  margin: 0;
  background: var(--bg);
  color: var(--text);
  font-family: 'IBM Plex Sans', ui-sans-serif, system-ui, 'Segoe UI', sans-serif;
}

a {
  color: inherit;
}

.app-shell {
  min-height: 100vh;
  display: flex;
  flex-direction: column;
}

.app-header {
  position: sticky;
  top: 0;
  z-index: 10;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 14px 24px;
  background: var(--bg-raised);
  border-bottom: 1px solid var(--line);
}

.brand {
  font-family: 'Fraunces', Georgia, serif;
  font-size: 19px;
  font-weight: 600;
  text-decoration: none;
  color: var(--text);
}

.header-actions {
  display: flex;
  align-items: center;
  gap: 12px;
}

.fab {
  width: 32px;
  height: 32px;
  border-radius: 8px;
  background: var(--accent);
  color: #fdf9f2;
  text-decoration: none;
  font-size: 18px;
  line-height: 1;
  display: flex;
  align-items: center;
  justify-content: center;
}

.logout-btn {
  background: transparent;
  border: 1px solid var(--line);
  color: var(--text-dim);
  padding: 8px 12px;
  border-radius: 8px;
  font-size: 13px;
  font-family: 'IBM Plex Sans', sans-serif;
  cursor: pointer;
}

.logout-btn:hover {
  color: var(--text);
  border-color: var(--text-dim);
}

.app-main {
  flex: 1;
  max-width: 640px;
  width: 100%;
  margin: 0 auto;
  padding: 18px;
}
</style>
