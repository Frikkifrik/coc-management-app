import { DatabaseSync } from 'node:sqlite';
import { randomBytes, scryptSync, timingSafeEqual } from 'node:crypto';
import { mkdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const serverDir = path.dirname(fileURLToPath(import.meta.url));
export const appDir = path.resolve(serverDir, '..');
export const dataDir = path.resolve(appDir, '.data');
mkdirSync(dataDir, { recursive: true, mode: 0o700 });

const databasePath = process.env.CLANCMD_DB_PATH || path.join(dataDir, 'clan-command.sqlite');
mkdirSync(path.dirname(databasePath), { recursive: true, mode: 0o700 });

export const db = new DatabaseSync(databasePath);
db.exec('PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON; PRAGMA busy_timeout = 5000;');

db.exec(`
  CREATE TABLE IF NOT EXISTS clans (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    tag TEXT NOT NULL UNIQUE,
    short_name TEXT NOT NULL DEFAULT '',
    clan_level INTEGER NOT NULL DEFAULT 1 CHECK (clan_level BETWEEN 1 AND 30),
    league TEXT NOT NULL DEFAULT 'Unranked',
    trophies INTEGER NOT NULL DEFAULT 0 CHECK (trophies >= 0),
    war_win_streak INTEGER NOT NULL DEFAULT 0 CHECK (war_win_streak >= 0),
    description TEXT NOT NULL DEFAULT '',
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS players (
    id TEXT PRIMARY KEY,
    tag TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL,
    person_id TEXT NOT NULL DEFAULT '',
    account_type TEXT NOT NULL DEFAULT 'Main',
    builder_hall INTEGER NOT NULL DEFAULT 1 CHECK (builder_hall BETWEEN 0 AND 10),
    xp_level INTEGER NOT NULL DEFAULT 1 CHECK (xp_level >= 1),
    best_trophies INTEGER NOT NULL DEFAULT 0 CHECK (best_trophies >= 0),
    builder_base_trophies INTEGER NOT NULL DEFAULT 0 CHECK (builder_base_trophies >= 0),
    builder_base_league TEXT NOT NULL DEFAULT 'Unranked',
    war_stars INTEGER NOT NULL DEFAULT 0 CHECK (war_stars >= 0),
    war_entries_90d INTEGER NOT NULL DEFAULT 0 CHECK (war_entries_90d >= 0),
    war_attacks_90d INTEGER NOT NULL DEFAULT 0 CHECK (war_attacks_90d >= 0),
    war_missed_90d INTEGER NOT NULL DEFAULT 0 CHECK (war_missed_90d >= 0),
    average_stars_90d REAL NOT NULL DEFAULT 0 CHECK (average_stars_90d BETWEEN 0 AND 6),
    average_destruction_90d REAL NOT NULL DEFAULT 0 CHECK (average_destruction_90d BETWEEN 0 AND 100),
    left_at TEXT,
    return_count INTEGER NOT NULL DEFAULT 0 CHECK (return_count >= 0),
    clan_id TEXT REFERENCES clans(id) ON DELETE RESTRICT,
    role TEXT NOT NULL DEFAULT 'member' CHECK (role IN ('leader','co_leader','elder','member')),
    town_hall INTEGER NOT NULL DEFAULT 1 CHECK (town_hall BETWEEN 1 AND 18),
    trophies INTEGER NOT NULL DEFAULT 0 CHECK (trophies >= 0),
    league TEXT NOT NULL DEFAULT 'Unranked',
    ranked_tier TEXT NOT NULL DEFAULT 'Unranked',
    ranked_points INTEGER NOT NULL DEFAULT 0 CHECK (ranked_points >= 0),
    reward_points INTEGER NOT NULL DEFAULT 0 CHECK (reward_points >= 0),
    hero_readiness INTEGER NOT NULL DEFAULT 50 CHECK (hero_readiness BETWEEN 0 AND 100),
    hero_levels_json TEXT NOT NULL DEFAULT '{}',
    war_opt_in INTEGER NOT NULL DEFAULT 1 CHECK (war_opt_in IN (0,1)),
    cwl_opt_in INTEGER NOT NULL DEFAULT 1 CHECK (cwl_opt_in IN (0,1)),
    missed_attacks_30d INTEGER NOT NULL DEFAULT 0 CHECK (missed_attacks_30d >= 0),
    war_attacks_30d INTEGER NOT NULL DEFAULT 0 CHECK (war_attacks_30d >= 0),
    donation_ratio REAL NOT NULL DEFAULT 1 CHECK (donation_ratio >= 0),
    last_active_at TEXT NOT NULL,
    joined_at TEXT NOT NULL,
    base_link TEXT NOT NULL DEFAULT '',
    is_active INTEGER NOT NULL DEFAULT 1 CHECK (is_active IN (0,1)),
    bio TEXT NOT NULL DEFAULT '',
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    email TEXT NOT NULL UNIQUE COLLATE NOCASE,
    display_name TEXT NOT NULL,
    role TEXT NOT NULL CHECK (role IN ('leader','co_leader','elder','member')),
    player_id TEXT REFERENCES players(id) ON DELETE SET NULL,
    password_salt TEXT NOT NULL,
    password_hash TEXT NOT NULL,
    is_active INTEGER NOT NULL DEFAULT 1 CHECK (is_active IN (0,1)),
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS sessions (
    token_hash TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    expires_at TEXT NOT NULL,
    created_at TEXT NOT NULL
  );
  CREATE INDEX IF NOT EXISTS sessions_user_idx ON sessions(user_id);
  CREATE INDEX IF NOT EXISTS players_clan_idx ON players(clan_id);
  CREATE INDEX IF NOT EXISTS players_name_idx ON players(name COLLATE NOCASE);

  CREATE TABLE IF NOT EXISTS wars (
    id TEXT PRIMARY KEY,
    clan_id TEXT REFERENCES clans(id) ON DELETE RESTRICT,
    opponent TEXT NOT NULL,
    opponent_tag TEXT NOT NULL DEFAULT '',
    war_type TEXT NOT NULL CHECK (war_type IN ('regular','cwl','friendly')),
    state TEXT NOT NULL DEFAULT 'preparation' CHECK (state IN ('preparation','in_war','complete','cancelled')),
    start_at TEXT NOT NULL,
    end_at TEXT NOT NULL,
    result TEXT NOT NULL DEFAULT 'pending' CHECK (result IN ('win','loss','draw','pending')),
    stars INTEGER NOT NULL DEFAULT 0 CHECK (stars >= 0),
    opponent_stars INTEGER NOT NULL DEFAULT 0 CHECK (opponent_stars >= 0),
    destruction REAL NOT NULL DEFAULT 0 CHECK (destruction BETWEEN 0 AND 100),
    opponent_destruction REAL NOT NULL DEFAULT 0 CHECK (opponent_destruction BETWEEN 0 AND 100),
    war_size INTEGER NOT NULL DEFAULT 15 CHECK (war_size BETWEEN 5 AND 50),
    attacks_used INTEGER NOT NULL DEFAULT 0 CHECK (attacks_used >= 0),
    notes TEXT NOT NULL DEFAULT '',
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );
  CREATE INDEX IF NOT EXISTS wars_start_idx ON wars(start_at DESC);

  CREATE TABLE IF NOT EXISTS war_participants (
    id TEXT PRIMARY KEY,
    war_id TEXT NOT NULL REFERENCES wars(id) ON DELETE CASCADE,
    player_id TEXT REFERENCES players(id) ON DELETE SET NULL,
    player_name TEXT NOT NULL,
    player_tag TEXT NOT NULL,
    attacks_used INTEGER NOT NULL DEFAULT 0 CHECK (attacks_used BETWEEN 0 AND 2),
    stars INTEGER NOT NULL DEFAULT 0 CHECK (stars BETWEEN 0 AND 6),
    destruction REAL NOT NULL DEFAULT 0 CHECK (destruction BETWEEN 0 AND 100),
    UNIQUE(war_id, player_tag)
  );

  CREATE TABLE IF NOT EXISTS progression_events (
    id TEXT PRIMARY KEY,
    player_id TEXT REFERENCES players(id) ON DELETE SET NULL,
    player_name TEXT NOT NULL,
    player_tag TEXT NOT NULL,
    clan_name TEXT NOT NULL DEFAULT '',
    event_type TEXT NOT NULL,
    title TEXT NOT NULL,
    details TEXT NOT NULL DEFAULT '',
    from_value TEXT,
    to_value TEXT,
    created_by TEXT REFERENCES users(id) ON DELETE SET NULL,
    created_at TEXT NOT NULL
  );
  CREATE INDEX IF NOT EXISTS progress_created_idx ON progression_events(created_at DESC);

  CREATE TABLE IF NOT EXISTS alerts (
    id TEXT PRIMARY KEY,
    clan_id TEXT REFERENCES clans(id) ON DELETE SET NULL,
    clan_name TEXT NOT NULL DEFAULT '',
    player_id TEXT REFERENCES players(id) ON DELETE SET NULL,
    player_name TEXT,
    player_tag TEXT,
    title TEXT NOT NULL,
    details TEXT NOT NULL DEFAULT '',
    category TEXT NOT NULL CHECK (category IN ('war','cwl','progression','roster','rewards','system')),
    severity TEXT NOT NULL CHECK (severity IN ('critical','warning','info')),
    status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open','acknowledged','resolved')),
    created_by TEXT REFERENCES users(id) ON DELETE SET NULL,
    created_at TEXT NOT NULL,
    resolved_at TEXT
  );
  CREATE INDEX IF NOT EXISTS alerts_status_idx ON alerts(status, created_at DESC);

  CREATE TABLE IF NOT EXISTS rewards (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT NOT NULL DEFAULT '',
    category TEXT NOT NULL DEFAULT 'Seasonal',
    points_cost INTEGER NOT NULL DEFAULT 100 CHECK (points_cost >= 0),
    inventory INTEGER NOT NULL DEFAULT 0 CHECK (inventory >= 0),
    is_active INTEGER NOT NULL DEFAULT 1 CHECK (is_active IN (0,1)),
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS reward_claims (
    id TEXT PRIMARY KEY,
    player_id TEXT REFERENCES players(id) ON DELETE SET NULL,
    player_name TEXT NOT NULL,
    player_tag TEXT NOT NULL,
    reward_id TEXT REFERENCES rewards(id) ON DELETE SET NULL,
    reward_name TEXT NOT NULL,
    points_cost INTEGER NOT NULL DEFAULT 0,
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','fulfilled','rejected')),
    requested_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    resolved_by TEXT REFERENCES users(id) ON DELETE SET NULL
  );
  CREATE INDEX IF NOT EXISTS claims_status_idx ON reward_claims(status, requested_at DESC);

  CREATE TABLE IF NOT EXISTS discord_integrations (
    id TEXT PRIMARY KEY CHECK (id = 'discord'),
    enabled INTEGER NOT NULL DEFAULT 0 CHECK (enabled IN (0,1)),
    guild_id TEXT NOT NULL DEFAULT '',
    channel_label TEXT NOT NULL DEFAULT '',
    webhook_cipher TEXT,
    notifications_json TEXT NOT NULL DEFAULT '{}',
    updated_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS audit_log (
    id TEXT PRIMARY KEY,
    user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
    action TEXT NOT NULL,
    resource TEXT NOT NULL,
    entity_id TEXT,
    detail TEXT NOT NULL DEFAULT '',
    created_at TEXT NOT NULL
  );
  CREATE INDEX IF NOT EXISTS audit_created_idx ON audit_log(created_at DESC);
`);

const playerMigrations = [
  ['person_id', "TEXT NOT NULL DEFAULT ''"],
  ['account_type', "TEXT NOT NULL DEFAULT 'Main'"],
  ['builder_hall', 'INTEGER NOT NULL DEFAULT 1'],
  ['xp_level', 'INTEGER NOT NULL DEFAULT 1'],
  ['best_trophies', 'INTEGER NOT NULL DEFAULT 0'],
  ['builder_base_trophies', 'INTEGER NOT NULL DEFAULT 0'],
  ['builder_base_league', "TEXT NOT NULL DEFAULT 'Unranked'"],
  ['war_stars', 'INTEGER NOT NULL DEFAULT 0'],
  ['war_entries_90d', 'INTEGER NOT NULL DEFAULT 0'],
  ['war_attacks_90d', 'INTEGER NOT NULL DEFAULT 0'],
  ['war_missed_90d', 'INTEGER NOT NULL DEFAULT 0'],
  ['average_stars_90d', 'REAL NOT NULL DEFAULT 0'],
  ['average_destruction_90d', 'REAL NOT NULL DEFAULT 0'],
  ['left_at', 'TEXT'],
  ['return_count', 'INTEGER NOT NULL DEFAULT 0'],
];
const existingPlayerColumns = new Set(db.prepare('PRAGMA table_info(players)').all().map((column) => column.name));
for (const [column, definition] of playerMigrations) {
  if (!existingPlayerColumns.has(column)) db.exec(`ALTER TABLE players ADD COLUMN ${column} ${definition}`);
}

export function nowIso() {
  return new Date().toISOString();
}

export function makePassword(password) {
  const salt = randomBytes(16).toString('hex');
  const hash = scryptSync(password, salt, 64).toString('hex');
  return { salt, hash };
}

export function verifyPassword(password, salt, expectedHash) {
  try {
    const actual = scryptSync(password, salt, 64);
    const expected = Buffer.from(expectedHash, 'hex');
    return actual.length === expected.length && timingSafeEqual(actual, expected);
  } catch {
    return false;
  }
}

export function audit(userId, action, resource, entityId, detail = '') {
  db.prepare(`INSERT INTO audit_log (id,user_id,action,resource,entity_id,detail,created_at)
    VALUES (@id,@userId,@action,@resource,@entityId,@detail,@createdAt)`)
    .run({ id: cryptoId(), userId: userId || null, action, resource, entityId: entityId || null, detail, createdAt: nowIso() });
}

export function cryptoId() {
  return randomBytes(16).toString('hex');
}

export function toBoolean(value) {
  return value === true || value === 1 || value === '1';
}

export function runTransaction(callback) {
  db.exec('BEGIN IMMEDIATE');
  try {
    const result = callback();
    db.exec('COMMIT');
    return result;
  } catch (error) {
    db.exec('ROLLBACK');
    throw error;
  }
}
