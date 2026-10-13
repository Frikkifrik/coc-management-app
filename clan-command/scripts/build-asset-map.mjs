/**
 * Build the catalog-key → real-file map for the Arsenaal asset drop.
 *
 * The official artwork arrives in the Drive's own layout:
 *
 *   buildings/home-village/inferno_tower/level_11.webp   (one folder per asset,
 *   heroes/archer_queen/icon.webp                         one file per level)
 *   pets/lassi/icon.webp
 *   equipment/eternal_tome.webp
 *   spells/bat_spell.webp
 *   troops/pekka/icon.webp
 *
 * while the app resolves a catalog key such as `defenses:inferno-tower`. This
 * script bridges the two so no artwork has to be renamed or copied, and writes
 * the result to `src/clash/asset-map.json`.
 *
 * Matching is by normalised name (lowercase, alphanumerics only) so the Drive's
 * punctuation differences — `P.E.K.K.A` vs `pekka`, `L.A.S.S.I` vs `lassi`,
 * `Multi-Archer Tower` vs `multi-archer_tower` — all line up.
 *
 *   node scripts/build-asset-map.mjs [--check]
 *
 * `--check` verifies every recorded path still exists on disk and exits non-zero
 * if the map has drifted from the drop. Nothing here generates artwork; it only
 * points at files that are already in the repository.
 */
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import path from 'node:path';
import { build } from 'esbuild';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { pathToFileURL } from 'node:url';

const root = path.resolve(import.meta.dirname, '..');
const assetsDir = path.join(root, 'public', 'clash-assets');
const outPath = path.join(root, 'src', 'clash', 'asset-map.json');

const normalise = (value) => value.toLowerCase().replace(/[^a-z0-9]/g, '');

/* ---------------- load the Arsenaal index ---------------- */

const index = JSON.parse(readFileSync(path.join(assetsDir, 'arsenaal-index.json'), 'utf8'));
if (!Array.isArray(index.assets)) throw new Error('arsenaal-index.json has no assets array');

/** Every asset, bucketed by the shape of its path. */
const buckets = {
  /** buildings/<village>/<asset>/level_N.<ext> → highest level wins */
  buildingLevels: new Map(),
  /** <cat>/<asset>/icon.<ext> */
  icons: new Map(),
  /** <cat>/<asset>.<ext> */
  flat: new Map(),
};

for (const asset of index.assets) {
  const parts = asset.path.split('/');
  const file = parts[parts.length - 1];
  if (/^level_(\d+)\./.test(file)) {
    const village = parts[1];
    const assetName = parts[2];
    const level = Number(file.match(/^level_(\d+)\./)[1]);
    const key = `${village}::${normalise(assetName)}`;
    const current = buckets.buildingLevels.get(key);
    if (!current || level > current.level) buckets.buildingLevels.set(key, { level, path: asset.path });
    continue;
  }
  if (/^icon\./.test(file) && parts.length >= 3) {
    const key = `${parts[0]}::${normalise(parts[parts.length - 2])}`;
    if (!buckets.icons.has(key)) buckets.icons.set(key, asset.path);
    continue;
  }
  if (parts.length >= 2) {
    const key = `${parts[0]}::${normalise(file.replace(/\.[a-z0-9]+$/i, ''))}`;
    if (!buckets.flat.has(key)) buckets.flat.set(key, asset.path);
  }
}

/** Every `buildings/<folder>/` present in the drop, preferred villages first. */
const VILLAGE_FOLDERS = Array.from(buckets.buildingLevels.keys()).map((key) => key.split('::')[0]);
const VILLAGE_PRIORITY = ['home-village', 'builder-base', 'seasonal-defense'];
VILLAGE_FOLDERS.sort(
  (a, b) => (VILLAGE_PRIORITY.indexOf(a) + 1 || 99) - (VILLAGE_PRIORITY.indexOf(b) + 1 || 99),
);

/* ---------------- load the app catalog ---------------- */

const workdir = mkdtempSync(path.join(tmpdir(), 'clash-map-'));
const outfile = path.join(workdir, 'catalog.mjs');
await build({
  stdin: {
    contents: `import { CATALOG, BUILDER_CATALOG } from './src/clash/catalog';
export { CATALOG, BUILDER_CATALOG };`,
    resolveDir: root,
    sourcefile: 'catalog-entry.ts',
    loader: 'ts',
  },
  outfile,
  bundle: true,
  format: 'esm',
  platform: 'node',
  target: 'node22',
  absWorkingDir: root,
  logLevel: 'silent',
});
const { CATALOG, BUILDER_CATALOG } = await import(pathToFileURL(outfile).href);
rmSync(workdir, { recursive: true, force: true });

/* ---------------- resolve ---------------- */

/**
 * Where each app category looks in the Arsenaal drop, in priority order.
 * Clash of Clans files defenses, traps and walls under `buildings`, so those
 * app categories deliberately point there.
 */
/**
 * Name variants worth trying, most specific first. The Drive uses singular
 * nouns for some assets the app lists in the plural ("Walls" -> `wall`,
 * "Traps" -> `trap`), so both forms are attempted.
 */
function nameVariants(rawName) {
  const name = normalise(rawName);
  const out = [name];
  if (name.endsWith('s') && !name.endsWith('ss')) out.push(name.slice(0, -1));
  if (!name.endsWith('s')) out.push(`${name}s`);
  return out;
}

