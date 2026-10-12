import type { CategoryId, Village } from './catalog';

export type ViewId = 'home-village' | 'builder-base' | 'calendar' | 'plan' | 'collection';

export type RouteId = 'home' | 'profile' | 'clan' | 'war';

export interface PlayerProfile {
  tag: string;
  name: string;
  townHallLevel: number;
  builderHallLevel: number;
  expLevel: number;
  trophies: number;
  bestTrophies: number;
  versusTrophies: number;
  league: string;
  builderLeague: string;
  clanTag: string;
  clanName: string;
  clanRole: string;
  warStars: number;
  attacksWon: number;
  defenseWins: number;
  donations: number;
  donationsReceived: number;
  /** Populated only by a live `GET /v1/players/{tag}` response. */
  iconUrl?: string;
  /** True when the record came from the Supercell API rather than the local demo dataset. */
  live?: boolean;
  /** ISO timestamp of the last sync. */
  syncedAt?: string;
}

export interface WallState {
  /** level -> number of segments currently at that level */
  levels: Record<number, number>;
  total: number;
  max: number;
}

export interface ProgressionState {
  /** catalog key -> current level (walls and supercharge use dedicated fields) */
  levels: Record<string, number>;
  /** Wall rings are tracked per village — the Supercell API does not expose them. */
  walls: Record<Village, WallState>;
  /** supercharge key -> charged this season */
  supercharge: Record<string, boolean>;
}

export interface CategorySummary {
  id: CategoryId;
  label: string;
  village: Village;
  earned: number;
  total: number;
  percent: number;
  maxed: boolean;
  itemCount: number;
  remaining: number;
  /** Highest remaining gap, used for the "next upgrade" hint. */
  next?: { key: string; name: string; level: number; max: number };
}

export interface UpgradeTask {
  id: string;
  key: string;
  name: string;
  category: CategoryId;
  fromLevel: number;
  toLevel: number;
  /** total duration of the upgrade in hours */
  hours: number;
  resource: 'gold' | 'elixir' | 'dark' | 'builder';
  cost: number;
  slot: number;
  /** offset in days from `scheduleStart` */
  startsAt: number;
  /** offset in days from `scheduleStart` (exclusive) */
  endsAt: number;
}

export interface PlanItem {
  id: string;
  key: string;
  name: string;
  category: CategoryId;
  fromLevel: number;
  toLevel: number;
  hours: number;
  resource: 'gold' | 'elixir' | 'dark' | 'builder';
  cost: number;
  priority: 1 | 2 | 3;
  note?: string;
}

export interface WarAttack {
  attacker: string;
  defender: string;
  stars: number;
  destruction: number;
  order: number;
}

export interface WarRound {
  id: string;
  opponent: string;
  opponentTag: string;
  league: string;
  /** CWL round position, 1-8 */
  rank: number;
  wins: number;
  ties: number;
  losses: number;
  stars: number;
  opponentStars: number;
  destruction: number;
  opponentDestruction: number;
  size: number;
  startedAt: string;
}

export interface CurrentWar {
  opponent: string;
  opponentTag: string;
  state: 'preparation' | 'warDay' | 'ended';
  size: number;
  stars: number;
  opponentStars: number;
  destruction: number;
  opponentDestruction: number;
  attacksUsed: number;
  attacksAvailable: number;
  endsAt: string;
  attacks: WarAttack[];
}

export interface ClanMemberRow {
  tag: string;
  name: string;
  role: 'leader' | 'coLeader' | 'elder' | 'member';
  townHallLevel: number;
  expLevel: number;
  trophies: number;
  league: string;
  donations: number;
  donationsReceived: number;
  warStars: number;
  warOptIn: boolean;
  lastSeen: string;
  iconUrl?: string;
}

export interface ClanSummary {
  tag: string;
  name: string;
  level: number;
  members: number;
  points: number;
  versusPoints: number;
  warWins: number;
  warWinStreak: number;
  warLosses: number;
  warTies: number;
  badgeUrl?: string;
  family: Array<{ name: string; tag: string; role: string; members: number }>;
}

export interface ClashState {
  version: number;
  player: PlayerProfile;
  progression: ProgressionState;
  scheduleStart: string;
  tasks: UpgradeTask[];
  plan: PlanItem[];
  currentWar: CurrentWar;
  warLog: WarRound[];
  clan: ClanSummary;
  roster: ClanMemberRow[];
  linkedTags: LinkedTag[];
  integrations: IntegrationSettings;
}

export interface LinkedTag {
  tag: string;
  label: string;
  /** In-game API token hash used for ownership verification. Never stored in clear text. */
  tokenFingerprint: string;
  verified: boolean;
  verifiedAt: string | null;
  source: 'supercell' | 'clashking' | 'clashofstats' | 'manual';
}

export interface IntegrationSettings {
  supercellConfigured: boolean;
  supabaseConfigured: boolean;
  clashkingEndpoint: string;
  clashofstatsEndpoint: string;
  autoSync: boolean;
}
