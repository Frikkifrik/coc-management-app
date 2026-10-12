import { BUILDER_CATALOG, CATALOG, slug, type CatalogEntry, type CategoryId } from './catalog';

/**
 * LOCAL OFFICIAL ARTWORK
 *
 * Drop official Clash of Clans assets into `clan-command/public/clash-assets/`
 * using the layout below and they are picked up on the next page load — no code
 * change, no manifest, no rebuild.
 *
 *   public/clash-assets/
 *     categories/defenses.png          ← tracker row icons
 *     heroes/barbarian-king.png        ← one folder per category
 *     defenses/inferno-tower.png
 *     equipment/eternal-tome.png
 *     …
 *
 * Files are PNG. Filenames are the slugified asset name, so "P.E.K.K.A" becomes
 * `p-e-k-k-a.png` and "L.A.S.S.I" becomes `l-a-s-s-i.png`.
 *
 * Nothing here generates or approximates artwork. When a file is absent the tile
 * falls back to the live Supercell `iconUrl`, and then to a neutral typographic
 * mark. Run `npm run assets:list` to regenerate EXPECTED.md, the full checklist
 * of paths this app will look for.
 */

export const ASSET_BASE = '/clash-assets';

function fileName(name: string): string {
  return `${slug(name)}.png`;
}

/** Tracker row icons live under `categories/`, keyed by category id. */
export function categoryAssetPath(category: CategoryId): string {
  return `${ASSET_BASE}/categories/${category}.png`;
}

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
 * fall straight through to the typographic mark.
 */
export function assetPathFor(assetKey?: string): string | undefined {
  if (!assetKey) return undefined;
  if (assetKey.startsWith('category:')) {
    const category = assetKey.slice('category:'.length) as CategoryId;
    return categoryAssetPath(category);
  }
  return ENTRY_PATHS[assetKey];
}

/** Every path the app will try, for EXPECTED.md and for auditing a drop. */
export function expectedAssetPaths(): Array<{ key: string; path: string }> {
  const categories = Array.from(new Set([...CATALOG, ...BUILDER_CATALOG].map((entry) => entry.category)));
  return [
    ...categories.map((category) => ({ key: `category:${category}`, path: categoryAssetPath(category) })),
    ...[...CATALOG, ...BUILDER_CATALOG].map((entry) => ({ key: entry.key, path: entryAssetPath(entry) })),
  ];
}
