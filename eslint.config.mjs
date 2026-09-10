// @ts-check
import withNuxt from './.nuxt/eslint.config.mjs'

export default withNuxt(
  // Ephemeral git worktrees for isolated background/agent work land under
  // .claude/worktrees/ inside this repo tree — each is its own separate
  // checkout with its own (possibly mid-setup, or just differently-scoped)
  // eslint.config.mjs, so `eslint .` here must not recurse into it.
  { ignores: ['.claude/worktrees/**'] },
)
