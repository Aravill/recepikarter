import type { AppUser } from '#shared/types/user'

export function useAdminUsers() {
  // See app/composables/useRecipes.ts — SSR $fetch needs the cookie
  // forwarded explicitly or these all 401.
  const headers = import.meta.server ? useRequestHeaders(['cookie']) : undefined

  const listUsers = () => $fetch<AppUser[]>('/api/admin/users', { headers })
  const createUser = (username: string, tempPassword?: string) =>
    $fetch<{ user: AppUser; tempPassword: string }>('/api/admin/users', {
      method: 'POST',
      body: { username, tempPassword: tempPassword || undefined },
      headers,
    })
  const blockUser = (id: number) => $fetch<AppUser>(`/api/admin/users/${id}/block`, { method: 'POST', headers })
  const unblockUser = (id: number) => $fetch<AppUser>(`/api/admin/users/${id}/unblock`, { method: 'POST', headers })

  return { listUsers, createUser, blockUser, unblockUser }
}
