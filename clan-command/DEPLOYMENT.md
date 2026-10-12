# Production deployment guide

This repository ships **two artifacts from one process**:

| Artifact | Built by | Served by |
| --- | --- | --- |
| The React app (mobile Clash Command at `/clash`, classic workspace at `/app`, public search at `/recruitment`) | `vite build` → `clan-command/dist/` | Express static handler |
| The API (auth, SQLite records, encrypted Discord webhooks, Supercell proxy) | `server/*.mjs` | Express on `0.0.0.0:$CLANCMD_PORT` |

`server/index.mjs` serves `dist/` itself and falls back to `index.html` for any HTML request, so **one Node process is the whole product**. That single fact drives every hosting decision below.

---

## 0. Preflight (do this before choosing a host)

```bash
cd clan-command
cp .env.example .env      # then edit
npm ci
npm run check             # TypeScript
npm run build             # vite build + tsc
npm run smoke             # headless render check (needs: npm i --no-save jsdom)
NODE_ENV=production npm start
```

Requirements and constraints:

- **Node ≥ 22.13.** The local database uses `node:sqlite`, which is only available from 22.5 and is not polyfillable.
- **A writable filesystem** for `.data/` (the SQLite database) and for the Discord webhook encryption key.
- **A stable outbound IPv4 address** if you want live Supercell calls. Supercell allowlists the IP registered against your API key; serverless platforms with rotating egress will fail intermittently. Either run on a host with a fixed IP, or set `SUPERCELL_STATIC_IP_PROXY_URL` to a proxy that has one.
- **Never** put `SUPERCELL_API_KEY`, `CLANCMD_APP_SECRET`, or a Supabase **service-role** key in a `VITE_`-prefixed variable. Anything prefixed `VITE_` is inlined into the public JS bundle at build time.

---

## Option A — One Node host (recommended, zero code changes)

Works on Render, Railway, Fly.io, Hetzner, DigitalOcean, any VPS with Docker or plain Node.

1. **Create the service.** Runtime: Node 22. Root directory: `clan-command`.
2. **Build command:** `npm ci && npm run build`
3. **Start command:** `NODE_ENV=production node server/run.mjs`
4. **Environment variables** (see §4 for the full list):

   ```
   NODE_ENV=production
   CLANCMD_PORT=<port your platform injects, e.g. $PORT>
   DEMO_MODE=false
   CLANCMD_APP_SECRET=<64+ random chars: openssl rand -hex 32>
   CLANCMD_ADMIN_EMAIL=leader@yourclan.com
   CLANCMD_ADMIN_PASSWORD=<strong password>
   SUPERCELL_API_KEY=<from developer.clashofclans.com>
   SUPERCELL_STATIC_IP_PROXY_URL=            # only if the host IP is not allowlisted
   VITE_SUPABASE_URL=                        # optional
   VITE_SUPABASE_ANON_KEY=                   # optional, public key only
   ```

   `CLANCMD_ADMIN_EMAIL` / `CLANCMD_ADMIN_PASSWORD` bootstrap the first Leader account on first boot; after that, remove the password from the environment and rotate it in-app.

5. **Persistent disk.** Mount a volume at `clan-command/.data`. Losing it loses every roster, war and reward record — and the key file that encrypts stored Discord webhooks, which makes those webhooks unreadable. Back the two up together.
6. **Health check.** Point the platform probe at `GET /api/health`. It is registered before the session gate, so it needs no auth, and it reports `{ ok, demoMode, supercell }`.
7. **Custom domain.** Add it in the platform dashboard, point DNS (A/CNAME) at the target, and let the platform issue TLS. Then re-check `SameSite=None; Secure` cookies: `server/index.mjs` sets `Secure` + `Partitioned` whenever `x-forwarded-proto` is `https`, so make sure your proxy forwards that header. Set `trust proxy` correctly if you sit behind another hop.
8. **Verify after deploy:**
   ```bash
   curl -s https://your.domain/api/health
   curl -sI https://your.domain/clash | head -1
   ```
   Expect `{"ok":true,...,"demoMode":false,"supercell":true}` and `HTTP/2 200`.

**Scaling note.** One instance per volume. If you need more than one replica, move the SQLite database to a shared server (Postgres or Supabase) first — `server/database.mjs` is the only place that talks to it.

---

## Option B — Static frontend on Vercel / Netlify / Cloudflare Pages + separate API host

Use this if you want CDN edge delivery for the UI. It needs one small change: the browser must know where the API lives.

1. **Deploy the API** with Option A on a Node host that gives you a stable URL, e.g. `https://api.yourclan.com`.
2. **Point the client at it.** Add a base-URL env and use it in the two fetch layers:

   ```ts
   // src/api.ts and src/clash/store.tsx
   const API_BASE = import.meta.env.VITE_API_BASE ?? '';
   // then fetch(`${API_BASE}${path}`)
   ```

   Set `VITE_API_BASE=https://api.yourclan.com` in the frontend project's environment.
3. **Allow the frontend origin on the API.** `server/index.mjs` already rejects cross-origin writes unless the `Origin` matches `Host` or `x-forwarded-host`. With a split origin you must add the frontend host to that allowlist, and enable CORS + credentialed cookies:

   ```js
   app.use(cors({ origin: process.env.CLANCMD_WEB_ORIGIN, credentials: true }));
   ```

   Cookies are already `SameSite=None; Secure` on HTTPS, which is what a cross-site session needs.
