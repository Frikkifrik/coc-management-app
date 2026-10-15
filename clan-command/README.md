# Misclicked Family · Clan Command

A mobile-first Clash of Clans family-management workspace for **Misclicked Main**, **Misclicked Feeder** and **Misclicked Academy**. The interface uses a bright, game-inspired village HUD—grass, painted wood, parchment and gold—while keeping the roster, applicant checks and event tools comfortable on phones and tablets.

## Run the local preview

Requires Node 22.13+ (the local API uses `node:sqlite`). From the repository root:

```bash
cd clan-command
npm install
npm run dev
```

Open `http://localhost:4173`. The Express API and Vite app are served from one origin and bind to `0.0.0.0`. The local SQLite database is created under `.data/` and seeded with fictional records on its first run. `.data/`, `.env` and build output are git-ignored.

The root page opens the **public recruitment search**; it does not require a login. Visit `/login` to enter the private command center. In development, use **Sandbox access → Leader** (or Co-Leader, Elder and Member) to explore role-specific screens. Demo names, tags, stats and history are synthetic. Direct demo passwords are `Clash2026!` for `leader@clan.demo`, `coleader@clan.demo`, `elder@clan.demo` and `member@clan.demo`.

## Modules

- **Family Hub** — totals across the three clans, live war status, clan tabs, member search, join/leave dates, former-member flags, account history, profile drawer and a registration form for a phone number, main tag and linked alt/baby tags. Phone numbers are kept only in this browser's local demo state; they are not returned by the public API.
- **Applicant Inspector** — cross-check a join-request tag against active and former family records, saved name/clan changes and account history. A secure Discord dispatch is available when a leader has configured a webhook. If not, the generated summary is copied locally.
- **CWL War Room** — random score-card draw, Town Hall and hero levels, estimated equipment levels, saved 3-star rate, co-leader placement suggestions for the three clans, and a Leader-only lock with a formatted roster message.
- **King of the Hill** — create and schedule events, accept/decline RSVPs, view the seeded live leaderboard, record stars and outcomes, and follow match progress.
- **Public Recruitment** — `/recruitment` or `/`; no sign-in is needed. Search a player or clan tag for rush estimate, lab purity, hero equipment, war 3-star rate and clan mobility timeline.
- **Base Builder** — Town Hall and War/Trophy/Farm filters, generated base diagrams, text-overlay preview, downloadable SVG image and copyable in-game deep-link format.
- Existing roster, war history/readiness, progression, ranked, alerts, rewards, Discord and account-management screens remain available in the workspace.

The CWL draft, event RSVP/scoring and contact-number demo state are saved to browser `localStorage` and synchronize across tabs. Main roster and clan records continue to use the full-stack SQLite API. Base layouts, equipment levels and non-Supercell progression metrics are **demo estimates**. Base-gallery link identifiers are samples, not verified Supercell layouts; substitute a real share code before importing into the game.

## Optional integrations

Copy `.env.example` to `.env` to configure integrations:

```bash
cp .env.example .env
```

- **Supabase client:** set `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`. The browser client is initialized only when both are present. It is an optional client setup; the included local workspace uses SQLite and continues to work when Supabase is unset.
- **Supercell API:** set `SUPERCELL_API_KEY` and `SUPERCELL_STATIC_IP_PROXY_URL` on the server. The proxy must be a trusted HTTP(S) egress proxy with a stable IPv4 address registered with Supercell. API calls use Undici's `ProxyAgent`; no browser code receives the API key. Until both settings exist, the app falls back to local mock data. If the proxy itself requires credentials, include them in the server-only proxy URL or run an authenticated gateway in front of it.
- **Discord:** Leaders can configure a HTTPS Discord webhook from the Discord integration page. The webhook is encrypted server-side and never returned to the browser. Applicant and locked-CWL summaries use the existing notification controls. Set a stable 32+ character `CLANCMD_APP_SECRET` before production use.

The optional Supercell client and derived profile scores do not invent actual game data: live Supercell profile fields are live when configured, while rush, lab and war-performance estimates remain clearly marked as estimates unless a data source supplies them.

## Production notes

- Set `DEMO_MODE=false` and bootstrap the first Leader with `CLANCMD_ADMIN_EMAIL` and `CLANCMD_ADMIN_PASSWORD`.
- Mount persistent storage for `.data`; back up the SQLite database and encryption key together. For multiple instances, move storage to a shared database.
- Configure the static-IP proxy and register its egress IP in Supercell's developer portal before enabling live calls.
- Apply your Supabase project's own Row Level Security policies before wiring private clan data to Supabase. Never place a service-role key in a `VITE_` variable.
- The no-login recruitment endpoint exposes only player/clan game-profile fields and membership milestones—never contact details or leadership notes. Review public visibility expectations before using real roster data.

## Checks

```bash
npm run check
npm run build
```
