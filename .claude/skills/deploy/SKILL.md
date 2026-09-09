---
name: deploy
description: Deploy recepikarter to the self-hosted home server via Docker Compose. Use when the user asks to deploy, ship, or push this app live.
disable-model-invocation: true
---

Deploy this app by rebuilding and restarting the Docker Compose stack.

1. Confirm `.env` exists at the repo root. If it doesn't, copy it from `.env.example` and tell the user to fill in `AUTH_USERNAME`, `AUTH_PASSWORD_HASH`, and `NUXT_SESSION_PASSWORD` before continuing — do not guess values.
2. If `AUTH_PASSWORD_HASH` is missing or the user wants to change the password, generate it with `npm run hash-password -- "the-password"` and have the user paste the printed value into `.env`. Never hand-construct or hand-paste a raw PHC hash directly — it must go through this script (see the `.env` parsing gotcha in CLAUDE.md).
3. Run `docker compose up -d --build` from the repo root.
4. Confirm the container is healthy: `docker compose ps` and `docker compose logs --tail=50 app`.
5. Report the port the app is listening on (from `PORT` in `.env`, default 3000) so the user can verify it in a browser.

This is a manual home-server deploy — there is no CI/CD and no reverse proxy config in this repo. Treat `docker compose up -d --build` and any restart as affecting a live, in-use household app; confirm with the user before running it if there's any ambiguity about intent.
