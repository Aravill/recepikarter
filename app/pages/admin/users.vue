<script setup lang="ts">
import type { AppUser } from '#shared/types/user'

const { listUsers, createUser, blockUser, unblockUser } = useAdminUsers()
const { data: users, refresh } = await useAsyncData('admin-users', () => listUsers())

const formOpen = ref(false)
const newUsername = ref('')
const newTempPassword = ref('')
const creating = ref(false)
const createError = ref('')
const justCreated = ref<{ username: string; tempPassword: string } | null>(null)
const togglingId = ref<number | null>(null)

const TEMP_PASSWORD_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789'

function generatePassword() {
  const bytes = new Uint8Array(10)
  crypto.getRandomValues(bytes)
  newTempPassword.value = Array.from(bytes, (b) => TEMP_PASSWORD_ALPHABET[b % TEMP_PASSWORD_ALPHABET.length]).join('')
}

function openForm() {
  formOpen.value = true
  justCreated.value = null
  createError.value = ''
}

function closeForm() {
  formOpen.value = false
  newUsername.value = ''
  newTempPassword.value = ''
  createError.value = ''
}

async function onCreate() {
  createError.value = ''
  creating.value = true
  try {
    const { user, tempPassword } = await createUser(newUsername.value.trim(), newTempPassword.value.trim())
    justCreated.value = { username: user.username, tempPassword }
    closeForm()
    await refresh()
  } catch (e) {
    const err = e as { data?: { statusMessage?: string } }
    createError.value = err?.data?.statusMessage || 'Vytvoření uživatele se nezdařilo.'
  } finally {
    creating.value = false
  }
}

async function onToggleStatus(user: AppUser) {
  togglingId.value = user.id
  try {
    if (user.status === 'blocked') await unblockUser(user.id)
    else await blockUser(user.id)
    await refresh()
  } finally {
    togglingId.value = null
  }
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('cs', { day: 'numeric', month: 'numeric', year: 'numeric' })
}
</script>

<template>
  <div class="admin-page">
    <div class="page-head">
      <h1>Uživatelé</h1>
      <button v-if="!formOpen" type="button" class="btn-primary" @click="openForm">+ Přidat uživatele</button>
    </div>

    <div v-if="justCreated" class="created-banner">
      <p>
        Uživatel <strong>{{ justCreated.username }}</strong> vytvořen. Dočasné heslo:
        <code>{{ justCreated.tempPassword }}</code>
      </p>
      <p class="created-hint">Sdělte ho uživateli — při prvním přihlášení si ho bude muset změnit.</p>
      <button type="button" class="dismiss-btn" @click="justCreated = null">Zavřít</button>
    </div>

    <form v-if="formOpen" class="create-form" @submit.prevent="onCreate">
      <div class="field">
        <label for="u-username">Uživatelské jméno</label>
        <input id="u-username" v-model="newUsername" type="text" required minlength="2" maxlength="32" />
      </div>
      <div class="field">
        <label for="u-temp-password">Dočasné heslo</label>
        <div class="password-row">
          <input id="u-temp-password" v-model="newTempPassword" type="text" placeholder="Necháte-li prázdné, vygeneruje se" />
          <button type="button" class="generate-btn" @click="generatePassword">Vygenerovat</button>
        </div>
      </div>
      <p v-if="createError" class="form-error">{{ createError }}</p>
      <div class="form-actions">
        <button type="button" class="btn-secondary" @click="closeForm">Zrušit</button>
        <button type="submit" class="btn-primary" :disabled="creating">
          {{ creating ? 'Vytvářím…' : 'Vytvořit' }}
        </button>
      </div>
    </form>

    <div class="user-list">
      <div v-for="u in users" :key="u.id" class="user-row" :class="{ blocked: u.status === 'blocked' }">
        <div class="user-main">
          <span class="user-name">{{ u.username }}</span>
          <span class="user-meta">
            <span v-if="u.status === 'blocked'" class="badge badge-blocked">Zablokován</span>
            <span v-else-if="u.mustChangePassword" class="badge badge-pending">Čeká na první přihlášení</span>
            <span v-else class="badge badge-active">Aktivní</span>
            <span class="user-created">od {{ formatDate(u.createdAt) }}</span>
          </span>
        </div>
        <button
          type="button"
          class="toggle-btn"
          :disabled="togglingId === u.id"
          @click="onToggleStatus(u)"
        >
          {{ u.status === 'blocked' ? 'Odblokovat' : 'Zablokovat' }}
        </button>
      </div>
      <p v-if="users && !users.length" class="empty">Zatím žádní uživatelé kromě správce.</p>
    </div>
  </div>
