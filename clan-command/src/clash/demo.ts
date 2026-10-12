import {
  BUILDER_CATALOG,
  CATALOG,
  CATEGORY_ORDER,
  WALL_MAX_LEVEL,
  WALL_SEGMENTS,
  entriesFor,
  type CatalogEntry,
  type CategoryId,
  type Village,
} from './catalog';
import type {
  CategorySummary,
  ClashState,
  ClanMemberRow,
  ProgressionState,
  UpgradeTask,
  WallState,
  WarRound,
} from './types';

export const STATE_VERSION = 1;

/* ------------------------------------------------------------------ */
/* Deterministic demo village                                          */
/* ------------------------------------------------------------------ */

function hash(text: string): number {
  let value = 2166136261;
  for (let index = 0; index < text.length; index += 1) {
    value ^= text.charCodeAt(index);
    value = Math.imul(value, 16777619);
  }
  return Math.abs(value);
}

/** Target completion per category for the seeded demo village. */
const TARGETS: Record<string, number> = {
  'buildings:home': 0.84,
  'defenses:home': 1,
  'traps:home': 0.93,
  'supercharge:home': 0.5,
  'heroes:home': 0.88,
  'guardians:home': 1,
  'laboratory:home': 0.79,
  'equipment:home': 0.71,
  'pets:home': 0.82,
  'buildings:builder': 0.9,
  'defenses:builder': 0.86,
  'traps:builder': 0.8,
  'laboratory:builder': 0.74,
  'guardians:builder': 0.82,
};

function jitter(key: string): number {
  return (hash(key) % 3) - 1;
}

function buildLevels(entries: CatalogEntry[], target: number): Record<string, number> {
  const levels: Record<string, number> = {};
  entries.forEach((entry, index) => {
    if (entry.category === 'supercharge') return;
    const noise = target >= 1 ? 0 : jitter(`${entry.key}:${index}`);
    const base = Math.round(entry.max * target) + noise;
    // Keep one or two entries visibly behind so the tracker has work to show.
    const straggler = target < 1 && index % 11 === 3 ? -1 : 0;
    levels[entry.key] = Math.max(1, Math.min(entry.max, base + straggler));
  });
  return levels;
}

/** Categories that actually exist for a village, in display order. */
export function categoriesFor(village: Village): CategoryId[] {
  const source = village === 'builder' ? BUILDER_CATALOG : CATALOG;
  const present = new Set(source.map((entry) => entry.category));
  present.add('walls');
  return CATEGORY_ORDER.filter((category) => present.has(category));
}

function buildWalls(target: number, total: number, max: number): WallState {
  const maxed = Math.round(total * target);
  const mid = Math.round((total - maxed) * 0.62);
  const rest = total - maxed - mid;
  return {
    levels: {
      [max]: maxed,
      [max - 1]: mid,
      [max - 3]: rest,
    },
    total,
    max,
  };
}

function buildProgression(): ProgressionState {
  const levels: Record<string, number> = {};
  const groups: Array<[CatalogEntry[], string]> = [
    [CATALOG.filter((entry) => entry.village === 'home'), 'home'],
    [BUILDER_CATALOG.filter((entry) => entry.village === 'builder'), 'builder'],
  ];

  for (const [entries, village] of groups) {
    const byCategory = new Map<CategoryId, CatalogEntry[]>();
    for (const entry of entries) {
      if (entry.category === 'walls') continue;
      const bucket = byCategory.get(entry.category) ?? [];
      bucket.push(entry);
      byCategory.set(entry.category, bucket);
    }
    for (const [category, bucket] of byCategory) {
      const target = TARGETS[`${category}:${village}`] ?? 0.8;
      Object.assign(levels, buildLevels(bucket, target));
    }
  }

  return {
    levels,
    walls: {
      home: buildWalls(0.68, WALL_SEGMENTS, WALL_MAX_LEVEL),
      builder: buildWalls(0.55, 200, 12),
    },
    supercharge: {
      'supercharge:wizard-tower': true,
      'supercharge:air-defense': true,
      'supercharge:multi-archer-tower': false,
      'supercharge:ricochet-cannon': false,
    },
  };
}

