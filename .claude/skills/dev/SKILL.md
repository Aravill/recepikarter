---
name: dev
description: The implement → verify → commit loop for recepikarter. Use when asked to build a feature, fix a bug, or make any code change in this repo that should end up as reviewable commits on a feature branch.
---

This is the end-to-end loop for a coding task in recepikarter. It composes the
`git-workflow` and `verify` skills — read both if they aren't already in
context; this skill says *when* to apply them, they say *how*.

## 1. Orient (before writing code)

- Read `CLAUDE.md` gotchas relevant to the area you're touching. The ones that
  bite most often: SSR `$fetch` must forward cookies, `recipes` columns need
  both the `CREATE TABLE` text *and* a `PRAGMA table_info` + `ALTER TABLE`
  upgrade, category/difficulty storage values are English while labels are
  Czech.
- Find the existing pattern before inventing one. Every kind of file already
  has at least one example: API route (`server/api/recipes/*.ts`), server util
  with a test (`server/utils/validate.ts` + `test/server/utils/`), composable
  (`app/composables/useRecipes.ts`), component (`app/components/`), shared
  type (`shared/types/recipe.ts`). Match its shape, naming and comment density.
- Make sure you're on a feature branch off `main` (per `git-workflow`). If not,
  create one — don't ask, it's reversible.
- If the task is ambiguous in a way that changes what you'd build, ask now, not
  after the code exists. Routine judgment calls are yours to make.

## 2. Implement in reviewable steps

- Break the work into the smallest steps that each leave the app buildable, in
  dependency order: schema/type → server util → API route → composable → UI.
  Each step becomes one commit (see step 4), so keep unrelated edits out of a
  step — a drive-by refactor is its own step, or is left alone.
- Stay in the repo's conventions: `<script setup lang="ts">`, scoped CSS using
  the `:root` tokens from `app/app.vue` (no Tailwind, no inline colors),
  Czech UI copy, English identifiers, Nitro method-suffixed route files.
- Server utils get a Vitest test under `test/` mirroring the source path. If
  the util relies on a Nitro auto-import other than `createError`, stub it in
  `test/setup.ts` the same way.
- Don't add dependencies without a reason you can state in one sentence, and
  say it in the commit body.

## 3. Verify

Run the `verify` skill in full before each commit that touches behaviour:
lint, test, build (then delete `.output/`). Use its risk table to decide
whether the browser check is needed — layout, new interactions, data flow and
auth changes get it; copy and single-value CSS tweaks don't.

Never commit with a failing lint, test or build. If a check fails and the fix
isn't obvious, stop and report the failure verbatim rather than working around
it (no `eslint-disable`, no `skip`, no `as any`).

## 4. Commit

One commit per step from §2, in order, conventional-commit format, per
`git-workflow`. Add only the files you changed by name. Commit as you go —
waiting until the end and splitting afterwards produces worse history.

## 5. Hand off

Finish with a report that a reviewer can pick up cold:

- branch name and the list of commits (`git log --oneline main..HEAD`)
- what was verified and how (which of lint/test/build/browser ran, and any
  browser flow you exercised)
- anything you deliberately left out, skipped or are unsure about — this is
  the first thing the reviewer should look at

Don't open a PR or push unless asked.
