import { randomBytes } from 'node:crypto'

// Excludes visually ambiguous characters (0/O, 1/l/I) since this is read
// off a screen by an admin and typed in by hand by whoever it's given to.
const TEMP_PASSWORD_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789'

export function generateTempPassword(length = 10): string {
  const bytes = randomBytes(length)
  let out = ''
  for (let i = 0; i < length; i++) {
    out += TEMP_PASSWORD_ALPHABET[bytes[i] % TEMP_PASSWORD_ALPHABET.length]
  }
  return out
}

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
