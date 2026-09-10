---
name: verify
description: Sanity-check changes to recepikarter before calling a task done. Use after editing code in this repo — runs lint, tests, and a type-checking build.
---

Run these after making changes, before telling the user something is done:

1. `npm run lint` — ESLint via `@nuxt/eslint`. There's no formatter configured, so this is the only automated style/correctness check besides the build.
2. `npm run test` — Vitest. Currently covers `server/utils/validate.ts` and `server/utils/db.ts`. If you add or change a server util, add or update its test under `test/server/utils/`.
3. `npm run build`. Runs Nuxt's production build, which type-checks the whole project (`app/`, `server/`, `shared/`) and will fail on TypeScript errors or broken imports. Remove the generated `.output/` directory afterwards — it's a build artifact, not something to commit.
4. If the build fails, read the error output carefully — Nuxt's auto-import system means a missing import is often a typo'd auto-imported name (composable, server util, or `#shared/types/recipe` alias) rather than a missing `import` statement.
5. If the change touches a page or component, also start `npm run dev` and manually exercise the affected flow in a browser — none of the above prove the UI behaves correctly, only that it type-checks and the covered logic still works.

## When step 5 is actually worth it

Match the check to the risk instead of always running the full browser loop below:

- **Skip the browser, lint/test/build is enough**: copy-only edits, a single CSS value tweak (color, spacing) with no layout change, anything with no behavioral surface.
- **Do the full browser check**: new interactions, layout/responsive changes, anything touching data flow (API routes, `server/utils/db.ts`, auth), or CSS that could plausibly break at a breakpoint or overlap other elements.

## Browser verification procedure

The app requires auth, so a real check needs a session. This is the fastest known-working path — don't re-derive it from scratch:

1. **Temp credentials**: `cp .env .env.bak.verify`, then `npm run hash-password -- "temp-verify-pw-1"` and swap the printed hash into `.env` in place of `AUTH_PASSWORD_HASH` (keep `AUTH_USERNAME` as-is). Restore `.env` from the backup and delete the backup when done — always, even if the check fails.
2. **Dev server**: run on a non-default port (`npm run dev -- --port 3001`) in the background, since something else may already be using 3000/3001 — check with `lsof -ti:<port> -sTCP:LISTEN` first and pick a free one, don't assume. Poll `curl -sf http://localhost:<port>/login` until it responds rather than sleeping a fixed time.
3. **Seed data**: log in via `curl -X POST /api/auth/login` to get a session cookie (parse it out of the `set-cookie` response header), then `curl -X POST /api/recipes` with that cookie to create however many test recipes the check needs. Faster and more precise than creating them through the UI.
4. **Playwright**: `chromium` + its matching browser build are already cached on this machine from prior sessions (`~/.cache/ms-playwright`) — a scratch-dir `npm init -y && npm install playwright@<version> --no-save` is enough, no fresh browser download needed unless versions mismatch (if so, `npx playwright install chromium` once). Write one script that does everything the check needs in a single run rather than a separate script per assertion — cut to the screenshots that actually need a human/model to look at them, not one per intermediate state.
5. **Clean up unconditionally**: kill only the dev server on the specific port used (never a broad `pkill`), restore `.env`, delete any `data/recipes.sqlite*` files the seeding created.

## Reading files during a fix

Don't re-read a whole file just to get context you already have from this turn's edits — the harness already confirms an edit landed, per the standing instruction not to re-read post-edit. For a large file (`CardStack.vue`, `[id].vue`), prefer `grep -n` for the section you need plus a targeted `Read` with `offset`/`limit` over a full re-read, unless you genuinely need the whole file's current state (e.g. after external changes, or before a series of edits spanning most of it).
