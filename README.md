# Misclicked Family · Clan Command

A dark, mobile-first Clash of Clans tracker lives in [`clan-command/`](./clan-command/).

```bash
cd clan-command
npm install
npm run dev
```

Open `http://localhost:4173`. Player progression, multi-slot builder calendar, upgrade plan, asset collection, war & CWL comparison and clan roster. `/login` raises a session for live Supercell lookups; everything else works without one.

- [`clan-command/README.md`](./clan-command/README.md) — screens, design tokens, the official-artwork policy and how to drop assets into `public/clash-assets/`.
- [`clan-command/DEPLOYMENT.md`](./clan-command/DEPLOYMENT.md) — the production go-live walkthrough.

```bash
npm run check        # tsc --noEmit
npm run build        # vite build && tsc
npm run smoke        # headless render check (npm i --no-save jsdom)
npm run assets:list  # regenerate public/clash-assets/EXPECTED.md
```
