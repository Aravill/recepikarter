# Recipe photos + gallery view

Status: implemented 2026-09-13 on `feat/recipe-photos`. Kept as the design
rationale; the code is the source of truth for details (column name ended up
`photo_file`, photo changes apply on Uložit rather than immediately).

## Feature

Each recipe can have one photo of the finished meal. The photo is **not** shown
on the recipe card — the card stays the clean, printable/exportable artifact it
is today. The photo lives in two places instead:

1. **Detail page** (`/recipes/[id]`) — full-width hero above the card preview,
   with upload / replace / remove in the form.
2. **Gallery** — a third homepage view next to cards and list.

Optional later: a small "📷" chip in the card footer that opens a lightbox.
Not part of the first pass.

## Why not on the card

- The card is a fixed 502px layout with a 16px difficulty stripe as its top
  accent; a hero banner would either eat ingredient space (which already has
  overflow-protection CSS) or duplicate the stripe's role.
- The card doubles as the PNG export (`app/utils/exportCard.ts`) — a card with
  a photo is a different design object.

## Storage

- Files on disk under `data/photos/`, not BLOBs in SQLite. `data/` is already
  the Docker volume (`db-data:/app/data`), so photos survive rebuilds with no
  compose change. Phone photos are 3–8 MB each; BLOBs would bloat the DB and
  every `SELECT *`.
- Two variants written at upload time via `sharp` (the one new dependency):
  - `~1600px` main image for the detail hero
  - `~600px` thumbnail for the gallery grid
  Re-encode as WebP/JPEG; this also strips EXIF and fixes phone-camera
  rotation. Check the Dockerfile base image is `sharp`-compatible
  (`node:*-slim` is usually fine).
- New column `photo_path TEXT` on `recipes`. Follow the `last_exported_at`
  precedent in `server/utils/db.ts`: add to the `CREATE TABLE` text **and** the
  `PRAGMA table_info` / `ALTER TABLE` upgrade block (see CLAUDE.md gotcha).

## API

New routes next to `server/api/recipes/[id]/export.post.ts`:

- `POST /api/recipes/[id]/photo` — h3 `readMultipartFormData`, validate MIME
  and size cap, run through `sharp`, write both variants, update the column.
- `GET /api/recipes/[id]/photo?size=thumb|full` — stream the file back behind
  the same auth check so nothing under `data/` is served publicly.
- `DELETE /api/recipes/[id]/photo` — remove files + null the column.
- Extend the existing `[id].delete.ts` to clean up photo files.
- JSON import / AI-prompt flow does not carry photos. Known, accepted gap.

## UI

### Form (`app/components/RecipeForm.vue`)

- `<input type="file" accept="image/*" capture="environment">` so it opens the
  camera on a phone. Preview before save; replace / remove buttons.

### Detail page (`app/pages/recipes/[id].vue`)

- Photo hero full-width above the card preview. This is where "hero banner"
  belongs.

### Gallery (`app/pages/index.vue`)

- `viewMode` becomes a three-state cycle `cards → list → gallery → cards`
  (or a segmented control) — today it's a single button toggling two states.
- CSS grid of tiles, `aspect-ratio: 4/3`, `object-fit: cover`; 2 columns on
  phone, 3–4 on desktop. Uses the thumbnail variant.
- Tile: photo full-bleed, name + category eyebrow over a bottom gradient, thin
  difficulty-colour edge so it rhymes with the card.
- Tap → recipe detail page (same as list rows).
- Recipes **without** a photo still appear, as a flat placeholder tile in the
  difficulty colour with the name centred — the gallery isn't a mystery subset
  and it nudges you to add photos.
- Consumes the existing `sorted` pipeline, so search / filter / sort apply
  unchanged.

### Export gotcha

`html-to-image` needs images same-origin (they are, via the API route) and
loaded before capture. Only relevant if a photo ever lands on the card.

## Suggested order

1. `sharp` + `photo_path` column + upload/serve/delete routes
2. Form upload UI + detail-page hero
3. Gallery view
