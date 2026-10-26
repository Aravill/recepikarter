declare module '#auth-utils' {
  interface User {
    username: string
    // 'admin' is the sole env-configured household account (see
    // AUTH_USERNAME/AUTH_PASSWORD_HASH); every DB-backed user row is 'user'.
    role: 'admin' | 'user'
    // True until a DB-backed user changes the temporary password an admin
    // set for them. Always false for the admin account.
    mustChangePassword: boolean
  }

  // Server-only (never sent to the client by /api/_auth/session).
  interface SecureSessionData {
    // Which credentials this session was issued against: the user row's
    // session_version, or for the admin a fingerprint of AUTH_PASSWORD_HASH.
    // A mismatch on a later request means the password changed since —
    // see requireActiveSession in server/utils/auth.ts.
    credentialVersion: string
  }
}

export {}
