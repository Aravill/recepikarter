# Design system

Single source of truth for styling across the app (login, list, detail) and
the printable card. If a page's CSS disagrees with this file, the file wins —
update the file first, then the page.

**Direction:** light, minimal "kitchen counter" shell with warm paper-colored
surfaces for anything recipe-related (list rows, the detail panel, the login
card). This mirrors the physical card itself — laminated paper on a counter —
so the web app and the printed object read as the same product. Committed
single theme (no light/dark toggle for now).

**Unifying motif:** the difficulty stripe. The printed card carries a
difficulty-colored band across the top (see `card-example-front.svg` /
`card-example-back.svg`). The app echoes it as a colored left border on every
list row and as the dot on difficulty pills — the same signal, glanceable, in
both the physical and digital object.

## Color

| Token | Hex | Usage |
|---|---|---|
| `--bg` | `#efe9de` | App shell background |
| `--bg-raised` | `#e3dbc8` | Header/nav bar, raised panels on the shell |
| `--line` | `#d8cfbe` | Hairlines/borders on the shell |
| `--text` | `#221f1c` | Primary text on the shell |
| `--text-dim` | `#6b6255` | Secondary text on the shell |
| `--surface` | `#fbf8f2` | Paper surface: list rows, detail panel, login card |
| `--surface-ink` | `#221f1c` | Primary text on `--surface` |
| `--surface-ink-dim` | `#6b6255` | Secondary text on `--surface` |
| `--rule` | `#e6ddc9` | Dividers on `--surface` |
| `--accent` | `#b8502a` | Brand accent: links, primary actions, focus |

Difficulty (the stripe — used nowhere else, so it always means the same thing):

| Token | Hex | Difficulty |
|---|---|---|
| `--easy` | `#6f8f5c` | Easy |
| `--medium` | `#c98a2e` | Medium |
| `--hard` | `#a1423a` | Hard |

> Note: `shared/types/recipe.ts` currently derives card accent color from
> **category** (`CATEGORY_COLORS`). That predates this decision and needs to
> change to derive from **difficulty** instead, to match the printed card and
> this doc. Category stays a plain text label / filter facet, uncolored.

## Type

Same three faces as the printed card, loaded once for the whole app:

```html
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Fraunces:wght@500;600;700&family=IBM+Plex+Sans:wght@400;500;600;700&family=IBM+Plex+Mono:wght@500;600;700&display=swap">
```

| Role | Family | Weight | Size (mobile) | Usage |
|---|---|---|---|---|
| Display L | Fraunces | 600 | 28px | Recipe name on the detail page |
| Display M | Fraunces | 600 | 17–19px | Recipe name in a list row, page titles |
| Body | IBM Plex Sans | 400 | 15px | Paragraphs, form fields, buttons |
| Label | IBM Plex Mono | 600 | 11px, uppercase, +0.08em tracking | Eyebrows, field labels, section headers |
| Data | IBM Plex Mono | 500 | 13px, tabular-nums | Times, servings, counts, step numbers |
| Footnote | IBM Plex Sans | 400 | 12px, `--text-dim`/`--surface-ink-dim` | Timestamps, hints |

All three faces carry `latin-ext`, so Czech diacritics (`á č ď é ě í ň ó ř š
ť ú ů ý ž`) render correctly — verified in `card-example-front.svg`.

## Space & shape

- Spacing scale (px): `4 8 12 16 24 32 48` — use `gap`, not stacked margins.
- Radius: `8px` controls (button/input/pill), `14px` panels (list rows, detail
  panel, login card). The printed card keeps its own `3.2mm` — unrelated
  scale, don't reconcile the two.
- Max content width: `640px`, centered — this is a personal recipe box, not a
  dashboard; a single readable column beats a wide layout on every screen
  size, mobile included. **Exception:** the detail page at desktop widths
  (see below) — screen efficiency wins there over the single-column rule.

## Components

- **Button, primary** — `--accent` fill, `--text` on it, `8px` radius.
- **Button, ghost** — transparent, `1px --line` border, used for secondary
  actions (Cancel, Print).
- **Input / select / textarea** — sit on `--surface` panels only (never
  directly on `--bg`); `1px --rule` border, `--accent` focus ring.
- **Pill** — now only ever a *selected-filter chip*: an accent-filled pill
  (with the difficulty dot when it's the difficulty chip) that appears once
  a category or difficulty is picked, with a ✕ to clear it. Neither filter's
  full option list is shown as always-visible pills any more — both live
  behind their own dropdown button next to the search field.
- **App icon** — `public/icon.svg`: a rounded card shape (`--surface` fill,
  `--line` border) with the `--accent` difficulty-stripe motif across the
  top, no text. Deliberately the same simple mark everywhere (browser tab,
  home-screen icon, header) rather than a detailed variant for larger sizes
  — it has to still read at 16px. Rasterized to `favicon.ico` (16/32px) and
  `apple-touch-icon.png` (180px) at build-adjacent time (`rsvg-convert`) —
  re-run that if `icon.svg` changes, these aren't generated automatically.
- **Icon buttons** — this app prefers a pictograph over a text label once the
  meaning is unambiguous from context: 🏷️ opens the category dropdown, 🎚️
  opens the difficulty dropdown, ☰/⊞ toggles list/card view, ↕ marks the sort
  control, ✎/⬇ edit/export a card from the stack. Text labels stay for
  actions that aren't self-evident from a glyph alone (Uložit, Smazat, the
  dropdown options themselves).
