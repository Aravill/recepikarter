import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { createError } from 'h3'

// Nitro auto-imports these globally in the real app; outside that build
// context (i.e. under Vitest) they need to be provided explicitly.
process.env.RECIPE_DB_PATH ??= ':memory:'
// Photos are written to real files, so give them a throwaway directory
// instead of the project's data/photos.
process.env.RECIPE_PHOTOS_DIR ??= mkdtempSync(join(tmpdir(), 'recepikarter-photos-'))
;(globalThis as Record<string, unknown>).createError = createError
