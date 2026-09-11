<script setup lang="ts">
const route = useRoute()
const { loggedIn, user, clear } = useUserSession()

const showHeader = computed(
  () =>
    loggedIn.value &&
    route.path !== '/login' &&
    route.path !== '/change-password' &&
    !route.path.startsWith('/recipes'),
)

async function onLogout() {
  await clear()
  await navigateTo('/login')
}

// Shown only on the specific click that switches light -> dark (see
// ThemeToggle's 'activated-dark' emit), not whenever dark happens to
// already be the active theme.
const showDarkModeToast = ref(false)
let darkModeToastTimer: ReturnType<typeof setTimeout> | null = null

function onActivatedDark() {
  showDarkModeToast.value = true
  if (darkModeToastTimer) clearTimeout(darkModeToastTimer)
  darkModeToastTimer = setTimeout(() => {
    showDarkModeToast.value = false
  }, 6000)
}

function dismissDarkModeToast() {
  showDarkModeToast.value = false
  if (darkModeToastTimer) clearTimeout(darkModeToastTimer)
}
</script>

<template>
  <div class="app-shell">
    <NuxtRouteAnnouncer />
    <header v-if="showHeader" class="app-header">
      <NuxtLink to="/" class="brand">
        <img src="/icon.svg" alt="" class="brand-icon" width="22" height="22" />
        Recepikarter
      </NuxtLink>
      <div class="header-actions">
        <NuxtLink v-if="user?.role === 'admin'" to="/admin/users" class="admin-link" title="Správa uživatelů">
          Uživatelé
        </NuxtLink>
        <ThemeToggle @activated-dark="onActivatedDark" />
        <button class="logout-btn" @click="onLogout">Odhlásit</button>
      </div>
    </header>
    <main class="app-main">
      <NuxtPage />
    </main>
    <InfoToast
      v-if="showDarkModeToast"
      message="Tmavý režim je zapnutý. Stažené karty receptů se ale pořád vygenerují ve světlém režimu, aby šetřily inkoust v tiskárně."
      @dismiss="dismissDarkModeToast"
    />
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

/* Dark theme overrides — same token names, same hue families (warm
   paper/ink, not hue-inverted), lifted for contrast on a near-black (not
   pure-black) ground. Full palette + rationale: docs/dark-mode.md. */
:root[data-theme='dark'] {
  --bg: #1c1a17;
  --bg-raised: #262320;
  --line: #3a352e;
  --text: #ede7da;
  --text-dim: #a89e8c;
  --surface: #23201c;
  --surface-ink: #ede7da;
  --surface-ink-dim: #a89e8c;
  --rule: #383329;
  --accent: #d97a4f;
  --easy: #86a874;
  --medium: #dba653;
  --hard: #c15c52;

  color-scheme: dark;
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
  background: var(--bg-raised) url('/header-bg.png') center / cover no-repeat;
  border-bottom: 1px solid var(--line);
}

:root[data-theme='dark'] .app-header {
  background-image: url('/header-bg-dark.png');
}

.brand {
  display: flex;
  align-items: center;
  gap: 8px;
  font-family: 'Fraunces', Georgia, serif;
  font-size: 19px;
  font-weight: 600;
  text-decoration: none;
  color: var(--text);
}

.brand-icon {
  display: block;
  border-radius: 6px;
}

.header-actions {
  display: flex;
  align-items: center;
  gap: 12px;
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

.admin-link {
  background: transparent;
  border: 1px solid var(--line);
  color: var(--text-dim);
  padding: 8px 12px;
  border-radius: 8px;
  font-size: 13px;
  font-family: 'IBM Plex Sans', sans-serif;
  text-decoration: none;
}

.admin-link:hover {
  color: var(--text);
  border-color: var(--text-dim);
}

.app-main {
  flex: 1;
  width: 100%;
  padding: 18px;
}
</style>