4. **Frontend build settings** (Vercel / Netlify / Cloudflare Pages):
   - Root directory: `clan-command`
   - Build command: `npm ci && npm run build`
   - Output directory: `dist`
   - SPA rewrite: all paths → `/index.html` (`vercel.json` `rewrites`, `netlify.toml` `[[redirects]]`, or Pages' `_redirects` with `/* /index.html 200`)
   - Node version: 22 (build step only)
5. **Custom domain** for the frontend is configured in that platform's dashboard; the API keeps its own.

Trade-off: two origins means real CORS configuration and two TLS certs. Option A avoids both.

---

## Option C — Cloudflare Workers

Not viable **as-is**, and it is worth saying why rather than discovering it at deploy time:

- `node:sqlite` is not available in the Workers runtime. The database would have to move to D1 (or Supabase Postgres) and `server/database.mjs` rewritten against D1's prepared-statement API.
- The Discord webhook encryption in `server/secrets.mjs` uses `node:crypto` AES-GCM; that would move to WebCrypto.
- Undici's `ProxyAgent` (used for the Supercell static-IP proxy) has no Workers equivalent — you would call Supercell directly from a Worker with a fixed egress IP, which Cloudflare only offers on paid plans with specific configuration.

If Workers is a hard requirement, the realistic shape is: Pages for the frontend + a Worker for a **thin** Supercell proxy (stateless, key in a Worker secret) + Supabase Postgres for everything persistent. That is a migration project, not a deployment setting.

---

## 4. Environment variable reference

| Variable | Where | Required | Notes |
| --- | --- | --- | --- |
| `NODE_ENV` | server | yes in prod | `production` switches to serving `dist/` and tightens headers |
| `CLANCMD_PORT` / `PORT` | server | no (4173) | Bind port |
| `DEMO_MODE` | server | no | `true` seeds fictional records and enables sandbox logins. **Set `false` in production.** |
| `CLANCMD_APP_SECRET` | server | yes in prod | 32+ chars. Encrypts Discord webhooks at rest. Rotating it invalidates stored webhooks. |
| `CLANCMD_ADMIN_EMAIL` / `CLANCMD_ADMIN_PASSWORD` | server | first boot | Bootstraps the first Leader. Remove afterwards. |
| `SUPERCELL_API_KEY` | server | for live data | From developer.clashofclans.com. Never `VITE_`-prefixed. |
| `SUPERCELL_STATIC_IP_PROXY_URL` | server | conditional | `http://user:pass@proxy:8080`. Needed when the host IP is not allowlisted. |
| `SUPERCELL_API_BASE_URL` | server | no | Defaults to `https://api.clashofclans.com/v1` |
| `VITE_SUPABASE_URL` | client | optional | Public project URL |
| `VITE_SUPABASE_ANON_KEY` | client | optional | **Anon** key only |
| `VITE_API_BASE` | client | Option B only | Absolute API origin when split |

---

## 5. Supercell API setup

1. Create a key at <https://developer.clashofclans.com>.
2. Register the **exact** outbound IPv4 address your production host uses. If the host IP can change, register the proxy's IP instead and set `SUPERCELL_STATIC_IP_PROXY_URL`.
3. Confirm from the host itself:

   ```bash
   curl -s https://your.domain/api/health        # → "supercell": true
   ```

   Then, signed in at `/login`:

   ```bash
   curl -s -H "Authorization: Bearer $SESSION" \
     https://your.domain/api/supercell/player/2YL8V0JQ
   ```

4. Available lookups (the allowlist lives in `server/supercell.mjs`): `player`, `clan`, `warlog`, `cwl`, `currentwar`, `members`. All are behind the session gate — the API key is never reachable anonymously.

**Coverage limits, stated plainly.** `GET /v1/players/{tag}` returns heroes, hero equipment, pets, troops and spells — the mobile app maps exactly those. It does **not** return buildings, defences, traps, supercharge state or wall segments. Those stay local or come from a JSON import. The UI says so in the info sheet rather than implying a full live sync.

---

## 6. Supabase setup (optional)

1. Create a project; copy the **Project URL** and **anon** key into `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY`.
2. `src/lib/supabase.ts` only initialises a client when both are present; the app is fully functional without them (state lives in the browser and in the local SQLite workspace).
3. Before storing private clan data in Supabase, write Row Level Security policies for every table. The anon key is public by design — RLS is the only thing protecting rows.
4. Never place the service-role key in a `VITE_` variable or in client code. If you need privileged server-side access, add it as a non-`VITE_` server variable and call Supabase from `server/`.

---

## 7. ClashKing / ClashOfStats and in-game API tokens

- Endpoints are entered in **Settings → Integrations** and stored in browser state. Nothing is sent to them until you trigger a verify.
- Ownership verification stores only a **fingerprint** of the in-game API token (`a9f2·1c7d·e4b0`), never the token.
- Supercell does not publish a token-verification endpoint, so the verify step is an adapter: it calls whichever service you configure. Until you set one, verification is a local flag and the UI labels it unverified.

---

## 8. Pre-launch checklist

- [ ] `DEMO_MODE=false` and no sandbox logins reachable
- [ ] `CLANCMD_APP_SECRET` set to a long random value and recorded somewhere safe
- [ ] Bootstrap admin password rotated and removed from the environment
- [ ] `.data/` on a persistent volume with backups (database **and** key file together)
- [ ] `/api/health` returns `demoMode: false` and the expected `supercell` flag
- [ ] Supercell key allowlisted against the real egress IP; one live lookup succeeds
- [ ] HTTPS enforced; `x-forwarded-proto` reaches the app so cookies are `Secure`
- [ ] Supabase RLS policies written and tested with the anon key
- [ ] Public recruitment endpoint reviewed — it must never expose contact details or leadership notes
- [ ] `npm run check`, `npm run build` and `npm run smoke` all green on the deploy commit
