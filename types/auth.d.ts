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
}

export {}
