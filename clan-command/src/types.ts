export type AppRole = 'leader' | 'co_leader' | 'elder' | 'member';
export type Role = AppRole;

export interface User {
  id: string;
  email: string;
  displayName: string;
  role: AppRole;
  playerId: string | null;
  isActive: boolean;
}

export interface Clan {
  id: string;
  name: string;
  tag: string;
  shortName: string;
  clanLevel: number;
  league: string;
  trophies: number;
  warWinStreak: number;
  description: string;
  createdAt: string;
  memberCount?: number;
}

export interface HeroLevels {
  king: number;
  queen: number;
  warden: number;
  champion: number;
  prince: number;
  duke: number;
}

export interface Member {
  id: string;
  tag: string;
  name: string;
  /** Private account-family grouping key; not returned in the public roster projection. */
  personId?: string | null;
  accountType: string;
  clanId: string;
  clanName: string;
  role: AppRole;
  townHall: number;
  builderHall: number;
  xpLevel: number;
  trophies: number;
  bestTrophies: number;
  builderBaseTrophies: number;
  builderBaseLeague: string;
  warStars: number;
  warEntries90d?: number;
  warAttacks90d?: number;
  warMissed90d?: number;
  averageStars90d?: number;
  averageDestruction90d?: number;
  leftAt?: string | null;
  returnCount?: number;
  league: string;
  rankedTier: string;
  rankedPoints: number;
  rewardPoints: number;
  heroReadiness: number;
  heroLevels: HeroLevels;
  warOptIn: boolean;
  cwlOptIn: boolean;
  missedAttacks30d: number;
  warAttacks30d: number;
  donationRatio: number;
  lastActiveAt: string;
  joinedAt: string;
  baseLink: string;
  isActive: boolean;
  bio: string;
}

export interface War {
  id: string;
  clanId: string;
  clanName: string;
  opponent: string;
  opponentTag: string;
  warType: 'regular' | 'cwl' | 'friendly';
  state: 'preparation' | 'in_war' | 'complete' | 'cancelled';
  startAt: string;
  endAt: string;
  result: 'win' | 'loss' | 'draw' | 'pending';
  stars: number;
  opponentStars: number;
  destruction: number;
  opponentDestruction: number;
  warSize: number;
  attacksUsed: number;
  notes: string;
}

export interface ClanAlert {
  id: string;
  clanId: string | null;
  clanName: string;
  playerId: string | null;
  playerName: string | null;
  playerTag: string | null;
  title: string;
  details: string;
  category: 'war' | 'cwl' | 'progression' | 'roster' | 'rewards' | 'system';
  severity: 'critical' | 'warning' | 'info';
  status: 'open' | 'acknowledged' | 'resolved';
  createdAt: string;
  resolvedAt: string | null;
}

export interface ProgressEvent {
  id: string;
  playerId: string | null;
  playerName: string;
  playerTag: string;
  clanName: string;
  eventType: string;
  title: string;
  details: string;
  fromValue: string | null;
  toValue: string | null;
  createdAt: string;
}

export interface Reward {
  id: string;
  name: string;
  description: string;
  category: string;
  pointsCost: number;
  inventory: number;
  isActive: boolean;
}

export interface RewardClaim {
  id: string;
  playerId: string;
  playerName: string;
  playerTag: string;
  rewardId: string | null;
  rewardName: string;
  pointsCost: number;
  status: 'pending' | 'approved' | 'fulfilled' | 'rejected';
  requestedAt: string;
  updatedAt: string;
}

export interface DiscordIntegration {
  id: string;
  enabled: boolean;
  guildId: string;
  channelLabel: string;
  notifications: {
    warReminders: boolean;
    cwlLineup: boolean;
    memberMilestones: boolean;
    rankedMovement: boolean;
    applicantAlerts: boolean;
  };
  webhookConfigured: boolean;
  updatedAt: string;
}

export interface WorkspaceData {
  clans: Clan[];
  members: Member[];
  wars: War[];
  alerts: ClanAlert[];
  history: ProgressEvent[];
  rewards: Reward[];
  claims: RewardClaim[];
  integration: DiscordIntegration | null;
  users: User[];
  demoMode: boolean;
}

export type ResourceName = 'members' | 'clans' | 'wars' | 'alerts' | 'rewards';
