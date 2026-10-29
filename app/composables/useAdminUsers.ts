import type { AdminUser, AppUser } from '#shared/types/user'

export function useAdminUsers() {
  // See app/composables/useRecipes.ts — SSR $fetch needs the cookie
  // forwarded explicitly or these all 401.
  const headers = import.meta.server ? useRequestHeaders(['cookie']) : undefined

  const listUsers = () => apiFetch<AdminUser[]>('/api/admin/users', { headers })
  const createUser = (username: string, tempPassword?: string) =>
    apiFetch<{ user: AppUser; tempPassword: string }>('/api/admin/users', {
      method: 'POST',
      body: { username, tempPassword: tempPassword || undefined },
      headers,
    })
  const blockUser = (id: number) => apiFetch<AppUser>(`/api/admin/users/${id}/block`, { method: 'POST', headers })
  const unblockUser = (id: number) => apiFetch<AppUser>(`/api/admin/users/${id}/unblock`, { method: 'POST', headers })
  const resetPassword = (id: number) =>
    apiFetch<{ user: AppUser; tempPassword: string }>(`/api/admin/users/${id}/reset-password`, {
      method: 'POST',
      headers,
    })

  const unlockUser = (id: number) => apiFetch(`/api/admin/users/${id}/unlock`, { method: 'POST', headers })

  return { listUsers, createUser, blockUser, unblockUser, resetPassword, unlockUser }
}
