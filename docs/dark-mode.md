# Dark mode

Working doc for the light/dark theme toggle. Supersedes the "committed
single theme (no light/dark toggle for now)" note in `design-system.md`.

## Approach

- **Mechanism:** a `data-theme="dark" | "light"` attribute on `<html>`.
  `app.vue`'s unscoped `:root` block keeps the existing light values as the
  default, and a `:root[data-theme='dark']` block overrides every token with
  a dark value. Everything else in the app already reads colors through
  `var(--token)`, so no component CSS changes beyond the toggle/toast
  themselves.
- **State:** `app/composables/useTheme.ts` exposes a Nuxt `useState<'light' |
  'dark'>('theme', …)` (SSR-safe shared ref, avoids leaking state across
  requests on the server process), plus `setTheme()` and `toggleTheme()`.
- **Persistence:** `localStorage['recepikarter-theme']`. Written on every
  `setTheme()` call, client-side only.
- **Anti-flash:** a tiny blocking inline script in `nuxt.config.ts`
  (`app.head.script`) runs before first paint, reads the same localStorage
  key, and sets `data-theme` on `<html>` directly — before Vue mounts, so
  the SSR-rendered light palette never flashes if the visitor has dark mode
  stored. `app/plugins/theme.client.ts` then syncs the reactive `useState`
  on mount so the toggle icon matches. The one accepted gap: the toggle
  *icon* itself can render as the SSR default (bulb-on) for a frame before
  hydration/mount sync it, on a visit where dark was stored — icon-only,
  not a full-page flash, and not worth a `<ClientOnly>` skeleton for a
  single-household app.
- **Where the toggle lives:** `app/components/ThemeToggle.vue`, rendered in
  `app/app.vue`'s `.header-actions`, immediately before the existing
  `.logout-btn`.

## Color palette

Dark values keep the same hue family as their light counterpart (warm
paper/ink, not a hue-inverted scheme), lifted/darkened for contrast against
a near-black (not pure-black) ground.

| Token | Light | Dark | Notes |
|---|---|---|---|
| `--bg` | `#efe9de` | `#1c1a17` | App shell background |
| `--bg-raised` | `#e3dbc8` | `#262320` | Header/nav bar, raised panels |
| `--line` | `#d8cfbe` | `#3a352e` | Hairlines/borders on the shell |
| `--text` | `#221f1c` | `#ede7da` | Primary text on the shell |
| `--text-dim` | `#6b6255` | `#a89e8c` | Secondary text on the shell |
| `--surface` | `#fbf8f2` | `#23201c` | Paper surface: list rows, detail panel, login card |
| `--surface-ink` | `#221f1c` | `#ede7da` | Primary text on `--surface` |
| `--surface-ink-dim` | `#6b6255` | `#a89e8c` | Secondary text on `--surface` |
| `--rule` | `#e6ddc9` | `#383329` | Dividers on `--surface` |
| `--accent` | `#b8502a` | `#d97a4f` | Brand accent: links, primary actions, focus — lightened so it still reads against a dark ground |
| `--easy` | `#6f8f5c` | `#86a874` | Difficulty stripe: Easy |
| `--medium` | `#c98a2e` | `#dba653` | Difficulty stripe: Medium |
| `--hard` | `#a1423a` | `#c15c52` | Difficulty stripe: Hard |

`color-scheme` is set to `dark` alongside the `[data-theme='dark']` block so
native form controls / scrollbars follow.

## Toggle UI

- Icon-only button, same visual weight as `.logout-btn` (34×34px, 1px
  `--line` border, 8px radius, `--text-dim` → `--text` on hover), placed
  directly to its left in `.header-actions`.
- Two inline SVG states sharing one bulb+base outline path (`currentColor`
  stroke): the "on" variant adds four radiating rays and fills the glass
  with `--accent`; the "off" variant is the bare outline, no rays, no fill.
- **Bulb on = light mode is currently active** (click it to go dark). **Bulb
  off = dark mode is currently active** (click it to go light). One button,
  toggle behavior — not two separate buttons.
- `aria-label`/`title` swap between "Přepnout na tmavý režim" and "Přepnout
  na světlý režim" depending on state.

## Activation pop-up

Fires only on the specific click that flips light → dark (`toggleTheme()`
returns `{ activatedDark: boolean }`; the toast only shows when that's
`true`). It does **not** show on page load just because dark happens to be
the persisted/active theme, and it does not show on dark → light.

- Renders as a small dismissible toast, bottom-center, fixed position,
  `--surface`/`--rule`/`--surface-ink` styling (so it themes correctly in
  both modes), auto-dismiss after 6s or an explicit ✕ close.
- Component: `app/components/InfoToast.vue`, generic (`message` prop +
  `dismiss` emit) — not dark-mode-specific, reusable if another feature
  needs a toast later.
- Czech copy (exact):

  > Tmavý režim je zapnutý. Stažené karty receptů se ale pořád vygenerují ve
  > světlém režimu, aby šetřily inkoust v tiskárně.

## Export/print stays light

`app/utils/exportCard.ts` (`exportCardPng`) is the single card-rasterization
path (used from both the card-stack quick-download and the detail page).
Since the front/back card faces are captured via `html-to-image`'s
`toCanvas()`, which reads each element's *computed* style (i.e. resolved
CSS custom properties) at capture time, the fix is to force the light
palette for the duration of the capture rather than to read/branch on the
live theme state in the component:

1. Read and stash `document.documentElement.getAttribute('data-theme')`.
2. Set it to `'light'` before calling `toCanvas()` for both faces.
3. Restore the previous value (or remove the attribute) in a `finally`
   block, so a mid-export toggle click or a thrown error can't leave the
   app stuck in light mode.

Print (`window.print()` in `app/pages/recipes/[id].vue`) is unaffected by
this change — it already renders only the (themed) `--surface`-based `.face`
markup under `@media print`, not a rasterized capture. That's a separate
pre-existing gap: printing while dark mode is active would print dark
ink-heavy card faces. Out of scope for this task (the requirement was
specifically about the PNG export/download path), but flagged here as a
follow-up: forcing light in a `@media print` override of the dark tokens
would close it, e.g. `@media print { :root { <light values again> } }`.
