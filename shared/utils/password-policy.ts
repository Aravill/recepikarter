// Rules for any password a person chooses — a user's own new password and
// a temporary one an admin types in by hand. Shared so the forms can show
// the same rules the API enforces. The admin's own password lives in .env
// (see scripts/hash-password.mjs) and isn't checked here.

export const PASSWORD_MIN_LENGTH = 10
// scrypt hashes the whole input, so an unbounded password is a cheap way to
// burn server CPU.
export const PASSWORD_MAX_LENGTH = 128

interface PasswordRule {
  label: string
  test: (password: string, username: string) => boolean
}

export const PASSWORD_RULES: PasswordRule[] = [
  { label: `alespoň ${PASSWORD_MIN_LENGTH} znaků`, test: (p) => p.length >= PASSWORD_MIN_LENGTH },
  { label: `nejvýše ${PASSWORD_MAX_LENGTH} znaků`, test: (p) => p.length <= PASSWORD_MAX_LENGTH },
  { label: 'malé písmeno', test: (p) => /\p{Ll}/u.test(p) },
  { label: 'velké písmeno', test: (p) => /\p{Lu}/u.test(p) },
  { label: 'číslici', test: (p) => /\d/.test(p) },
  {
    label: 'nesmí obsahovat uživatelské jméno',
    test: (p, username) => !username || !p.toLowerCase().includes(username.toLowerCase()),
  },
]

// Labels of the rules the password breaks, in display order — empty means
// it passes.
export function passwordPolicyViolations(password: string, username = ''): string[] {
  return PASSWORD_RULES.filter((r) => !r.test(password, username)).map((r) => r.label)
}

export function passwordPolicyMessage(violations: string[]): string {
  return `Heslo nesplňuje požadavky: ${violations.join(', ')}.`
}

// Excludes visually ambiguous characters (0/O, 1/l/I) since this is read
// off a screen by an admin and typed in by hand by whoever it's given to.
const TEMP_PASSWORD_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789'

// Used both server-side (POST /api/admin/users with no password given) and
// by the admin form's "Vygenerovat" button. Redraws until the result meets
// the policy, which takes a couple of tries at most with this alphabet.
export function generateTempPassword(username = '', length = 12): string {
  for (;;) {
    const bytes = globalThis.crypto.getRandomValues(new Uint8Array(length))
    const out = Array.from(bytes, (b) => TEMP_PASSWORD_ALPHABET[b % TEMP_PASSWORD_ALPHABET.length]).join('')
    if (!passwordPolicyViolations(out, username).length) return out
  }
}