/* ------------------------------------------------------------------ */
/* Completion maths                                                    */
/* ------------------------------------------------------------------ */

export function levelOf(progression: ProgressionState, entry: CatalogEntry): number {
  return Math.max(0, Math.min(entry.max, progression.levels[entry.key] ?? 0));
}

export function summarize(progression: ProgressionState, category: CategoryId, village: Village): CategorySummary {
  const label = category;
  if (category === 'walls') {
    const state = progression.walls[village];
    const total = state.total * state.max;
    const earned = Object.entries(state.levels).reduce(
      (sum, [level, count]) => sum + Number(level) * Number(count),
      0,
    );
    const maxedCount = state.levels[state.max] ?? 0;
    return {
      id: category,
      label: 'walls',
      village,
      earned,
      total,
      percent: total ? (earned / total) * 100 : 0,
      maxed: maxedCount >= state.total,
      itemCount: state.total,
      remaining: state.total - maxedCount,
      next:
        maxedCount < state.total
          ? {
              key: 'walls:walls',
              name: `${state.total - maxedCount} segments to level ${state.max}`,
              level: nextWallLevel(state.levels),
              max: state.max,
            }
          : undefined,
    };
  }

  if (category === 'supercharge') {
    const keys = Object.keys(progression.supercharge);
    const charged = keys.filter((key) => progression.supercharge[key]).length;
    return {
      id: category,
      label,
      village,
      earned: charged,
      total: keys.length,
      percent: keys.length ? (charged / keys.length) * 100 : 0,
      maxed: charged === keys.length,
      itemCount: keys.length,
      remaining: keys.length - charged,
      next:
        charged < keys.length
          ? {
              key: keys.find((key) => !progression.supercharge[key]) ?? '',
              name: 'Charge a defence this season',
              level: charged,
              max: keys.length,
            }
          : undefined,
    };
  }

  const source = village === 'home' ? CATALOG : BUILDER_CATALOG;
  const entries = source.filter((entry) => entry.category === category && entry.village === village);
  let earned = 0;
  let total = 0;
  let maxed = 0;
  let next: CategorySummary['next'];
  let worstGap = -1;

  for (const entry of entries) {
    const level = levelOf(progression, entry);
    earned += level * entry.count;
    total += entry.max * entry.count;
    if (level >= entry.max) maxed += 1;
    const gap = entry.max - level;
    if (gap > 0 && gap > worstGap) {
      worstGap = gap;
      next = { key: entry.key, name: entry.name, level, max: entry.max };
    }
  }

  return {
    id: category,
    label,
    village,
    earned,
    total,
    percent: total ? (earned / total) * 100 : 0,
    maxed: entries.length > 0 && maxed === entries.length,
    itemCount: entries.length,
    remaining: entries.length - maxed,
    next,
  };
}

function nextWallLevel(levels: Record<number, number>): number {
  const keys = Object.keys(levels)
    .map(Number)
    .filter((level) => levels[level] > 0)
    .sort((a, b) => b - a);
  return keys[keys.length - 1] ?? 0;
}

export function overallCompletion(progression: ProgressionState, village: Village): number {
  const summaries = categoriesFor(village).map((category) => summarize(progression, category, village));
  const total = summaries.reduce((sum, item) => sum + item.total, 0);
  const earned = summaries.reduce((sum, item) => sum + item.earned, 0);
  return total ? (earned / total) * 100 : 0;
}

export function categoryRows(progression: ProgressionState, village: Village): CategorySummary[] {
  return categoriesFor(village).map((category) => summarize(progression, category, village));
}

/** Category-level detail for the drill-down sheet. */
export function entriesInCategory(progression: ProgressionState, category: CategoryId, village: Village) {
  const entries = entriesFor(category, village === 'builder' ? 'builder' : 'home');
  const source = village === 'builder' ? BUILDER_CATALOG : CATALOG;
  const resolved = category === 'walls' ? entries : source.filter((e) => e.category === category && e.village === (village === 'builder' ? 'builder' : 'home'));
  return resolved.map((entry) => {
    const level = levelOf(progression, entry);
    return {
      entry,
      level,
      percent: entry.max ? (level / entry.max) * 100 : 0,
      complete: level >= entry.max,
    };
  });
}

