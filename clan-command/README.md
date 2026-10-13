# Misclicked Family · Clan Command

A dark, mobile-first Clash of Clans tracker: player progression, a multi-slot builder calendar, an upgrade plan, the full asset collection, war and CWL comparison, and the clan roster. Black surfaces, red/teal accents, bottom pill navigation.

`/` **is** the app. `/clash`, `/app/*` and `/recruitment` all resolve into it, so old links keep working. `/login` raises a session — only needed for live Supercell lookups, which go through a session-gated server route.

## Clash Command (mobile)

A dark, thumb-first tracker built around one player and their clan.

**Navigation**

- Top bar: back arrow, player or clan title with `#TAG`, share, settings, info.
- View selector: a full-width `#121214` dropdown switching Home Village → Builder Base → Calendar → Plan → Collection. The active row is `#3B1515` with a red check.
- Bottom nav: a floating `#18181A` pill with Home / Profile / Clan / War; the active route is a `#28282B` pill.

**Screens**

- **Home Village & Builder Base** — an upgrade tracker listing Buildings, Defenses, Traps, Supercharge, Heroes, Guardians, Laboratory, Equipment, Pets and Walls (Builder Base shows only the six categories that exist there). Each row carries a completion pill: gold border and amber text at exactly 100%, red border and red text below it. Tapping a row opens a drill-down where you can set levels, toggle seasonal supercharges, edit wall segments, or push an item into the plan.
- **Calendar** — a multi-slot Gantt: a date-range navigator over horizontally scrolling day columns, a fixed `Slot 1`–`Slot 5` axis, blue-tinted task cards (`#131926` on `border-blue-500/50`) showing asset, level and remaining time, plus a live "now" marker. Tasks can be moved between slots and shifted by day.
- **Plan** — a prioritised upgrade queue with per-resource budgets, a catalog picker, and JSON export/import.
- **Collection** — every asset in `grid-cols-5 gap-2.5` galleries with absolute bottom-right level badges (`bg-black/80`, `border-neutral-700`), searchable and filterable to maxed / still upgrading.
- **War & CWL** — a dual-team comparison bar (green home, red opponent) for contested stars and destruction, the attack feed, CWL group standings ranked #1–#8, and gradient history cards with `3W 0T 4L` pills, stars and destruction.
- **Clan** — clan header with the family switcher, war-readiness summary, and a sortable, searchable roster.

**Design tokens** (implemented in `src/clash/clash.css`, scoped to `.clash-app` so the bright workspace is untouched): root `#000000`; cards `#0F0F10` with `border-[#27272A]/40` and `rounded-2xl`; inner surfaces `#18181A` / `#1F1F22`; popover `#121214`; accent red `#E52E2E` / `#D92626` with `#3B1515` active states; success `#10B981` / `#00C29A`; builder-schedule blue `#131926` with `border-blue-500/50`.

**Data**

- Level caps follow the public **Town Hall 17** reference sheet (heroes cap at BK/AQ 100, Minion Prince 90, Grand Warden 75, Royal Champion 50; walls 18 across 325 segments; equipment 18 common / 27 epic; Laboratory 15, Blacksmith 10, Hero Hall 11, Pet House 11). See `src/clash/catalog.ts`.
- The seeded village is demo data held in `localStorage`. **Sync live** calls the Supercell player endpoint through this app's own server and maps heroes, guardians, equipment, pets and lab levels. Buildings, defences, traps, supercharge and walls are *not* in that API response, so they stay local or come from a JSON import — the UI states this instead of implying a full sync.
- **JSON import/export** round-trips progression, plan, schedule, roster and linked tags.
- In-game API tokens are stored as a fingerprint only; verification runs against whichever ClashKing / ClashOfStats endpoint you configure.

**Artwork policy — no generated images.** Tiles render an official Supercell icon when an `iconUrl` is supplied by the live API or a JSON import; otherwise they show a neutral typographic mark with a category accent. Nothing in this app generates, simulates or guesses game artwork. Brand logos are used exactly as provided, without recolouring or cropping.

**Checks**

```bash
npm run check     # tsc --noEmit
npm run build     # vite build && tsc
npm run smoke     # headless jsdom render of every screen (npm i --no-save jsdom)
```

`npm run smoke` mounts the real component tree, drives the bottom nav and the view selector through all four routes and five views, and asserts the completion maths on the seeded village. Add `--report` to print the category table.

## Retired: the bright workspace

The earlier sidebar workspace (dashboard, family hub, applicant inspector, CWL war room, King of the Hill, base builder, ranked, rewards, alerts, Discord settings) has been removed in favour of this app. Its last state is commit `4227041` if a screen needs reviving.

Two things from it were worth keeping and now live inside the mobile shell:

- **Public player/clan search** — Clan screen → **Scout a tag**. Same `/api/public-search` endpoint, same public-only fields.
- **Sign-in and sandbox roles** — the dark sign-in at `/login`, using the same `/api/auth/*` routes.

The Express API, SQLite store, Supercell proxy and Discord webhook encryption are unchanged.

## Run the local preview

