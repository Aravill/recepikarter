#!/usr/bin/env node
// Generates an AUTH_PASSWORD_HASH value for .env, using the same scrypt
// driver nuxt-auth-utils uses at runtime (server/utils via #auth-utils).
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

console.log(hashed)
