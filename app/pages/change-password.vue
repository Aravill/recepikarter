<script setup lang="ts">
import { PASSWORD_MAX_LENGTH, PASSWORD_RULES, passwordPolicyMessage, passwordPolicyViolations } from '#shared/utils/password-policy'

const { fetch: refreshSession, user } = useUserSession()

const currentPassword = ref('')
const newPassword = ref('')
const confirmPassword = ref('')
const error = ref('')
const submitting = ref(false)

// Live checklist under the new-password field — the same rules the API
// enforces (see shared/utils/password-policy.ts).
const ruleStates = computed(() =>
  PASSWORD_RULES.map((rule) => ({ label: rule.label, ok: rule.test(newPassword.value, user.value?.username ?? '') })),
)

async function onSubmit() {
  error.value = ''
  const violations = passwordPolicyViolations(newPassword.value, user.value?.username ?? '')
  if (violations.length) {
    error.value = passwordPolicyMessage(violations)
    return
  }
  if (newPassword.value !== confirmPassword.value) {
    error.value = 'Nová hesla se neshodují.'
    return
  }
  submitting.value = true
  try {
    await $fetch('/api/auth/change-password', {
      method: 'POST',
      body: { currentPassword: currentPassword.value, newPassword: newPassword.value },
    })
    await refreshSession()
    await navigateTo('/')
  } catch (e) {
    const err = e as { data?: { statusMessage?: string } }
    error.value = err?.data?.statusMessage || 'Změna hesla se nezdařila.'
  } finally {
    submitting.value = false
  }
}
</script>

<template>
  <div class="change-password-body">
    <form class="change-password-panel" @submit.prevent="onSubmit">
      <h1 class="heading">Nastavte si vlastní heslo</h1>
      <p class="hint">
        Přihlásili jste se s dočasným heslem{{ user?.username ? ` jako ${user.username}` : '' }}. Než budete moci
        pokračovat, nastavte si nové heslo.
      </p>
      <div class="field">
        <label for="cp-current">Dočasné heslo</label>
        <input id="cp-current" v-model="currentPassword" type="password" autocomplete="current-password" required />
      </div>
      <div class="field">
        <label for="cp-new">Nové heslo</label>
        <input
          id="cp-new"
          v-model="newPassword"
          type="password"
          autocomplete="new-password"
          :maxlength="PASSWORD_MAX_LENGTH"
          required
        />
        <ul class="password-rules" aria-label="Požadavky na heslo">
          <li v-for="rule in ruleStates" :key="rule.label" :class="{ ok: rule.ok }">{{ rule.label }}</li>
        </ul>
      </div>
      <div class="field">
        <label for="cp-confirm">Nové heslo znovu</label>
        <input
          id="cp-confirm"
          v-model="confirmPassword"
          type="password"
          autocomplete="new-password"
          :maxlength="PASSWORD_MAX_LENGTH"
          required
        />
      </div>
      <p v-if="error" class="change-password-error">{{ error }}</p>
      <button type="submit" class="btn-primary" :disabled="submitting">
        {{ submitting ? 'Ukládám…' : 'Nastavit heslo' }}
      </button>
    </form>
  </div>
</template>

<style scoped>
.change-password-body {
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 24px;
}

.change-password-panel {
  width: 100%;
  max-width: 360px;
  background: var(--surface);
  border-radius: 14px;
  padding: 26px 22px;
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.heading {
  margin: 0;
  font-family: 'Fraunces', serif;
  font-weight: 600;
  font-size: 20px;
  color: var(--surface-ink);
}

.hint {
  margin: 0;
  font-size: 13px;
  line-height: 1.5;
  color: var(--surface-ink-dim);
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

.password-rules {
  margin: 2px 0 0;
  padding: 0;
  list-style: none;
  display: flex;
  flex-direction: column;
  gap: 2px;
  font-size: 12.5px;
  color: var(--surface-ink-dim);
}

.password-rules li::before {
  content: '○ ';
}

.password-rules li.ok {
  color: var(--easy);
}

.password-rules li.ok::before {
  content: '✓ ';
}

.change-password-error {
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
</style>
