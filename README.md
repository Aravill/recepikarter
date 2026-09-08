# Recepikarter

A small, self-hosted recipe box. Recepikarter manages a family's recipes as
structured records — name, category, cook time, difficulty, servings,
ingredients, steps, tags — and turns each one into a laminated, pocket-sized
recipe card you can actually keep in a drawer: front side for the
ingredients and the vitals, back side for the method, sized to slip into a
pocket (Xiaomi 17 footprint, 71.8 × 150.5 mm) and cut after laminating.

The point isn't just data entry. Editing a recipe shows the same
pre-rendered card design you'll end up holding, difficulty coded by a color
stripe, so what you see while typing is what comes out of the printer —
never a raw form pretending to be the product.

## What it does

- **Create, edit, delete, browse** recipes through a small Vue/Nuxt web app,
  fuzzy-searchable and filterable by category or difficulty.
- **Stores** each recipe as a plain row in a local SQLite database — no
  external service, easy to back up, easy to inspect.
- **Renders** every recipe as a two-sided printable card and lets you
  download it (or print it directly) for lamination.
- **Runs** on a home server for a single household — a login page, not a
  multi-tenant accounts system.

## Stack

- [Nuxt 4](https://nuxt.com) (Vue 3 + Nitro) — one framework for the API and
  the UI, self-hosted.
- `better-sqlite3` for storage (`data/recipes.sqlite`, gitignored).
- `html-to-image` to export the rendered card as a printable PNG.

## Design

The visual language — palette, type, spacing, components — is documented in
[`docs/design-system.md`](docs/design-system.md), with the approved
reference designs alongside it:

- `docs/card-example-front.svg`, `docs/card-example-back.svg` — the printed
  card at true scale.
- `docs/screen-login.html`, `docs/screen-list.html`,
  `docs/screen-detail.html` — the three app screens, real markup, openable
  directly in a browser.

## Development

```bash
npm install
npm run dev
```

The app runs at `http://localhost:3000`. The SQLite database is created on
first run at `data/recipes.sqlite` (override with `RECIPE_DB_PATH`).

```bash
npm run build     # production build
npm run preview   # preview the production build locally
```

## Deployment (Docker)

```bash
cp .env.example .env
npm run hash-password -- "your-password"   # paste the output into .env
docker compose up -d --build
```

The app is then at `http://localhost:3000` (override the host port with
`PORT` in `.env`). The SQLite database lives in a named volume
(`db-data:/app/data`) so it survives rebuilds and restarts.

`AUTH_PASSWORD_HASH` is deliberately base64-encoded in `.env` — the raw
scrypt hash is in PHC format (`$scrypt$n=...,r=...,p=...$salt$hash`), and
both Docker Compose's `.env` parser and a plain shell `source .env` treat
bare `$` as a variable reference, silently corrupting it. Always generate
the value with `npm run hash-password`, never paste a raw hash in by hand.
