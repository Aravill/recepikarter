import { createError } from 'h3'

// Nitro auto-imports these globally in the real app; outside that build
// context (i.e. under Vitest) they need to be provided explicitly.
process.env.RECIPE_DB_PATH ??= ':memory:'
;(globalThis as Record<string, unknown>).createError = createError
