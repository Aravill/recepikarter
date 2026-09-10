<script setup lang="ts">
const { theme, toggleTheme } = useTheme()

const emit = defineEmits<{ 'activated-dark': [] }>()

const label = computed(() => (theme.value === 'dark' ? 'Přepnout na světlý režim' : 'Přepnout na tmavý režim'))

function onClick() {
  const { activatedDark } = toggleTheme()
  if (activatedDark) emit('activated-dark')
}
</script>

<template>
  <button class="theme-toggle-btn" type="button" :title="label" :aria-label="label" @click="onClick">
    <!-- Bulb on: light mode is active, click to go dark. -->
    <svg v-if="theme === 'light'" class="bulb-icon" viewBox="0 0 24 24" aria-hidden="true">
      <path
        d="M12 4.6a5.4 5.4 0 0 0-2.7 10.1c.5.3.9.9.9 1.5V17h3.6v-.8c0-.6.3-1.2.9-1.5A5.4 5.4 0 0 0 12 4.6z"
        fill="var(--accent)"
        fill-opacity="0.85"
        stroke="currentColor"
        stroke-width="1.6"
        stroke-linecap="round"
        stroke-linejoin="round"
      />
      <path
        d="M9.6 20h4.8M10 21.6h4"
        fill="none"
        stroke="currentColor"
        stroke-width="1.6"
        stroke-linecap="round"
        stroke-linejoin="round"
      />
      <path
        d="M12 2v1.6M4.9 4.9l1.1 1.1M19.1 4.9l-1.1 1.1M2.4 12h1.6M20 12h1.6"
        fill="none"
        stroke="currentColor"
        stroke-width="1.6"
        stroke-linecap="round"
      />
    </svg>
    <!-- Bulb off: dark mode is active, click to go light. -->
    <svg v-else class="bulb-icon" viewBox="0 0 24 24" aria-hidden="true">
      <path
        d="M12 4.6a5.4 5.4 0 0 0-2.7 10.1c.5.3.9.9.9 1.5V17h3.6v-.8c0-.6.3-1.2.9-1.5A5.4 5.4 0 0 0 12 4.6z"
        fill="none"
        stroke="currentColor"
        stroke-width="1.6"
        stroke-linecap="round"
        stroke-linejoin="round"
      />
      <path
        d="M9.6 20h4.8M10 21.6h4"
        fill="none"
        stroke="currentColor"
        stroke-width="1.6"
        stroke-linecap="round"
        stroke-linejoin="round"
      />
    </svg>
  </button>
</template>

<style scoped>
.theme-toggle-btn {
  width: 34px;
  height: 34px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: transparent;
  border: 1px solid var(--line);
  color: var(--text-dim);
  border-radius: 8px;
  cursor: pointer;
}

.theme-toggle-btn:hover {
  color: var(--text);
  border-color: var(--text-dim);
}

.bulb-icon {
  width: 18px;
  height: 18px;
}
</style>
