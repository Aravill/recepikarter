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