Requires Node 22.13+ (the local API uses `node:sqlite`). From the repository root:

```bash
cd clan-command
npm install
npm run dev
```

Open `http://localhost:4173`. The Express API and Vite app are served from one origin and bind to `0.0.0.0`. The local SQLite database is created under `.data/` and seeded with fictional records on its first run. `.data/`, `.env` and build output are git-ignored.

Open `http://localhost:4173` — the app is there, needs no login, and runs on seeded demo data until you configure an integration. Visit `/login` only to raise a session for live Supercell lookups; in development use **Sandbox access → Leader** (or Co-Leader, Elder, Member). Direct demo password is `Clash2026!` for `leader@clan.demo`, `coleader@clan.demo`, `elder@clan.demo` and `member@clan.demo`. Demo names, tags, stats and history are synthetic.

## Lukulele learning page

The standalone learning app is available at `/Lukulele.html` in the local preview and after a production build. On iPhone, open its HTTPS link in Safari, tap **Share**, then **Add to Home Screen**; launch it from the new Home Screen icon. On Android, use Chrome on the HTTPS link. When Chrome considers the PWA installable, the page offers an **Install Lukulele** button and Chrome may also offer **Install app** in its menu; the browser controls whether the prompt is available. If updating an existing iPhone shortcut, remove it and add it again after deploying the latest page so iOS picks up its standalone settings and icon. The app saves Luke's progress in this browser. After opening it and tapping **Let's Go** while online, it saves the page for later offline use; the Practice section shows whether the offline copy is ready. The built-in reference tones and microphone pitch analysis work on the device without sending audio to a server.

The metronome-led practice session counts in for two bars with **Ready?**, then two bars with **Here we go!**. It then starts the practice timer and changes the chord card every four bars. The session stops the metronome and chord prompts when the timer ends.

The live microphone tuner needs a secure page (`https://` or `localhost`) and microphone permission. Opening the HTML directly as a `file://` page does not provide microphone or offline-cache support. Open the page once while online before trying to reopen it offline.

## Official artwork

Tiles resolve in this order:

1. **Local files** in `clan-command/public/clash-assets/` — drop an official Clash of Clans PNG at the path the app expects and it is used on the next load. Run `npm run assets:list` to regenerate `public/clash-assets/EXPECTED.md`, the full checklist of 226 paths (`categories/defenses.png`, `heroes/barbarian-king.png`, `equipment/eternal-tome.png`, …). Filenames are slugified asset names, so `P.E.K.K.A` → `p-e-k-k-a.png`.
2. **Live Supercell `iconUrls`** returned by a sync or supplied in a JSON import.
3. **A neutral typographic mark** — never a generated or approximated render of the asset.

Brand logos are used exactly as provided, without recolouring or cropping.

The artwork in this repo came from the **`100% Afrikaans Clan Family / Arsenaal
Assets`** Google Drive folder, read **strictly read-only** — nothing there was
ever created, edited, moved or deleted. Provenance, folder IDs and the read-only
policy are in
[`public/clash-assets/DRIVE_SOURCE.md`](public/clash-assets/DRIVE_SOURCE.md).

The drop keeps the Drive's own layout (`heroes/archer_queen/icon.webp`,
`buildings/home-village/inferno_tower/level_11.webp`,
`equipment/eternal_tome.webp`), so nothing is renamed. Instead
`npm run assets:map` matches catalog keys against `arsenaal-index.json` by
normalised name and writes `src/clash/asset-map.json`, which the resolver reads
first. **208 of 226** catalog paths resolve to a real file today; the 18 that do
not — Home Village and Builder Base traps, plus Helper Hut, Builder Hut, Inferno
Artillery, Eclipse Tower, Firewall and Portal Pendant — are simply absent from
the drop and fall through to the live `iconUrl` or the typographic mark.

```bash
npm run assets:map      # rebuild src/clash/asset-map.json after a drop
npm run assets:list     # rewrite EXPECTED.md with installed counts
npm run assets:verify   # assert every mapped path exists on disk
```

To override a single tile, drop a PNG at the flat path instead
(`<category>/<slug>.png`) — the hand drop wins over nothing, and the Arsenaal map
wins over the guess, so both conventions coexist.

## Language

The interface ships in **Afrikaans**, with a switch back to **English** at the
top of Settings (`Instellings` → `Taal`). The choice persists in `localStorage`
under `clash-command:lang:v1`.

Clash of Clans game vocabulary stays in English in both languages, exactly as
the game shows it: Clan, Hero/Heroes, Attack/War/CWL, Home Village, Builder
Base, Buildings, Defenses, Traps, Supercharge, Laboratory, Equipment, Pets,
Walls, Guardians, Builder/Builders, Pass, Trophies, Stars, Destruction, and
every asset name (P.E.K.K.A, Inferno Tower, Barbarian King, Town Hall, …).

The switch is a compact **AF / EN pill in the top-right header**, next to the
share, settings and info icons. The active side is a royal-blue chip
(`bg-[#2563EB] text-white font-bold`); the inactive side stays dim
(`text-neutral-400`) and lights on hover. It only mutates the i18n context, so the whole
tree re-renders in place — no reload, no route change, no lost scroll position.
Settings carries the same pill so the setting stays discoverable.

