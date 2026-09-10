# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Stack

Nuxt 4 (Vue 3 + Nitro), TypeScript throughout. `better-sqlite3` for storage — no ORM, no migration system; schema lives inline in `server/utils/db.ts` as `CREATE TABLE IF NOT EXISTS`. Auth is `nuxt-auth-utils` session cookies for a single hardcoded household account (no multi-tenant accounts, no OAuth).

Linting (ESLint via `@nuxt/eslint`) and unit testing (Vitest) are configured; there is no formatter/format script. Don't assume beyond that — check before referencing a command.

## Commands

- `npm run dev` — dev server at `http://localhost:3000`, DB auto-created at `data/recipes.sqlite`
- `npm run build` / `npm run preview` — production build / preview it locally
- `npm run lint` — ESLint over the whole project
- `npm run test` — Vitest, runs everything under `test/`
- `npm run hash-password -- "your-password"` — generates `AUTH_PASSWORD_HASH`; **always use this script**, never hand-paste a raw hash (see gotcha below)

## Gotchas

- **`AUTH_PASSWORD_HASH` must stay base64-encoded.** The raw scrypt hash is PHC format (`$scrypt$n=...,r=...,p=...$salt$hash`) and both Docker Compose's `.env` parser and `source .env` treat bare `$` as a variable reference, silently corrupting it. Always regenerate via `npm run hash-password`.
- **SSR fetches must forward cookies explicitly.** `$fetch` calls made server-side (e.g. in composables like `app/composables/useRecipes.ts`) don't forward cookies automatically — pass `useRequestHeaders(['cookie'])` or the request 401s.
- **Category/difficulty storage values are English; UI labels are Czech.** `shared/types/recipe.ts` deliberately decouples the two (`CATEGORIES`/`DIFFICULTIES` enums vs. `CATEGORY_LABELS`/`DIFFICULTY_LABELS` maps) — don't collapse them.
- **Card accent color is derived from difficulty, not category**, but `docs/design-system.md` still flags this as an unresolved naming/logic inconsistency (`CATEGORY_COLORS` vs. difficulty-derived color). Treat it as a known open TODO, not settled behavior, if touching card color logic.
- `scripts/hash-password.mjs` imports `@adonisjs/hash` directly even though it's not a declared dependency in `package.json` (it resolves transitively via `nuxt-auth-utils`). Fragile — if it breaks after a `nuxt-auth-utils` bump, that's why.
- **Vitest runs outside Nuxt's build context**, so Nitro's auto-imports aren't available for free. `test/setup.ts` stubs the one server util under test needs (`createError`, from `h3`) onto `globalThis`, and sets `RECIPE_DB_PATH=':memory:'` before `server/utils/db.ts` is imported. `vitest.config.ts` also has to alias `#shared` to `./shared` by hand. Adding tests for a util that relies on another auto-import needs the same treatment in `test/setup.ts`.
- **Adding a column to `recipes` needs two changes in `server/utils/db.ts`, not one.** `CREATE TABLE IF NOT EXISTS` only runs against a database that doesn't exist yet, so a fresh install picks up a column added there, but any already-deployed database won't. Follow the `last_exported_at` precedent: add the column to the `CREATE TABLE` text *and* add an idempotent `PRAGMA table_info` check + `ALTER TABLE ... ADD COLUMN` right after it, so an existing database gets upgraded in place on next start.

## Conventions

- No Tailwind. Styling is scoped `<style scoped>` CSS per component, using CSS custom properties defined globally in `app/app.vue`'s unscoped `<style>` block against `:root`. Design tokens (colors, type scale, spacing, radii) are documented in `docs/design-system.md`.
- API routes use Nitro's HTTP-method-suffix convention (`index.get.ts`, `[id].put.ts`, etc.), not an Express-style router.
- `/recipes/new` is handled inside `app/pages/recipes/[id].vue` by treating the literal string `"new"` as `route.params.id`, rather than a separate route.
- UI copy is Czech (`lang="cs"`); code/identifiers stay in English.
- Env vars: `AUTH_USERNAME`, `AUTH_PASSWORD_HASH` (see gotcha above), `NUXT_SESSION_PASSWORD` are required — see `.env.example`. `RECIPE_DB_PATH` is an optional override for the SQLite file location (defaults to `./data/recipes.sqlite`), not listed in `.env.example`.
- Deployment is manual: `docker compose up -d --build` on a self-hosted home server. No CI/CD, no reverse proxy config in this repo.
- Use feature branches + PRs for new work going forward, even though earlier history committed directly to `main`.
