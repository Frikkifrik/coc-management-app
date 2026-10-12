/**
 * CLASH COMMAND · reference catalog
 *
 * Max levels mirror the public Town Hall 17 caps (Supercell's TH17 release).
 * Nothing here is invented artwork: every entry is text-only and resolves an
 * official icon only when a real `iconUrl` is supplied by the Supercell API or
 * a JSON import (see `AssetIcon` in ./components.tsx).
 *
 * Live villages should always prefer values returned by
 * `GET /v1/players/{tag}` over this reference sheet.
 */

export type Village = 'home' | 'builder';

export type CategoryId =
  | 'buildings'
  | 'defenses'
  | 'traps'
  | 'supercharge'
  | 'heroes'
  | 'guardians'
  | 'laboratory'
  | 'equipment'
  | 'pets'
  | 'walls';

export const CATEGORY_ORDER: CategoryId[] = [
  'buildings',
  'defenses',
  'traps',
  'supercharge',
  'heroes',
  'guardians',
  'laboratory',
  'equipment',
  'pets',
  'walls',
];

export const CATEGORY_LABELS: Record<CategoryId, string> = {
  buildings: 'Buildings',
  defenses: 'Defenses',
  traps: 'Traps',
  supercharge: 'Supercharge',
  heroes: 'Heroes',
  guardians: 'Guardians',
  laboratory: 'Laboratory',
  equipment: 'Equipment',
  pets: 'Pets',
  walls: 'Walls',
};

/** Short typographic fallback shown when no official icon URL is available. */
export const CATEGORY_ABBR: Record<CategoryId, string> = {
  buildings: 'B',
  defenses: 'D',
  traps: 'T',
  supercharge: 'S',
  heroes: 'H',
  guardians: 'G',
  laboratory: 'L',
  equipment: 'E',
  pets: 'P',
  walls: 'W',
};

export interface CatalogEntry {
  /** Stable key used by saved plans, imports and live API mapping. */
  key: string;
  name: string;
  category: CategoryId;
  village: Village;
  /** Highest level reachable at TH17 (or 1 for one-shot upgrades). */
  max: number;
  /** How many copies a maxed TH17 village owns. */
  count: number;
  hero?: string;
  rarity?: 'common' | 'epic';
  /** Populated only from a live API response or a JSON import. */
  iconUrl?: string;
}

type Row = [name: string, max: number, count: number];

/**
 * Keys are namespaced per village because Builder Base reuses several home
 * names (Bomb Tower, Spring Trap, Gold Mine…). Without the prefix the two
 * villages would write to the same progression slot.
 */
export function catalogKey(category: CategoryId, village: Village, name: string): string {
  return `${category}:${village === 'builder' ? 'bb-' : ''}${slug(name)}`;
}

function rows(category: CategoryId, village: Village, items: Row[]): CatalogEntry[] {
  return items.map(([name, max, count]) => ({
    key: catalogKey(category, village, name),
    name,
    category,
    village,
    max,
    count,
  }));
}

