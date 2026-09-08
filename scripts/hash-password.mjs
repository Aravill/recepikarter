#!/usr/bin/env node
// Generates an AUTH_PASSWORD_HASH value for .env, using the same scrypt
// driver nuxt-auth-utils uses at runtime (server/utils via #auth-utils).
//
// Output is base64-encoded (decoded again in server/api/auth/login.post.ts).
// The raw hash is in PHC format ($scrypt$n=...,r=...,p=...$salt$hash) —
// Docker Compose parses .env files and interpolates any bare `$` it finds
// as a variable reference, silently corrupting the value. Base64 sidesteps
// that (and the same footgun in plain `source .env` in a shell) entirely.
//
// Usage: npm run hash-password -- "my-password"

import { Hash } from '@adonisjs/hash'
import { Scrypt } from '@adonisjs/hash/drivers/scrypt'

const password = process.argv[2]

if (!password) {
  console.error('Usage: npm run hash-password -- "<password>"')
  process.exit(1)
}

const hash = new Hash(new Scrypt({}))
const hashed = await hash.make(password)

console.log(Buffer.from(hashed, 'utf8').toString('base64'))
