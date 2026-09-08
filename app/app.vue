<template>
  <div class="app-shell">
    <NuxtRouteAnnouncer />
    <header class="app-header">
      <NuxtLink to="/" class="brand">🍳 Recepikarter</NuxtLink>
      <NuxtLink to="/recipes/new" class="new-btn">+ New recipe</NuxtLink>
    </header>
    <main class="app-main">
      <NuxtPage />
    </main>
  </div>
</template>

<style>
:root {
  color-scheme: light;
}

* {
  box-sizing: border-box;
}

body {
  margin: 0;
  background: #f4efe4;
  color: #2c2825;
  font-family: ui-sans-serif, system-ui, 'Segoe UI', sans-serif;
}

a {
  color: inherit;
}

.app-header {
  position: sticky;
  top: 0;
  z-index: 10;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 14px 24px;
  background: #2c2825;
  color: #fdf9f2;
}

.brand {
  font-size: 18px;
  font-weight: 700;
  text-decoration: none;
  color: inherit;
}

.new-btn {
  text-decoration: none;
  background: #c1552c;
  color: #fff;
  padding: 8px 14px;
  border-radius: 6px;
  font-size: 14px;
  font-weight: 600;
}

.new-btn:hover {
  background: #a8471f;
}

.app-main {
  max-width: 1200px;
  margin: 0 auto;
  padding: 24px;
}
</style>
