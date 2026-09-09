---
name: git-workflow
description: Git conventions for this repo — branch-per-feature, atomic commits, conventional-commit messages. Use whenever starting new work or about to commit in recepikarter.
---

## Branching

- Never work directly on `main`. Before starting any non-trivial change, create a feature branch off `main` if you're not already on one: `git checkout -b <type>/<short-kebab-description>` (e.g. `feat/recipe-search`, `fix/ssr-cookie-forward`). Creating a branch is a safe, reversible step — do it without asking first.
- One branch per logical unit of work. Don't pile unrelated features onto the same branch.
- Never push directly to `main`. Work lands via PR (see the `commit-push-pr`-style flow, or `gh pr create`).

## Commits

- Keep commits atomic: each commit is one logical, ideally buildable change. Don't squash unrelated edits (e.g. a refactor + a new feature) into one commit — split them.
- When a task naturally breaks into steps (e.g. "add schema field" → "wire it into the API" → "surface it in the UI"), commit each step separately in that order, so the history reads as a logical stack building toward the feature, not one flat diff.
- Message format: [Conventional Commits](https://www.conventionalcommits.org/) — `<type>(<scope>): <short summary>`. Scope is optional, omit it when the change isn't scoped to one area.
  - Types: `feat`, `fix`, `refactor`, `chore`, `docs`, `style`, `test`, `perf`.
  - Subject line: imperative mood, no trailing period, aim for under ~60 characters. Example: `feat(recipes): add fuzzy search on ingredients`.
  - Only add a body when the *why* isn't obvious from the diff or subject — skip it otherwise. Never restate the diff.
- Still only commit when the user has actually asked for it in this session (per standing instructions) — this skill governs the *shape* of commits/branches, not whether to make one unprompted.

## Still applies from standing git safety rules

Never force-push, never skip hooks, never amend published commits, always run `git status` before anything destructive, and only add specific files by name (no blanket `git add -A`).
