# Clan Command

A separate, full-stack Clash of Clans clan-operations workspace. It lives under `apps/clan-command` so it does not replace or change the existing public site, Supabase data, Google Sheets, or anything in Google Drive. It models family clans, grouped main/alt bases, Builder Base and home-village progression, ranked leagues, 90-day war performance, history, alerts and rewards. The starter records are synthetic; the reference Sheets/Drive data is not copied or synchronized.

## Run locally

Requires Node 22.13+.

```bash
cd apps/clan-command
npm install
npm run dev
```

Optionally copy `.env.example` to `.env` and adjust local settings; Node loads it when the server starts. Open `http://localhost:4173`. The dev server binds to `0.0.0.0` and serves the API and React app from the same origin. The SQLite database is created at `.data/clan-command.sqlite` on first start. That directory is ignored by Git.

### Demo access

Demo mode is on for local development unless `DEMO_MODE=false` is set. It seeds fictional clan/player records **only when the new local database is empty**; it never clears or reseeds an existing database.

Use **Try a demo role** on the sign-in screen to choose Leader, Co-Leader, Elder, or Member. For direct password login, the local demo accounts use `leader@clan.demo`, `coleader@clan.demo`, `elder@clan.demo`, or `member@clan.demo` with the demo password `Clash2026!` (override it before the first seed using `CLANCMD_DEMO_PASSWORD`). All names and tags are synthetic demo records, not synced game accounts.

## Production notes

- Set `DEMO_MODE=false`. Demo login is disabled by default in production.
- For a new empty database, set `CLANCMD_ADMIN_EMAIL` and `CLANCMD_ADMIN_PASSWORD` to bootstrap the first Leader.
- Set a stable, private `CLANCMD_APP_SECRET` (32+ characters) before saving Discord webhook settings. If it is absent, a random local key is created under `.data`; losing that file means stored webhook credentials cannot be decrypted.
- Mount a persistent disk for `.data` and run one application instance unless SQLite is moved to a shared database. Back up the SQLite file and key together.
- Discord outbound notifications use a secure webhook (not a slash-command bot yet). URLs are encrypted at rest, never returned to the browser, and only HTTPS Discord webhook endpoints are accepted. Alerts start only after an authorized Leader saves and enables a webhook and its notification types; **Send test** is available from the integration page.
- The current player/base finder searches the app's stored roster. Live Supercell API lookup is not enabled until a clan supplies its own API credential and a server-side sync adapter is configured.

## Checks

```bash
npm run check
npm run build
```
