import { passwordPolicyMessage, passwordPolicyViolations } from '#shared/utils/password-policy'

const USERNAME_PATTERN = /^[a-zA-Z0-9_-]{2,32}$/

export function parseUsername(value: unknown): string {
  const username = typeof value === 'string' ? value.trim() : ''
  if (!USERNAME_PATTERN.test(username)) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Uživatelské jméno musí mít 2–32 znaků: písmena, číslice, pomlčku nebo podtržítko',
    })
  }
  return username
}

export function assertPasswordPolicy(password: string, username: string): void {
  const violations = passwordPolicyViolations(password, username)
  if (violations.length) {
    throw createError({ statusCode: 400, statusMessage: passwordPolicyMessage(violations) })
  }
}