export function slug(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

/* ------------------------------------------------------------------ */
/* Buildings                                                           */
/* ------------------------------------------------------------------ */

const BUILDINGS: Row[] = [
  ['Town Hall', 17, 1],
  ['Gold Mine', 17, 7],
  ['Elixir Collector', 17, 7],
  ['Dark Elixir Drill', 11, 3],
  ['Gold Storage', 18, 4],
  ['Elixir Storage', 18, 4],
  ['Dark Elixir Storage', 12, 1],
  ['Helper Hut', 1, 1],
  ['Army Camp', 13, 4],
  ['Barracks', 19, 1],
  ['Dark Barracks', 13, 1],
  ['Clan Castle', 13, 1],
  ['Spell Factory', 9, 1],
  ['Dark Spell Factory', 8, 1],
  ['Hero Hall', 11, 1],
  ['Blacksmith', 10, 1],
  ['Workshop', 9, 1],
  ['Pet House', 11, 1],
];

/* ------------------------------------------------------------------ */
/* Defenses                                                            */
/* ------------------------------------------------------------------ */

const DEFENSES: Row[] = [
  ['Cannon', 21, 7],
  ['Archer Tower', 21, 8],
  ['Mortar', 17, 4],
  ['Air Defense', 15, 4],
  ['Wizard Tower', 17, 5],
  ['Air Sweeper', 7, 2],
  ['Hidden Tesla', 16, 5],
  ['Bomb Tower', 12, 2],
  ['X-Bow', 12, 4],
  ['Inferno Tower', 11, 4],
  ['Eagle Artillery', 7, 1],
  ['Scattershot', 6, 3],
  ['Builder Hut', 7, 5],
  ['Spell Tower', 4, 2],
  ['Monolith', 4, 1],
  ['Multi-Archer Tower', 3, 3],
  ['Ricochet Cannon', 3, 3],
  ['Multi-Gear Tower', 2, 1],
  ['Firespitter', 2, 2],
  ['Inferno Artillery', 5, 1],
  ['Hot Candle', 21, 1],
  ['Hero Hunter', 21, 1],
  ['Cake-A-Pult', 21, 1],
];

/* ------------------------------------------------------------------ */
/* Traps                                                               */
/* ------------------------------------------------------------------ */

const TRAPS: Row[] = [
  ['Bomb', 13, 8],
  ['Spring Trap', 12, 9],
  ['Air Bomb', 12, 7],
  ['Giant Bomb', 11, 8],
  ['Seeking Air Mine', 7, 9],
  ['Skeleton Trap', 4, 4],
  ['Tornado Trap', 3, 1],
  ['Giga Bomb', 3, 1],
];

/* ------------------------------------------------------------------ */
/* Supercharge — one seasonal charge per eligible defense               */
/* ------------------------------------------------------------------ */

const SUPERCHARGE: Row[] = [
  ['Wizard Tower', 1, 1],
  ['Air Defense', 1, 1],
  ['Multi-Archer Tower', 1, 1],
  ['Ricochet Cannon', 1, 1],
];

/* ------------------------------------------------------------------ */
/* Heroes & Guardians                                                   */
/* ------------------------------------------------------------------ */

const HEROES: Array<[Row, string]> = [
  [['Barbarian King', 100, 1], 'barbarian-king'],
  [['Archer Queen', 100, 1], 'archer-queen'],
  [['Minion Prince', 90, 1], 'minion-prince'],
];

const GUARDIANS: Array<[Row, string]> = [
  [['Grand Warden', 75, 1], 'grand-warden'],
  [['Royal Champion', 50, 1], 'royal-champion'],
  [['Dragon Duke', 20, 1], 'dragon-duke'],
];

/* ------------------------------------------------------------------ */
/* Laboratory — troops, siege machines and spells                       */
/* ------------------------------------------------------------------ */

const LAB_TROOPS: Row[] = [
  ['Barbarian', 12, 1],
  ['Archer', 13, 1],
  ['Giant', 13, 1],
  ['Goblin', 9, 1],
  ['Wall Breaker', 13, 1],
  ['Balloon', 12, 1],
  ['Wizard', 13, 1],
  ['Healer', 10, 1],
  ['Dragon', 12, 1],
  ['P.E.K.K.A', 12, 1],
  ['Baby Dragon', 11, 1],
  ['Miner', 11, 1],
  ['Electro Dragon', 8, 1],
  ['Yeti', 7, 1],
  ['Dragon Rider', 5, 1],
  ['Electro Titan', 4, 1],
  ['Root Rider', 3, 1],
  ['Thrower', 3, 1],
  ['Meteor Golem', 2, 1],
  ['Minion', 13, 1],
  ['Hog Rider', 14, 1],
  ['Valkyrie', 12, 1],
  ['Golem', 14, 1],
  ['Witch', 7, 1],
  ['Lava Hound', 7, 1],
  ['Bowler', 9, 1],
  ['Ice Golem', 9, 1],
  ['Headhunter', 3, 1],
  ['Apprentice Warden', 4, 1],
  ['Druid', 5, 1],
  ['Furnace', 4, 1],
  ['Ruin Witch', 3, 1],
];

const LAB_SIEGE: Row[] = [
  ['Wall Wrecker', 5, 1],
  ['Battle Blimp', 5, 1],
  ['Stone Slammer', 5, 1],
  ['Siege Barracks', 5, 1],
  ['Log Launcher', 5, 1],
  ['Flame Flinger', 5, 1],
  ['Battle Drill', 5, 1],
  ['Troop Launcher', 4, 1],
  ['Sky Wagon', 2, 1],
];

const LAB_SPELLS: Row[] = [
  ['Lightning Spell', 12, 1],
  ['Healing Spell', 11, 1],
  ['Rage Spell', 6, 1],
  ['Jump Spell', 5, 1],
  ['Freeze Spell', 7, 1],
  ['Clone Spell', 8, 1],
  ['Invisibility Spell', 4, 1],
  ['Recall Spell', 6, 1],
  ['Revive Spell', 4, 1],
  ['Totem Spell', 3, 1],
  ['Poison Spell', 11, 1],
  ['Earthquake Spell', 7, 1],
  ['Haste Spell', 6, 1],
  ['Skeleton Spell', 8, 1],
  ['Bat Spell', 7, 1],
  ['Overgrowth Spell', 4, 1],
  ['Ice Block Spell', 5, 1],
  ['Angry Spell', 3, 1],
];

/* ------------------------------------------------------------------ */
/* Equipment — commons cap at 18, epics at 27                           */
/* ------------------------------------------------------------------ */

const EQUIPMENT: Array<[Row, string, 'common' | 'epic']> = [
  [['Barbarian Puppet', 18, 1], 'barbarian-king', 'common'],
  [['Rage Vial', 18, 1], 'barbarian-king', 'common'],
  [['Earthquake Boots', 18, 1], 'barbarian-king', 'common'],
  [['Vampstache', 18, 1], 'barbarian-king', 'common'],
  [['Giant Gauntlet', 27, 1], 'barbarian-king', 'epic'],
  [['Spiky Ball', 27, 1], 'barbarian-king', 'epic'],
  [['Snake Bracelet', 27, 1], 'barbarian-king', 'epic'],
  [['Stick Horse', 27, 1], 'barbarian-king', 'epic'],

  [['Archer Puppet', 18, 1], 'archer-queen', 'common'],
  [['Invisibility Vial', 18, 1], 'archer-queen', 'common'],
  [['Giant Arrow', 18, 1], 'archer-queen', 'common'],
  [['Healer Puppet', 18, 1], 'archer-queen', 'common'],
  [['Frozen Arrow', 27, 1], 'archer-queen', 'epic'],
  [['Magic Mirror', 27, 1], 'archer-queen', 'epic'],
  [['Action Figure', 27, 1], 'archer-queen', 'epic'],
  [['Monolith Arrow', 27, 1], 'archer-queen', 'epic'],

  [['Henchmen Puppet', 18, 1], 'minion-prince', 'common'],
  [['Dark Orb', 18, 1], 'minion-prince', 'common'],
  [['Metal Pants', 18, 1], 'minion-prince', 'common'],
  [['Noble Iron', 18, 1], 'minion-prince', 'common'],
  [['Dark Crown', 27, 1], 'minion-prince', 'epic'],
  [['Meteor Staff', 27, 1], 'minion-prince', 'epic'],
  [['Portal Pendant', 27, 1], 'minion-prince', 'epic'],

  [['Eternal Tome', 18, 1], 'grand-warden', 'common'],
  [['Life Gem', 18, 1], 'grand-warden', 'common'],
  [['Rage Gem', 18, 1], 'grand-warden', 'common'],
  [['Healing Tome', 18, 1], 'grand-warden', 'common'],
  [['Fireball', 27, 1], 'grand-warden', 'epic'],
  [['Lavaloon Puppet', 27, 1], 'grand-warden', 'epic'],
  [['Heroic Torch', 27, 1], 'grand-warden', 'epic'],

  [['Royal Gem', 18, 1], 'royal-champion', 'common'],
  [['Seeking Shield', 18, 1], 'royal-champion', 'common'],
  [['Hog Rider Puppet', 18, 1], 'royal-champion', 'common'],
  [['Haste Vial', 18, 1], 'royal-champion', 'common'],
  [['Rocket Spear', 27, 1], 'royal-champion', 'epic'],
  [['Electro Boots', 27, 1], 'royal-champion', 'epic'],
  [['Frost Flake', 27, 1], 'royal-champion', 'epic'],

  [['Fire Heart', 18, 1], 'dragon-duke', 'common'],
  [['Flame Blower', 18, 1], 'dragon-duke', 'common'],
  [['Stun Blaster', 18, 1], 'dragon-duke', 'common'],
  [['Electro Fangs', 18, 1], 'dragon-duke', 'common'],
  [['Rocket Backpack', 27, 1], 'dragon-duke', 'epic'],
  [['Revenge Deck', 27, 1], 'dragon-duke', 'epic'],
];

/* ------------------------------------------------------------------ */
/* Pets                                                                 */
/* ------------------------------------------------------------------ */

const PETS: Row[] = [
  ['L.A.S.S.I', 15, 1],
  ['Electro Owl', 15, 1],
  ['Mighty Yak', 15, 1],
  ['Unicorn', 15, 1],
  ['Frosty', 15, 1],
  ['Diggy', 10, 1],
  ['Poison Lizard', 15, 1],
  ['Phoenix', 10, 1],
  ['Spirit Fox', 10, 1],
  ['Angry Jelly', 10, 1],
  ['Sneezy', 10, 1],
];

/* ------------------------------------------------------------------ */
/* Walls — 325 segments at TH17, capped at level 18                     */
/* ------------------------------------------------------------------ */

export const WALL_SEGMENTS = 325;
export const WALL_MAX_LEVEL = 18;

/* ------------------------------------------------------------------ */

function heroRows(source: Array<[Row, string]>, category: CategoryId): CatalogEntry[] {
  return source.map(([[name, max, count], hero]) => {
    const village: Village = hero === 'dragon-duke' || hero === 'battle-machine' || hero === 'battle-copter' ? 'builder' : 'home';
    return {
      key: catalogKey(category, village, name),
      name,
      category,
      village,
      max,
      count,
      hero,
    };
  });
}

export const CATALOG: CatalogEntry[] = [
  ...rows('buildings', 'home', BUILDINGS),
  ...rows('defenses', 'home', DEFENSES),
  ...rows('traps', 'home', TRAPS),
  ...rows('supercharge', 'home', SUPERCHARGE),
  ...heroRows(HEROES, 'heroes'),
  ...heroRows(GUARDIANS, 'guardians'),
  ...rows('laboratory', 'home', LAB_TROOPS),
  ...rows('laboratory', 'home', LAB_SIEGE),
  ...rows('laboratory', 'home', LAB_SPELLS),
  ...EQUIPMENT.map(([[name, max, count], hero, rarity]) => ({
    key: catalogKey('equipment', 'home', name),
    name,
    category: 'equipment' as CategoryId,
    village: 'home' as Village,
    max,
    count,
    hero,
    rarity,
  })),
  ...rows('pets', 'home', PETS),
];

export const CATALOG_INDEX: Record<string, CatalogEntry> = Object.fromEntries(
  CATALOG.map((entry) => [entry.key, entry]),
);

export function entriesFor(category: CategoryId, village: Village = 'home'): CatalogEntry[] {
  if (category === 'walls') {
    return [
      village === 'builder'
        ? {
            key: catalogKey('walls', 'builder', 'Walls'),
            name: 'Walls',
            category: 'walls',
            village: 'builder',
            max: 12,
            count: 200,
          }
        : {
            key: catalogKey('walls', 'home', 'Walls'),
            name: 'Walls',
            category: 'walls',
            village: 'home',
            max: WALL_MAX_LEVEL,
            count: WALL_SEGMENTS,
          },
    ];
  }
  const source = village === 'builder' ? BUILDER_CATALOG : CATALOG;
  return source.filter((entry) => entry.category === category && entry.village === village);
}

/* ------------------------------------------------------------------ */
/* Builder Base (Builder Hall 10)                                       */
/* ------------------------------------------------------------------ */

export const BUILDER_ROWS: Row[] = [
  ['Builder Hall', 10, 1],
  ['Gold Mine', 10, 4],
  ['Elixir Collector', 10, 4],
  ['Gold Storage', 10, 4],
  ['Elixir Storage', 10, 4],
  ['Army Camp', 10, 4],
  ['Clan Castle', 5, 1],
  ['Gem Mine', 1, 1],
  ['Clock Tower', 10, 1],
  ['Star Laboratory', 10, 1],
  ['Workshop', 9, 1],
];

export const BUILDER_DEFENSES: Row[] = [
  ['Double Cannon', 10, 6],
  ['Firecrackers', 10, 5],
  ['Crusher', 10, 2],
  ['Guard Post', 10, 2],
  ['Air Bombs', 10, 4],
  ['Multi Mortar', 10, 2],
  ['Mega Tesla', 10, 4],
  ['Roaster', 10, 2],
  ['Giant Cannon', 10, 2],
  ['Bomb Tower', 10, 2],
  ['Lava Launcher', 10, 2],
  ['Eclipse Tower', 10, 1],
  ['Firewall', 10, 2],
];

export const BUILDER_TRAPS: Row[] = [
  ['Push Trap', 10, 6],
  ['Mine', 10, 6],
  ['Mega Mine', 10, 5],
  ['Spring Trap', 10, 4],
  ['Trap', 10, 4],
];

export const BUILDER_TROOPS: Row[] = [
  ['Raged Barbarian', 20, 1],
  ['Sneaky Archer', 20, 1],
  ['Boxer Giant', 20, 1],
  ['Beta Minion', 20, 1],
  ['Bomber', 20, 1],
  ['Baby Dragon', 20, 1],
  ['Cannon Cart', 20, 1],
  ['Night Witch', 20, 1],
  ['Drop Ship', 20, 1],
  ['Power P.E.K.K.A', 20, 1],
  ['Hog Glider', 20, 1],
  ['Electrofire Wizard', 20, 1],
];

export const BUILDER_CATALOG: CatalogEntry[] = [
  ...rows('buildings', 'builder', BUILDER_ROWS),
  ...rows('defenses', 'builder', BUILDER_DEFENSES),
  ...rows('traps', 'builder', BUILDER_TRAPS),
  ...rows('laboratory', 'builder', BUILDER_TROOPS),
  ...heroRows([[['Battle Machine', 35, 1], 'battle-machine']] as Array<[Row, string]>, 'guardians'),
  ...heroRows([[['Battle Copter', 35, 1], 'battle-copter']] as Array<[Row, string]>, 'guardians'),
  {
    key: catalogKey('walls', 'builder', 'Walls'),
    name: 'Walls',
    category: 'walls',
    village: 'builder',
    max: 12,
    count: 200,
  },
];

export const HERO_NAMES: Record<string, string> = {
  'barbarian-king': 'Barbarian King',
  'archer-queen': 'Archer Queen',
  'minion-prince': 'Minion Prince',
  'grand-warden': 'Grand Warden',
  'royal-champion': 'Royal Champion',
  'dragon-duke': 'Dragon Duke',
  'battle-machine': 'Battle Machine',
  'battle-copter': 'Battle Copter',
};