</template>

<style scoped>
.admin-page {
  max-width: 640px;
  margin: 0 auto;
  display: flex;
  flex-direction: column;
  gap: 18px;
}

.page-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.page-head h1 {
  margin: 0;
  font-family: 'Fraunces', serif;
  font-weight: 600;
  font-size: 22px;
  color: var(--text);
}

.btn-primary {
  font-family: 'IBM Plex Sans', sans-serif;
  font-weight: 600;
  font-size: 13.5px;
  border: none;
  border-radius: 8px;
  padding: 10px 14px;
  background: var(--accent);
  color: #fdf9f2;
  cursor: pointer;
}

.btn-primary:disabled {
  opacity: 0.7;
  cursor: default;
}

.btn-secondary {
  font-family: 'IBM Plex Sans', sans-serif;
  font-weight: 600;
  font-size: 13.5px;
  border: 1px solid var(--line);
  border-radius: 8px;
  padding: 10px 14px;
  background: transparent;
  color: var(--text);
  cursor: pointer;
}

.created-banner {
  background: rgba(111, 143, 92, 0.14);
  border: 1px solid var(--easy);
  border-radius: 10px;
  padding: 14px 16px;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.created-banner p {
  margin: 0;
  font-size: 13.5px;
  color: var(--text);
}

.created-banner code {
  font-family: 'IBM Plex Mono', ui-monospace, monospace;
  font-weight: 700;
  background: var(--surface);
  padding: 2px 6px;
  border-radius: 4px;
}

.created-hint {
  color: var(--text-dim) !important;
  font-size: 12px !important;
}

.dismiss-btn {
  align-self: flex-start;
  margin-top: 6px;
  background: none;
  border: none;
  color: var(--text-dim);
  font-size: 12px;
  text-decoration: underline;
  cursor: pointer;
  padding: 0;
}

.create-form {
  background: var(--surface);
  border-radius: 12px;
  padding: 16px;
  display: flex;
  flex-direction: column;
  gap: 14px;
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
  padding: 10px 12px;
  border-radius: 8px;
  border: 1px solid var(--rule);
  background: var(--surface);
  color: var(--surface-ink);
}

.password-row {
  display: flex;
  gap: 8px;
}

.password-row input {
  flex: 1;
  min-width: 0;
}

.generate-btn {
  flex: none;
  font-family: 'IBM Plex Sans', sans-serif;
  font-size: 12.5px;
  font-weight: 600;
  border: 1px solid var(--rule);
  border-radius: 8px;
  padding: 0 12px;
  background: transparent;
  color: var(--surface-ink);
  cursor: pointer;
}

.form-error {
  margin: 0;
  font-size: 12.5px;
  color: var(--hard);
}

.form-actions {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
}

.user-list {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.user-row {
  background: var(--surface);
  border-radius: 12px;
  padding: 13px 16px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  border-left: 4px solid var(--easy);
}

.user-row.blocked {
  border-left-color: var(--hard);
}

.user-main {
  display: flex;
  flex-direction: column;
  gap: 4px;
  min-width: 0;
}

.user-name {
  font-family: 'IBM Plex Mono', ui-monospace, monospace;
  font-weight: 600;
  font-size: 14.5px;
  color: var(--surface-ink);
}

.user-meta {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}

.badge {
  font-family: 'IBM Plex Mono', ui-monospace, monospace;
  font-size: 10.5px;
  font-weight: 600;
  padding: 3px 8px;
  border-radius: 999px;
}

.badge-active {
  background: rgba(111, 143, 92, 0.16);
  color: var(--easy);
}

.badge-pending {
  background: rgba(201, 138, 46, 0.16);
  color: var(--medium);
}

.badge-blocked {
  background: rgba(161, 66, 58, 0.16);
  color: var(--hard);
}

.user-created {
  font-size: 11.5px;
  color: var(--surface-ink-dim);
}

.toggle-btn {
  flex: none;
  font-family: 'IBM Plex Sans', sans-serif;
  font-size: 13px;
  font-weight: 600;
  border: 1px solid var(--rule);
  border-radius: 8px;
  padding: 8px 12px;
  background: transparent;
  color: var(--surface-ink);
  cursor: pointer;
}

.toggle-btn:disabled {
  opacity: 0.6;
  cursor: default;
}

.empty {
  color: var(--text-dim);
  padding: 24px 0;
  text-align: center;
}
</style>
