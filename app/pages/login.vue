<script setup lang="ts">
import { SESSION_END_MESSAGES, SESSION_ENDED_COOKIE } from '#shared/types/user'
import type { SessionEndReason } from '#shared/types/user'

const { fetch: refreshSession } = useUserSession()

// Set by the server when it logged this browser out (blocked, password
// changed, expired) — see endSession in server/utils/auth.ts.
const sessionEndedReason = useCookie<SessionEndReason | null>(SESSION_ENDED_COOKIE)
const sessionEndedNotice = computed(() =>
  sessionEndedReason.value ? (SESSION_END_MESSAGES[sessionEndedReason.value] ?? '') : '',
)

const username = ref('')
const password = ref('')
const error = ref('')
const submitting = ref(false)

async function onSubmit() {
  error.value = ''
  // The "why you were logged out" notice has done its job once they try
  // again; leaving it next to a fresh error would be confusing.
  sessionEndedReason.value = null
  submitting.value = true
  try {
    await apiFetch('/api/auth/login', {
      method: 'POST',
      body: { username: username.value, password: password.value },
    })
    await refreshSession()
    await navigateTo('/')
  } catch (e) {
    const err = e as { data?: { statusMessage?: string } }
    error.value = err?.data?.statusMessage || 'Přihlášení se nezdařilo.'
  } finally {
    submitting.value = false
  }
}
</script>

<template>
  <div class="login-body">
    <img src="/banner.png" alt="Recepikarter — Kartotéka receptů" class="banner" />
    <form class="login-panel" @submit.prevent="onSubmit">
      <p v-if="sessionEndedNotice" class="login-notice" role="status">{{ sessionEndedNotice }}</p>
      <div class="field">
        <label for="u">Uživatelské jméno</label>
        <input id="u" v-model="username" type="text" autocomplete="username" required />
      </div>
      <div class="field">
        <label for="p">Heslo</label>
        <input id="p" v-model="password" type="password" autocomplete="current-password" required />
      </div>
      <p v-if="error" class="login-error">{{ error }}</p>
      <button type="submit" class="btn-primary" :disabled="submitting">
        {{ submitting ? 'Přihlašuji…' : 'Přihlásit se' }}
      </button>
    </form>
    <p class="login-hint">Přístup jen pro domácnost — bez registrace.</p>
  </div>
</template>

<style scoped>
.login-body {
  min-height: 100vh;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 28px;
  padding: 24px;
}

.banner {
  display: block;
  width: 100%;
  max-width: 340px;
  height: auto;
  border-radius: 14px;
}

.login-panel {
  width: 100%;
  max-width: 340px;
  background: var(--surface);
  border-radius: 14px;
  padding: 26px 22px;
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.field {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.field label {
  font-family: 'IBM Plex Mono', ui-monospace, monospace;
  font-size: 10.5px;
  font-weight: 600;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  color: var(--surface-ink-dim);
}

.field input {
  font: 400 15px 'IBM Plex Sans', sans-serif;
  padding: 11px 12px;
  border-radius: 8px;
  border: 1px solid var(--rule);
  background: var(--surface);
  color: var(--surface-ink);
}

.field input:focus {
  outline: 2px solid var(--accent);
  outline-offset: 1px;
}

.login-notice {
  margin: 0;
  padding: 10px 12px;
  border-radius: 8px;
  background: rgba(201, 138, 46, 0.14);
  font-size: 13px;
  line-height: 1.45;
  color: var(--surface-ink);
}

.login-error {
  margin: 0;
  font-size: 12.5px;
  color: var(--hard);
}

.btn-primary {
  font-family: 'IBM Plex Sans', sans-serif;
  font-weight: 600;
  font-size: 14.5px;
  border: none;
  border-radius: 8px;
  padding: 12px 16px;
  background: var(--accent);
  color: #fdf9f2;
  cursor: pointer;
}

.btn-primary:disabled {
  opacity: 0.7;
  cursor: default;
}

.login-hint {
  text-align: center;
  font-size: 12.5px;
  color: var(--text-dim);
  margin: 0;
}
</style>
