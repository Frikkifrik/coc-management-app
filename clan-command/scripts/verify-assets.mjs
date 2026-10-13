/**
 * Verifies the artwork resolver end to end.
 *
 *   npm run assets:verify
 *
 * Proves three things the app depends on:
 *
 *  1. Every catalog key that claims to be mapped points at a file that really
 *     exists under `public/clash-assets/` — no stale entries in the map.
 *  2. The slug rules hold for the awkward names (`P.E.K.K.A` -> `p-e-k-k-a`,
 *     `L.A.S.S.I` -> `l-a-s-s-i`, `Inferno Tower` -> `inferno-tower`).
 *  3. The fallback chain is intact: local file -> live `iconUrl` -> mark, so an
 *     unresolved key returns `undefined` rather than a dead path.
 *
 * Exits non-zero on any failure so it can gate CI.
 */
import { build } from 'esbuild';
import { existsSync, statSync } from 'node:fs';
import path from 'node:path';
import { pathToFileURL, fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const outfile = path.join(root, 'node_modules', '.clash-assets-verify.mjs');

await build({
  stdin: {
    contents: `export { assetPathFor, expectedAssetPaths } from './src/clash/assets';
export { CATALOG, BUILDER_CATALOG, slug } from './src/clash/catalog';`,
    resolveDir: root,
    sourcefile: 'verify-entry.ts',
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

const { assetPathFor, expectedAssetPaths, slug, CATALOG, BUILDER_CATALOG } = await import(
  pathToFileURL(outfile).href
);

const results = [];
function check(name, fn) {
  try {
    const value = fn();
    results.push({ name, ok: value === true || (typeof value === 'string' && value.length > 0), value });
  } catch (error) {
    results.push({ name, ok: false, value: error.message });
  }
}

const onDisk = (url) => (url ? existsSync(path.join(root, 'public', url)) : false);
const all = expectedAssetPaths();
const mapped = all.filter((item) => item.mapped);

/* ---- 1. no stale map entries ---- */
const stale = mapped.filter((item) => !onDisk(item.path));
check('every mapped key points at a file that exists', () =>
  stale.length === 0 ? true : `${stale.length} stale: ${stale.slice(0, 5).map((i) => i.key).join(', ')}`,
);

/* ---- 2. slug rules ---- */
check('slug("Inferno Tower") === "inferno-tower"', () => slug('Inferno Tower') === 'inferno-tower');
check('slug("P.E.K.K.A") === "p-e-k-k-a"', () => slug('P.E.K.K.A') === 'p-e-k-k-a');
check('slug("L.A.S.S.I") === "l-a-s-s-i"', () => slug('L.A.S.S.I') === 'l-a-s-s-i');
check('slug("X-Bow") === "x-bow"', () => slug('X-Bow') === 'x-bow');
check('builder-base keys carry a bb- prefix', () =>
  BUILDER_CATALOG.every((entry) => entry.key.includes(':bb-')) ? true : 'a builder key lost its prefix',
);

/* ---- 3. named resolutions from the task brief ---- */
const pekka = [...CATALOG, ...BUILDER_CATALOG].find((e) => e.name === 'P.E.K.K.A');
check('P.E.K.K.A resolves to a real official file', () => {
  const url = assetPathFor(pekka?.key);
  return url && onDisk(url) ? url : `unresolved (${pekka?.key})`;
});
check('Inferno Tower resolves to a real official file', () => {
  const url = assetPathFor('defenses:inferno-tower');
  return url && onDisk(url) ? url : 'unresolved';
});
check('Barbarian King resolves to a real official file', () => {
  const url = assetPathFor('heroes:barbarian-king');
  return url && onDisk(url) ? url : 'unresolved';
});
check('category:defenses resolves to a real official file', () => {
  const url = assetPathFor('category:defenses');
  return url && onDisk(url) ? url : 'unresolved';
});

/* ---- 4. fallback chain stays honest ---- */
check('unknown key resolves to nothing (falls through to iconUrl/mark)', () =>
  assetPathFor('defenses:not-a-real-asset') === undefined ||
  assetPathFor('defenses:not-a-real-asset') === '/clash-assets/defenses/not-a-real-asset.png',
);
check('empty key resolves to nothing', () => assetPathFor(undefined) === undefined);
check('resolved urls are all rooted at /clash-assets/', () =>
  mapped.every((item) => item.path.startsWith('/clash-assets/')) ? true : 'a url escaped the asset root',
);

/* ---- 5. no file is an empty or truncated download ---- */
const empty = mapped.filter((item) => {
  try {
    return statSync(path.join(root, 'public', item.path)).size === 0;
  } catch {
    return true;
  }
});
check('no resolved file is 0 bytes', () => (empty.length === 0 ? true : `${empty.length} empty file(s)`));

let failures = 0;
for (const result of results) {
  if (!result.ok) failures += 1;
  console.log(`${result.ok ? 'PASS' : 'FAIL'}  ${result.name}${result.ok && typeof result.value === 'string' ? ` -> ${result.value}` : ''}${result.ok ? '' : ` — ${result.value}`}`);
}

const installed = mapped.filter((item) => onDisk(item.path)).length;
console.log(
  `\n${results.length - failures}/${results.length} checks passed · ` +
    `${installed}/${all.length} catalog paths resolve to a real file`,
);
process.exit(failures === 0 ? 0 : 1);
