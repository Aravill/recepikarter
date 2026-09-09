---
name: verify
description: Sanity-check changes to recepikarter before calling a task done. Use after editing code in this repo, since there is no lint/test suite yet to catch mistakes automatically.
---

This repo has no lint, format, or test tooling configured yet, so `nuxt build` is the only automated check available. Run it after making changes, before telling the user something is done:

1. Run `npm run build`. This runs Nuxt's production build, which type-checks the whole project (`app/`, `server/`, `shared/`) and will fail on TypeScript errors or broken imports.
2. If it fails, read the error output carefully — Nuxt's auto-import system means a missing import is often a typo'd auto-imported name (composable, server util, or `#shared/types/recipe` alias) rather than a missing `import` statement.
3. If the change touches a page or component, also start `npm run dev` and manually exercise the affected flow in a browser — the build passing only proves it type-checks, not that the UI behaves correctly.
4. Report clearly that this was a build/type-check only, not a full test run — there is no test suite to fall back on.
