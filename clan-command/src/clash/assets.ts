import { BUILDER_CATALOG, CATALOG, slug, type CatalogEntry, type CategoryId } from './catalog';
import ARSENAAL_MAP from './asset-map.json';

/**
 * OFFICIAL ARTWORK RESOLUTION
 *
 * Two ways artwork gets into `clan-command/public/clash-assets/`, and both are
 * honoured:
 *
 * 1. **The Arsenaal drop** (what the repo currently ships). Official files in
 *    the Drive's own layout — `heroes/archer_queen/icon.webp`,
 *    `buildings/home-village/inferno_tower/level_11.webp`,
 *    `equipment/eternal_tome.webp` — mapped to catalog keys by
 *    `scripts/build-asset-map.mjs` into `./asset-map.json`. Nothing is renamed
 *    or copied; the map just points at the files as they landed.
 *
 * 2. **A hand drop** using the flat convention, for filling gaps:
 *
 *      public/clash-assets/
 *        categories/defenses.png      ← tracker row icons
 *        defenses/inferno-tower.png   ← one folder per category
 *        heroes/barbarian-king.png
 *
 *    Filenames are the slugified asset name, so "P.E.K.K.A" becomes
 *    `p-e-k-k-a.png` and "L.A.S.S.I" becomes `l-a-s-s-i.png`.
 *
 * Resolution order for a tile:
 *
 *   1. the Arsenaal map (real, present files)
 *   2. the flat hand-drop path
 *   3. the live Supercell `iconUrl` from a sync or JSON import
 *   4. a neutral typographic mark
 *
 * Nothing here generates or approximates artwork. Run `npm run assets:map` to
 * rebuild the map after a drop, and `npm run assets:list` to regenerate
 * EXPECTED.md.
 */

export const ASSET_BASE = '/clash-assets';

/** Catalog key → real file in the Arsenaal drop. Generated, never hand-edited. */
const ARSENAAL: Record<string, string> = ARSENAAL_MAP;

function fileName(name: string): string {
  return `${slug(name)}.png`;
}

/** Tracker row icon under the flat hand-drop convention. */
export function categoryAssetPath(category: CategoryId): string {
  return `${ASSET_BASE}/categories/${category}.png`;
}

/** Catalog entry under the flat hand-drop convention. */
export function entryAssetPath(entry: CatalogEntry): string {
  return `${ASSET_BASE}/${entry.category}/${fileName(entry.name)}`;
}

const ENTRY_PATHS: Record<string, string> = Object.fromEntries(
  [...CATALOG, ...BUILDER_CATALOG].map((entry) => [entry.key, entryAssetPath(entry)]),
);

/**
 * Resolve a key to a candidate path. Accepts a catalog key
 * (`defenses:inferno-tower`, `guardians:bb-battle-machine`) or a category key
 * (`category:defenses`). Returns undefined for anything unknown, so callers can
 * fall straight through to the live `iconUrl` and then the typographic mark.
 *
 * The Arsenaal map wins because those files are verified present in the repo;
 * the flat path is only a guess that the browser confirms or rejects.
 */
export function assetPathFor(assetKey?: string): string | undefined {
  if (!assetKey) return undefined;
  const mapped = ARSENAAL[assetKey];
  if (mapped) return mapped;
  if (assetKey.startsWith('category:')) {
    const category = assetKey.slice('category:'.length) as CategoryId;
    return categoryAssetPath(category);
  }
  return ENTRY_PATHS[assetKey];
}

/** True when a key resolves to a file from the Arsenaal drop. */
export function hasMappedAsset(assetKey: string): boolean {
  return Boolean(ARSENAAL[assetKey]);
}

/**
 * Every path the app will try, for EXPECTED.md and for auditing a drop. `mapped`
 * marks the entries backed by a real file in the repository today.
 */
export function expectedAssetPaths(): Array<{ key: string; path: string; mapped: boolean }> {
  const categories = Array.from(new Set([...CATALOG, ...BUILDER_CATALOG].map((entry) => entry.category)));
  return [
    ...categories.map((category) => ({
      key: `category:${category}`,
      path: ARSENAAL[`category:${category}`] ?? categoryAssetPath(category),
      mapped: Boolean(ARSENAAL[`category:${category}`]),
    })),
    ...[...CATALOG, ...BUILDER_CATALOG].map((entry) => ({
      key: entry.key,
      path: ARSENAAL[entry.key] ?? entryAssetPath(entry),
      mapped: Boolean(ARSENAAL[entry.key]),
    })),
  ];
}