/* ------------------------------------------------------------------ */
/* Schedule helpers                                                    */
/* ------------------------------------------------------------------ */

export function isoDay(offset: number, from = new Date()): string {
  const date = new Date(from);
  date.setHours(12, 0, 0, 0);
  date.setDate(date.getDate() + offset);
  return date.toISOString().slice(0, 10);
}

export function dayOffsetFrom(iso: string, from = new Date()): number {
  const target = new Date(`${iso}T12:00:00`);
  const base = new Date(from);
  base.setHours(12, 0, 0, 0);
  return Math.round((target.getTime() - base.getTime()) / 86_400_000);
}

export function hoursLabel(hours: number): string {
  if (hours < 1) return `${Math.max(1, Math.round(hours * 60))}m`;
  if (hours < 24) return `${Math.round(hours)}h`;
  const days = Math.floor(hours / 24);
  const rest = Math.round(hours % 24);
  return rest ? `${days}d ${rest}h` : `${days}d`;
}

/* ------------------------------------------------------------------ */
/* Seed                                                                */
/* ------------------------------------------------------------------ */

/**
 * The seeded schedule is derived from the seeded progression, so a task never
 * claims a level the tracker disagrees with. Slots are filled round-robin and
 * staggered so the Gantt has something on every row.
 */
const TASK_CATEGORIES: CategoryId[] = ['heroes', 'guardians', 'buildings', 'defenses', 'equipment', 'laboratory', 'pets'];

function buildTasks(progression: ProgressionState): UpgradeTask[] {
  const candidates = CATALOG
    .filter((entry) => entry.village === 'home' && TASK_CATEGORIES.includes(entry.category))
    .map((entry) => ({ entry, level: progression.levels[entry.key] ?? 0 }))
    .filter((item) => item.level < item.entry.max)
    .sort((a, b) => b.entry.max - b.level - (a.entry.max - a.level))
    .slice(0, 7);

  const startOffsets = [0, 0, 1, 2, 3, 2, 5];

  return candidates.map(({ entry, level }, index) => {
    const hours = Math.round(24 + entry.max * 12 + index * 9);
    const durationDays = Math.max(1, Math.round(hours / 24));
    const startsAt = startOffsets[index % startOffsets.length];
    return {
      id: `task-${index + 1}`,
      key: entry.key,
      name: entry.name,
      category: entry.category,
      fromLevel: level,
      toLevel: Math.min(entry.max, level + 1),
      hours,
      resource: entry.category === 'laboratory' || entry.category === 'equipment' || entry.category === 'heroes' || entry.category === 'guardians'
        ? 'dark'
        : entry.category === 'pets'
          ? 'elixir'
          : 'gold',
      cost: Math.round(900_000 * entry.max * (entry.category === 'defenses' ? 1.2 : 1)),
      slot: (index % 5) + 1,
      startsAt,
      endsAt: startsAt + durationDays,
    };
  });
}

function buildWarLog(): WarRound[] {
  const rows: Array<[string, string, string, number, number, number, number, number, number, number]> = [
    ['Nova Reign', '#9PY0QLV2', 'Champion League I', 1, 6, 0, 1, 148, 121, 96.4],
    ['Iron Vanguard', '#2Q8LRC7P', 'Champion League I', 2, 5, 1, 1, 141, 132, 92.1],
    ['Titan Fall', '#8L0YTR4V', 'Titan League I', 3, 4, 0, 3, 129, 136, 88.7],
    ['Obsidian Pact', '#YU2PL8Q0', 'Champion League I', 4, 6, 0, 1, 146, 118, 94.8],
    ['Solaris', '#R2L9QPY4', 'Titan League I', 5, 3, 2, 2, 124, 124, 85.3],
    ['Frostbyte', '#0LYP8TQ2', 'Champion League I', 6, 5, 0, 2, 138, 127, 90.6],
    ['Kings Landing', '#PL92YTQ8', 'Titan League I', 7, 7, 0, 0, 150, 112, 97.9],
    ['Dusk Raiders', '#8YQ0LT2P', 'Champion League I', 8, 4, 1, 2, 131, 129, 87.4],
  ];

  const today = new Date();
  return rows.map(([opponent, tag, league, rank, wins, ties, losses, stars, opponentStars, destruction], index) => {
    const started = new Date(today);
    started.setDate(started.getDate() - (8 - index) * 14);
    return {
      id: `cwl-${index + 1}`,
      opponent,
      opponentTag: tag,
      league,
      rank,
      wins,
      ties,
      losses,
      stars,
      opponentStars,
      destruction,
      opponentDestruction: Math.max(40, Math.round(destruction - 4 - (index % 3) * 2.4)),
      size: 15,
      startedAt: started.toISOString(),
    };
  });
}

