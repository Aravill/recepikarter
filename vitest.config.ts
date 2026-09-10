import { fileURLToPath } from 'node:url'
import { configDefaults, defineConfig } from 'vitest/config'

export default defineConfig({
  resolve: {
    alias: {
      '#shared': fileURLToPath(new URL('./shared', import.meta.url)),
    },
  },
  test: {
    setupFiles: ['./test/setup.ts'],
    // Ephemeral git worktrees for isolated background/agent work land under
    // .claude/worktrees/ inside this repo tree — each is its own separate
    // checkout with its own test/ dir, so the default test-file glob must
    // not pick those up too.
    exclude: [...configDefaults.exclude, '.claude/worktrees/**'],
  },
})
