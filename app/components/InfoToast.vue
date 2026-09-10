<script setup lang="ts">
defineProps<{ message: string }>()
const emit = defineEmits<{ dismiss: [] }>()
</script>

<template>
  <div class="info-toast" role="status">
    <p>{{ message }}</p>
    <button class="info-toast-close" type="button" aria-label="Zavřít" @click="emit('dismiss')">✕</button>
  </div>
</template>

<style scoped>
.info-toast {
  position: fixed;
  left: 50%;
  bottom: 24px;
  transform: translateX(-50%);
  z-index: 50;
  display: flex;
  align-items: flex-start;
  gap: 10px;
  max-width: min(360px, calc(100vw - 32px));
  padding: 12px 14px;
  background: var(--surface);
  color: var(--surface-ink);
  border: 1px solid var(--rule);
  border-radius: 12px;
  box-shadow: 0 12px 28px -12px rgba(0, 0, 0, 0.5);
}

.info-toast p {
  margin: 0;
  flex: 1;
  font-family: 'IBM Plex Sans', sans-serif;
  font-size: 13px;
  line-height: 1.4;
}

.info-toast-close {
  flex: none;
  background: transparent;
  border: none;
  color: var(--surface-ink-dim);
  font-size: 13px;
  line-height: 1;
  padding: 2px;
  cursor: pointer;
}

.info-toast-close:hover {
  color: var(--surface-ink);
}
</style>