Translation is keyed on the **English source string** — `t('Remaining')` — so a
string with no Afrikaans entry renders its English source instead of a blank or
a raw key. See `src/clash/i18n.tsx`.

## Tag search

A search field is pinned inside the sticky header on every screen, so a tag can
be looked up from anywhere without hunting for the right screen first.

- Placeholder `Soek op #playertag of #clantag...` (`Search by #playertag or #clantag...` in English).
- Input is normalised before use: a missing `#` is prepended, letters are
  uppercased, spaces and the zero-width characters Clash tags pick up when copied
  in-game are stripped. `normaliseSearchTag()` is unit-tested in the smoke suite.
- Submits against `/api/public-search`, which is public by design and returns
  game-profile fields and membership milestones only.
- On a hit the app routes to the matching screen — Clan for a clan tag, the
  player tracker for a player tag — and opens the profile drawer already loaded.

## Sign-in

The dark `/login` screen offers three routes, because they do different jobs:

- **Continue with Discord** — `supabase.auth.signInWithOAuth({ provider: 'discord' })`.
  Supabase redirects back to the app root and `detectSessionInUrl` picks the
  session up from the URL fragment, which the auth watcher turns into a redirect
  into the app.
- **Email + password**, or a **magic link** (`signInWithOtp`) on the Supabase tab.
- **Clan server** — this app's own `POST /api/auth/login`, which issues the
  session cookie the Supercell proxy checks.

**Supabase sign-in does not by itself unlock live Supercell lookups.** Those go
through this app's server (`/api/supercell/*`), which gates on its own session
against the local SQLite user table; the server does not verify Supabase tokens.
Bridging the two means adding token verification server-side, which has not been
done — so the screen offers both and says which is which. When
`VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY` are unset the Supabase routes
report that plainly instead of failing silently. Setup steps are in
`.env.example`.

Linked player tags live in `localStorage` and are untouched by any sign-in flow,
so the `#tag` you linked is still there when the tracker remounts after a
redirect. `npm run smoke` asserts this end to end.

## Supercell Fan Content Policy

Supercell asks fan content to carry a specific disclaimer. It appears in exactly
two places — the **info sheet** (the ℹ️ icon in the header) and the **`/login`
footer** — quoted verbatim from
[supercell.com/en/fan-content-policy](https://supercell.com/en/fan-content-policy):

> This material is unofficial and is not endorsed by Supercell. For more
> information see Supercell's Fan Content Policy:
> www.supercell.com/fan-content-policy.

It was briefly rendered in the footer of every screen as well; that repetition
cluttered the UI and was removed. The exact string lives in `FAN_CONTENT_NOTICE`
(`src/clash/components.tsx`), and the smoke suite fails both if the wording
drifts and if the notice reappears on a normal screen.

## Data notes

The seeded village, plan, schedule, war log and roster are demo data held in this browser's `localStorage`. Progression, plan and schedule round-trip through JSON export/import. Rush, lab-purity and war-performance figures surfaced by Scout are **demo estimates** unless a data source supplies them.

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

For the full go-live walkthrough — hosting choices, why `node:sqlite` rules out plain static hosting, the environment matrix, Supercell static-IP setup, Supabase RLS and a pre-launch checklist — see [`DEPLOYMENT.md`](./DEPLOYMENT.md).

- Set `DEMO_MODE=false` and bootstrap the first Leader with `CLANCMD_ADMIN_EMAIL` and `CLANCMD_ADMIN_PASSWORD`.
- Mount persistent storage for `.data`; back up the SQLite database and encryption key together. For multiple instances, move storage to a shared database.
- Configure the static-IP proxy and register its egress IP in Supercell's developer portal before enabling live calls.
- Apply your Supabase project's own Row Level Security policies before wiring private clan data to Supabase. Never place a service-role key in a `VITE_` variable.
- The no-login recruitment endpoint exposes only player/clan game-profile fields and membership milestones—never contact details or leadership notes. Review public visibility expectations before using real roster data.

## Checks

```bash
npm run check          # tsc --noEmit
npm run build          # vite build && tsc
npm run smoke          # headless jsdom render of every screen (npm i --no-save jsdom)
npm run assets:map     # rebuild src/clash/asset-map.json from the Arsenaal index
npm run assets:list    # regenerate public/clash-assets/EXPECTED.md
npm run assets:verify  # assert every mapped artwork path exists on disk
```

`npm run smoke` mounts the real component tree in jsdom, drives the bottom nav through all four routes and the view selector through all five views, opens the settings, info and scout sheets, and asserts the completion maths on the seeded village. It also proves the things that are easy to regress silently: every `<img>` the app paints points at a file that exists, the header AF/EN pill re-renders the tree in both languages and persists the choice, the Supabase auth entry points guard an unconfigured build instead of throwing, the linked player tag survives a sign-in redirect, and the fan-content disclaimer still matches Supercell's official wording. Add `--report` to print the category table.
