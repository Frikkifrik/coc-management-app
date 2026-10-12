# Misclicked Family · Clan Command

The full-stack Clash of Clans family-management app lives in [`clan-command/`](./clan-command/).

```bash
cd clan-command
npm install
npm run dev
```

Open `http://localhost:4173` — it redirects to **`/clash`**, the mobile-first Clash Command tracker (player progression, multi-slot builder calendar, upgrade plan, asset collection, war & CWL comparison, clan roster). The classic bright workspace stays at `/login` and `/app`, and the public recruitment search at `/recruitment`.

See [`clan-command/README.md`](./clan-command/README.md) for features, the design-token reference, optional Supabase and Supercell API configuration, and the no-generated-artwork policy. [`clan-command/DEPLOYMENT.md`](./clan-command/DEPLOYMENT.md) covers the production go-live walkthrough.

```bash
npm run check     # tsc --noEmit
npm run build     # vite build && tsc
npm run smoke     # headless render check (npm i --no-save jsdom)
```