function buildRoster(): ClanMemberRow[] {
  const rows: Array<[string, string, ClanMemberRow['role'], number, number, number, string, number, number, number, boolean, string]> = [
    ['Misclicked Luke', '#2YL8V0JQ', 'leader', 17, 262, 5187, 'Titan League I', 1840, 96, 412, true, '1h ago'],
    ['Frikkifrik', '#8PYR2QL0', 'coLeader', 17, 251, 5044, 'Titan League I', 1502, 88, 388, true, '3h ago'],
    ['NovaByte', '#9LQ2Y8PR', 'coLeader', 16, 238, 4810, 'Champion League I', 1288, 142, 361, true, '5h ago'],
    ['Skaapkoppie', '#PL0YT8Q2', 'elder', 16, 224, 4602, 'Champion League I', 940, 121, 344, true, '9h ago'],
    ['Die Wind', '#YU8L2Q0P', 'elder', 16, 219, 4511, 'Champion League I', 1105, 64, 320, true, '1d ago'],
    ['Bokkie', '#0Q2LPY8T', 'elder', 15, 201, 4180, 'Champion League II', 720, 55, 298, false, '2d ago'],
    ['Hennie', '#R2Q8Y0LP', 'member', 15, 188, 3902, 'Champion League II', 512, 47, 265, true, '4h ago'],
    ['Tannie Marie', '#8T0YQ2PL', 'member', 15, 176, 3711, 'Champion League III', 388, 33, 241, true, '6h ago'],
    ['Klein Jan', '#LY2P8Q0T', 'member', 14, 164, 3320, 'Champion League III', 260, 29, 208, false, '1d ago'],
    ['Braai Master', '#0P8TLY2Q', 'member', 14, 152, 3105, 'Master League I', 198, 21, 176, true, '2h ago'],
    ['Eiland Man', '#Q2L0TPY8', 'member', 13, 141, 2870, 'Master League II', 143, 18, 151, true, '3d ago'],
    ['Stormwolf', '#T8Q0Y2LP', 'member', 13, 128, 2640, 'Master League II', 96, 12, 118, false, '5d ago'],
  ];

  return rows.map(([name, tag, role, th, exp, trophies, league, donations, donationsReceived, warStars, warOptIn, lastSeen]) => ({
    tag,
    name,
    role,
    townHallLevel: th,
    expLevel: exp,
    trophies,
    league,
    donations,
    donationsReceived,
    warStars,
    warOptIn,
    lastSeen,
  }));
}