function lookupsFor(entry) {
  // Try the entry's own village first, then every other village folder the drop
  // actually contains — `seasonal-defense` holds the crafted defences (Hot
  // Candle, Hero Hunter, Cake-A-Pult) that the app lists under Defenses.
  const preferred = entry.village === 'builder' ? 'builder-base' : 'home-village';
  const folders = [preferred, ...VILLAGE_FOLDERS.filter((folder) => folder !== preferred)];
  const list = [];

  const buildingLookups = () => {
    for (const folder of folders) {
      for (const name of nameVariants(entry.name)) {
        list.push(['buildingLevels', `${folder}::${name}`]);
      }
    }
  };

  switch (entry.category) {
    case 'buildings':
    case 'defenses':
    case 'traps':
    case 'walls':
      // Clash of Clans files all of these under `buildings/`.
      buildingLookups();
      break;
    case 'supercharge':
      // A seasonal charge is a charged defence, so borrow that defence's art.
      buildingLookups();
      break;
    case 'heroes':
    case 'guardians':
      for (const name of nameVariants(entry.name)) list.push(['icons', `heroes::${name}`]);
      break;
    case 'pets':
      for (const name of nameVariants(entry.name)) list.push(['icons', `pets::${name}`]);
      break;
    case 'equipment':
      for (const name of nameVariants(entry.name)) list.push(['flat', `equipment::${name}`]);
      break;
    case 'laboratory':
      for (const name of nameVariants(entry.name)) list.push(['icons', `troops::${name}`]);
      for (const name of nameVariants(entry.name)) list.push(['flat', `spells::${name}`]);
      break;
    default:
      break;
  }
  return list;
}

const map = {};
const resolved = [];
const missing = [];

for (const entry of [...CATALOG, ...BUILDER_CATALOG]) {
  let hit = null;
  for (const [bucket, key] of lookupsFor(entry)) {
    const found = buckets[bucket].get(key);
    if (found) {
      // buildingLevels stores { level, path }; the others store a bare path.
      hit = typeof found === 'string' ? found : found.path;
      break;
    }
  }
  if (hit) {
    map[entry.key] = `/clash-assets/${hit}`;
    resolved.push({ key: entry.key, name: entry.name, category: entry.category, path: hit });
  } else {
    missing.push({ key: entry.key, name: entry.name, category: entry.category });
  }
}

/**
 * Tracker row icons. The drop has no `categories/` folder, so each row icon
 * borrows a representative asset from its own category — still official
 * artwork, never generated.
 */
const CATEGORY_REPRESENTATIVE = {
  buildings: ['buildings', 'Town Hall'],
  defenses: ['defenses', 'Inferno Tower'],
  traps: ['traps', 'Giant Bomb'],
  supercharge: ['supercharge', 'Charge a defence this season'],
  heroes: ['heroes', 'Barbarian King'],
  guardians: ['guardians', 'Battle Machine'],
  laboratory: ['laboratory', 'Barbarian'],
  equipment: ['equipment', 'Eternal Tome'],
  pets: ['pets', 'L.A.S.S.I'],
  walls: ['walls', 'Walls'],
};

const categories = Array.from(new Set([...CATALOG, ...BUILDER_CATALOG].map((e) => e.category)));
for (const category of categories) {
  const wanted = CATEGORY_REPRESENTATIVE[category];
  const source = wanted
    ? resolved.find((item) => item.category === wanted[0] && item.name === wanted[1])
    : null;
  const fallback = resolved.find((item) => item.category === category);
  const pick = source ?? fallback;
  if (pick) map[`category:${category}`] = `/clash-assets/${pick.path}`;
}

/* ---------------- verify or write ---------------- */

const checkOnly = process.argv.includes('--check');

const stale = Object.entries(map).filter(([, url]) => !existsSync(path.join(root, 'public', url)));
if (stale.length) {
  console.error(`\n${stale.length} mapped path(s) do not exist on disk:`);
  for (const [key, url] of stale.slice(0, 20)) console.error(`  ${key} -> ${url}`);
  if (stale.length > 20) console.error(`  … and ${stale.length - 20} more`);
}

if (checkOnly) {
  console.log(`asset map: ${Object.keys(map).length} keys, ${stale.length} stale`);
  process.exit(stale.length ? 1 : 0);
}

writeFileSync(outPath, `${JSON.stringify(map, null, 2)}\n`);

const byCategory = {};
for (const item of resolved) byCategory[item.category] = (byCategory[item.category] ?? 0) + 1;
const total = CATALOG.length + BUILDER_CATALOG.length;
console.log(`Wrote src/clash/asset-map.json — ${Object.keys(map).length} keys.`);
console.log(`\nresolved ${resolved.length}/${total} catalog entries:`);
for (const category of Object.keys(byCategory).sort()) {
  const want = [...CATALOG, ...BUILDER_CATALOG].filter((e) => e.category === category).length;
  console.log(`  ${category.padEnd(12)} ${String(byCategory[category]).padStart(3)} / ${want}`);
}
if (missing.length) {
  console.log(`\nno official artwork in the drop for ${missing.length} entries:`);
  for (const item of missing) console.log(`  ${item.category.padEnd(12)} ${item.name}`);
}
if (stale.length) process.exit(1);