- **List row** — `--surface` panel, `14px` radius, **4px left border in the
  recipe's difficulty color**, name (Display M) + meta line (Data: category ·
  time · servings), chevron.
- **Search field** — sticky under the header on the list page, `Data`-styled
  placeholder, fuzzy match (no exact-substring requirement). Matches across
  Czech noun/adjective declensions too (searching "mouku" finds an ingredient
  stored as "mouky") via a light stemmer applied to both the query and the
  indexed text — see `shared/utils/czech-stem.ts`.
- **Bottom sheet** — the detail page's edit form. `--surface` panel anchored
  to the bottom, `20px` top-corner radius, collapsed to a `handle` (grabber +
  "Upravit recept" label + quick download/print icons) by default; drag (or
  tap the handle) to expand it over the preview. Save/Delete pinned at its
  bottom, outside the scrollable form area.
- **Card stack** — the list page's default view. Up to three cards layered
  behind the active one, each further back scaled down and faded slightly —
  reads like a phone's app-switcher deck. A sliver of the *previous* card
  also peeks out above the top card (smaller offset, more faded) whenever
  one exists, so the stack reads as reversible instead of implying you can
  only go further in. Drag the top card left/right to move to the
  previous/next match in the current search+filter+sort order (clamped at
  the ends, no wraparound); a small ‹ *n* / *total* › row below the deck
  does the same by click, for non-touch input. A tap (no drag) flips
  the top card between front/back (3D flip, mirrors the front/back tabs on
  the detail page's preview) — no visible flip button, since the gesture
  itself is the control. Holding the card still (not dragging) instead
  reveals two buttons in its corner — ✎ opens the recipe's detail/edit page,
  ⬇ exports it — hidden the rest of the time so they don't clutter the card;
  tapping anywhere while they're shown dismisses them back to the standard
  tap-to-flip/drag-to-swipe interactions, same gesture on touch and with a
  mouse alike.

## Pages

1. **Login** — username + password, nothing else. No self-registration. The
   brand banner (`public/banner.png`) sits above the form in place of a plain
   text wordmark.
2. **List** — search (fuzzy), with a 🏷️ category-picker and a 🎚️
   difficulty-picker dropdown side by side next to the search field, plus
   sort (name / time / difficulty / last updated, behind an ↕ icon).
   Defaults to the card stack (see Components); a ☰/⊞ icon button toggles a
   traditional row list, and back. Changing the search, filter, or sort
   resets browsing to the first card. Result count reads "Nalezeno: *n*",
   not a grammatically pluralized "*n* receptů" — simpler, and avoids
   Czech's three-way plural agreement entirely.
3. **Detail** — one page for view, edit, *and* create. On mobile, opens
   straight onto the full pre-rendered card preview (front/back tabs) —
   reading a recipe never starts with text boxes. Editing lives in the
   bottom sheet, collapsed by default. Creating a new recipe opens the same
   layout with the sheet already expanded (nothing to preview yet), empty
   fields, no Delete button. **At desktop widths (≥900px)** the same markup
   switches to a two-column layout instead — edit panel on the left, the
   card preview sticky on the right — since there's room for both at once
   and the drag-to-expand sheet interaction doesn't make sense with a mouse.
   The sheet is always fully shown (its collapse/expand state becomes a
   no-op); nothing else about the page changes.

## Reference files

- `card-example-front.svg`, `card-example-back.svg` — the printed card at
  true scale, difficulty stripe shown in "Hard".
- `screen-login.html`, `screen-list.html`, `screen-detail.html` — standalone,
  real-markup references for the three app screens. Open directly in a
  browser (mobile viewport recommended).
- `banner.html` / `banner.png` — the wide brand banner (wordmark + tagline +
  scattered difficulty-stripe cards). Also served live as `public/banner.png`
  on the login page — keep both copies in sync when it changes. Re-render
  after editing the HTML with a headless browser screenshot at 1200×630, 2x
  device scale.
- `header-bg.html` — generates `public/header-bg.png`, the subtle scattered
  difficulty-stripe-card texture behind `.app-header` (no wordmark text baked
  in — the header already renders its own). Wide and short (2400×200) so
  `background-size: cover` on the header crops it gracefully at any viewport
  width. Re-render the same way as the banner.