export function createDemoState(): ClashState {
  const scheduleStart = isoDay(0);
  const progression = buildProgression();
  return {
    version: STATE_VERSION,
    player: {
      tag: '#2YL8V0JQ',
      name: 'Misclicked Luke',
      townHallLevel: 17,
      builderHallLevel: 10,
      expLevel: 262,
      trophies: 5187,
      bestTrophies: 5642,
      versusTrophies: 4810,
      league: 'Titan League I',
      builderLeague: 'Master League I',
      clanTag: '#8YQ0LT2P',
      clanName: 'Misclicked Main',
      clanRole: 'Leader',
      warStars: 2412,
      attacksWon: 604,
      defenseWins: 188,
      donations: 1840,
      donationsReceived: 96,
      live: false,
    },
    progression,
    scheduleStart,
    tasks: buildTasks(progression),
    plan: [
      {
        id: 'plan-1',
        key: 'defenses:inferno-artillery',
        name: 'Inferno Artillery',
        category: 'defenses',
        fromLevel: 3,
        toLevel: 5,
        hours: 336,
        resource: 'gold',
        cost: 21_500_000,
        priority: 1,
        note: 'Core defence — finish before the next CWL group.',
      },
      {
        id: 'plan-2',
        key: 'guardians:grand-warden',
        name: 'Grand Warden',
        category: 'guardians',
        fromLevel: 70,
        toLevel: 75,
        hours: 222,
        resource: 'elixir',
        cost: 711_000_000,
        priority: 1,
        note: 'Warden levels gate the whole attack roster.',
      },
      {
        id: 'plan-3',
        key: 'buildings:blacksmith',
        name: 'Blacksmith',
        category: 'buildings',
        fromLevel: 8,
        toLevel: 10,
        hours: 288,
        resource: 'elixir',
        cost: 34_000_000,
        priority: 2,
        note: 'Unlocks the last two equipment levels.',
      },
      {
        id: 'plan-4',
        key: 'laboratory:meteor-golem',
        name: 'Meteor Golem',
        category: 'laboratory',
        fromLevel: 1,
        toLevel: 2,
        hours: 312,
        resource: 'dark',
        cost: 360_000,
        priority: 2,
      },
      {
        id: 'plan-5',
        key: 'walls:walls',
        name: 'Walls → level 18',
        category: 'walls',
        fromLevel: 17,
        toLevel: 18,
        hours: 0,
        resource: 'gold',
        cost: 8_000_000,
        priority: 3,
        note: 'Ring-farm with the farm army between wars.',
      },
    ],
    currentWar: {
      opponent: 'Nova Reign',
      opponentTag: '#9PY0QLV2',
      state: 'warDay',
      size: 15,
      stars: 34,
      opponentStars: 31,
      destruction: 82.4,
      opponentDestruction: 78.9,
      attacksUsed: 18,
      attacksAvailable: 30,
      endsAt: new Date(Date.now() + 19 * 3600_000).toISOString(),
      attacks: [
        { attacker: 'Misclicked Luke', defender: 'Ragnar', stars: 3, destruction: 100, order: 1 },
        { attacker: 'Frikkifrik', defender: 'Sigrun', stars: 3, destruction: 100, order: 2 },
        { attacker: 'NovaByte', defender: 'Bjorn', stars: 2, destruction: 84, order: 3 },
        { attacker: 'Skaapkoppie', defender: 'Astrid', stars: 3, destruction: 97, order: 4 },
        { attacker: 'Die Wind', defender: 'Leif', stars: 2, destruction: 79, order: 5 },
        { attacker: 'Hennie', defender: 'Freya', stars: 3, destruction: 100, order: 6 },
      ],
    },
    warLog: buildWarLog(),
    clan: {
      tag: '#8YQ0LT2P',
      name: 'Misclicked Main',
      level: 27,
      members: 42,
      points: 61_480,
      versusPoints: 58_210,
      warWins: 612,
      warWinStreak: 4,
      warLosses: 148,
      warTies: 21,
      family: [
        { name: 'Misclicked Main', tag: '#8YQ0LT2P', role: 'War clan', members: 42 },
        { name: 'Misclicked Feeder', tag: '#2Q8LRC7P', role: 'Feeder', members: 48 },
        { name: 'Misclicked Academy', tag: '#YU2PL8Q0', role: 'Academy', members: 39 },
      ],
    },
    roster: buildRoster(),
    linkedTags: [
      {
        tag: '#2YL8V0JQ',
        label: 'Main',
        tokenFingerprint: 'a9f2·1c7d·e4b0',
        verified: true,
        verifiedAt: new Date(Date.now() - 6 * 86_400_000).toISOString(),
        source: 'supercell',
      },
      {
        tag: '#8PYR2QL0',
        label: 'War alt',
        tokenFingerprint: '4be1·90aa·2f3c',
        verified: false,
        verifiedAt: null,
        source: 'clashking',
      },
    ],
    integrations: {
      supercellConfigured: false,
      supabaseConfigured: false,
      clashkingEndpoint: '',
      clashofstatsEndpoint: '',
      autoSync: true,
    },
  };
}
