import crypto from 'node:crypto';
import { createServer } from 'node:http';
import path from 'node:path';
import express from 'express';
import { createServer as createViteServer } from 'vite';
import { appDir, audit, cryptoId, db, makePassword, nowIso, runTransaction, verifyPassword } from './database.mjs';
import { seedIfEmpty, getDemoRoles } from './seed.mjs';
import { decryptSecret, encryptSecret, isAllowedDiscordWebhook } from './secrets.mjs';
import { isSupercellConfigured, supercellLookup } from './supercell.mjs';

const isProduction = process.env.NODE_ENV === 'production';
const demoMode = process.env.DEMO_MODE === 'true' || (!isProduction && process.env.DEMO_MODE !== 'false');
const seedState = seedIfEmpty(demoMode);
const port = Number(process.env.CLANCMD_PORT || process.env.PORT || 4173);
const roleWeight = { member: 1, elder: 2, co_leader: 3, leader: 4 };
const app = express();
app.disable('x-powered-by');
app.set('trust proxy', 1);
app.use(express.json({ limit: '256kb' }));
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  if (isProduction) res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  if (req.method !== 'GET' && req.method !== 'HEAD' && req.path.startsWith('/api/')) {
    const origin = req.get('origin');
    if (origin) {
      try {
        const originHost = new URL(origin).host.toLowerCase();
        const forwardedHost = String(req.get('x-forwarded-host') || '').split(',')[0].trim().toLowerCase();
        const allowedHosts = [String(req.get('host') || '').toLowerCase(), forwardedHost].filter(Boolean);
        if (!allowedHosts.includes(originHost)) return res.status(403).json({ error: 'Request origin rejected.' });
      } catch {
        return res.status(403).json({ error: 'Request origin rejected.' });
      }
    }
  }
  next();
});

const id = () => cryptoId();
const now = () => nowIso();
const hashToken = (value) => crypto.createHash('sha256').update(value).digest('hex');
const parseCookies = (header = '') => Object.fromEntries(header.split(';').map((part) => part.trim()).filter(Boolean).map((part) => {
  const split = part.indexOf('=');
  return split < 0 ? [part, ''] : [part.slice(0, split), decodeURIComponent(part.slice(split + 1))];
}));
const roleAtLeast = (user, role) => (roleWeight[user?.role] || 0) >= roleWeight[role];
const publicError = (res, status, message) => res.status(status).json({ error: message });
function cookieOptions(req) {
  const forwardedProto = String(req.get('x-forwarded-proto') || '').split(',')[0].trim().toLowerCase();
  const secure = isProduction || req.secure || forwardedProto === 'https';
  return `Path=/; HttpOnly; SameSite=${secure ? 'None' : 'Lax'}; Max-Age=604800${secure ? '; Secure; Partitioned' : ''}`;
}

function issueSession(userId, req, res) {
  const token = crypto.randomBytes(32).toString('base64url');
  const createdAt = now();
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
  db.prepare('INSERT INTO sessions (token_hash,user_id,expires_at,created_at) VALUES (?,?,?,?)')
    .run(hashToken(token), userId, expiresAt, createdAt);
  res.setHeader('Set-Cookie', `clan_command_session=${encodeURIComponent(token)}; ${cookieOptions(req)}`);
  return token;
}

function getSessionUser(req) {
  const cookieToken = parseCookies(req.headers.cookie).clan_command_session;
  const bearerToken = req.get('authorization')?.match(/^Bearer\s+([A-Za-z0-9_-]+)$/i)?.[1];
  const queryToken = !isProduction && typeof req.query?.__cc_session === 'string' && /^[A-Za-z0-9_-]+$/.test(req.query.__cc_session) ? req.query.__cc_session : null;
  const tokens = [...new Set([queryToken, bearerToken, cookieToken].filter(Boolean))];
  for (const token of tokens) {
    const row = db.prepare(`SELECT u.id,u.email,u.display_name AS displayName,u.role,u.player_id AS playerId,u.is_active AS isActive,
        p.clan_id AS clanId,p.name AS playerName,p.tag AS playerTag
      FROM sessions s JOIN users u ON u.id=s.user_id LEFT JOIN players p ON p.id=u.player_id
      WHERE s.token_hash=? AND s.expires_at>? LIMIT 1`).get(hashToken(token), now());
    if (row?.isActive) return { ...row, isActive: Boolean(row.isActive) };
  }
  return null;
}

function requireSession(req, res, next) {
  const user = getSessionUser(req);
  if (!user) return publicError(res, 401, 'Your session has expired. Sign in again.');
  req.user = user;
  next();
}

function requireRole(role) {
  return (req, res, next) => roleAtLeast(req.user, role)
    ? next()
    : publicError(res, 403, `This action requires ${role.replace('_', ' ')} access.`);
}

function findUserByEmail(email) {
  return db.prepare(`SELECT id,email,display_name AS displayName,role,player_id AS playerId,is_active AS isActive,password_salt AS passwordSalt,password_hash AS passwordHash
    FROM users WHERE email=? COLLATE NOCASE LIMIT 1`).get(email);
}

function publicUser(user) {
  return { id: user.id, email: user.email, displayName: user.displayName, role: user.role, playerId: user.playerId || null, isActive: Boolean(user.isActive) };
}

function mapClan(row) {
  return {
    id: row.id, name: row.name, tag: row.tag, shortName: row.shortName,
    clanLevel: row.clanLevel, league: row.league, trophies: row.trophies,
    warWinStreak: row.warWinStreak, description: row.description,
    createdAt: row.createdAt, memberCount: row.memberCount ?? 0,
  };
}
function allClans() {
  return db.prepare(`SELECT c.id,c.name,c.tag,c.short_name AS shortName,c.clan_level AS clanLevel,c.league,c.trophies,
      c.war_win_streak AS warWinStreak,c.description,c.created_at AS createdAt,
      (SELECT COUNT(*) FROM players p WHERE p.clan_id=c.id AND p.is_active=1) AS memberCount
    FROM clans c ORDER BY CASE c.short_name WHEN 'MAIN' THEN 0 WHEN 'FEEDER' THEN 1 WHEN 'ACADEMY' THEN 2 ELSE 3 END,c.name COLLATE NOCASE`).all().map(mapClan);
}
function memberSelect() {
  return `SELECT p.id,p.tag,p.name,p.person_id AS personId,p.account_type AS accountType,p.builder_hall AS builderHall,p.xp_level AS xpLevel,
    p.best_trophies AS bestTrophies,p.builder_base_trophies AS builderBaseTrophies,p.builder_base_league AS builderBaseLeague,p.war_stars AS warStars,
    p.war_entries_90d AS warEntries90d,p.war_attacks_90d AS warAttacks90d,p.war_missed_90d AS warMissed90d,p.average_stars_90d AS averageStars90d,
    p.average_destruction_90d AS averageDestruction90d,p.left_at AS leftAt,p.return_count AS returnCount,p.clan_id AS clanId,c.name AS clanName,p.role,
    p.town_hall AS townHall,p.trophies,p.league,p.ranked_tier AS rankedTier,p.ranked_points AS rankedPoints,p.reward_points AS rewardPoints,p.hero_readiness AS heroReadiness,
    p.hero_levels_json AS heroLevelsJson,p.war_opt_in AS warOptIn,p.cwl_opt_in AS cwlOptIn,p.missed_attacks_30d AS missedAttacks30d,
    p.war_attacks_30d AS warAttacks30d,p.donation_ratio AS donationRatio,p.last_active_at AS lastActiveAt,p.joined_at AS joinedAt,
    p.base_link AS baseLink,p.is_active AS isActive,p.bio,p.created_at AS createdAt,p.updated_at AS updatedAt
    FROM players p LEFT JOIN clans c ON c.id=p.clan_id`;
}
function mapMember(row) {
  let heroLevels = {};
  try { heroLevels = JSON.parse(row.heroLevelsJson || '{}'); } catch { heroLevels = {}; }
  return {
    id: row.id, tag: row.tag, name: row.name, personId: row.personId, accountType: row.accountType, clanId: row.clanId, clanName: row.clanName || 'Unassigned', role: row.role,
    townHall: row.townHall, builderHall: row.builderHall, xpLevel: row.xpLevel, trophies: row.trophies, bestTrophies: row.bestTrophies,
    builderBaseTrophies: row.builderBaseTrophies, builderBaseLeague: row.builderBaseLeague, warStars: row.warStars,
    warEntries90d: row.warEntries90d, warAttacks90d: row.warAttacks90d, warMissed90d: row.warMissed90d,
    averageStars90d: Number(row.averageStars90d), averageDestruction90d: Number(row.averageDestruction90d), leftAt: row.leftAt,
    returnCount: row.returnCount, league: row.league, rankedTier: row.rankedTier,
    rankedPoints: row.rankedPoints, rewardPoints: row.rewardPoints, heroReadiness: row.heroReadiness, heroLevels,
    warOptIn: Boolean(row.warOptIn), cwlOptIn: Boolean(row.cwlOptIn), missedAttacks30d: row.missedAttacks30d,
    warAttacks30d: row.warAttacks30d, donationRatio: Number(row.donationRatio), lastActiveAt: row.lastActiveAt,
    joinedAt: row.joinedAt, baseLink: row.baseLink, isActive: Boolean(row.isActive), bio: row.bio,
  };
}
function allMembers() {
  return db.prepare(`${memberSelect()} ORDER BY p.is_active DESC,p.town_hall DESC,p.name COLLATE NOCASE`).all().map(mapMember);
}
function memberById(memberId) {
  const row = db.prepare(`${memberSelect()} WHERE p.id=? LIMIT 1`).get(memberId);
  return row ? mapMember(row) : null;
}
function publicMember(member) {
  return {
    id: member.id, tag: member.tag, name: member.name, clanId: member.clanId, clanName: member.clanName,
    accountType: member.accountType, role: member.role, townHall: member.townHall, builderHall: member.builderHall, xpLevel: member.xpLevel,
    trophies: member.trophies, bestTrophies: member.bestTrophies, builderBaseTrophies: member.builderBaseTrophies,
    builderBaseLeague: member.builderBaseLeague, warStars: member.warStars, league: member.league,
    rankedTier: member.rankedTier, rankedPoints: member.rankedPoints, isActive: member.isActive,
  };
}
function allWars() {
  return db.prepare(`SELECT w.id,w.clan_id AS clanId,c.name AS clanName,w.opponent,w.opponent_tag AS opponentTag,w.war_type AS warType,
      w.state,w.start_at AS startAt,w.end_at AS endAt,w.result,w.stars,w.opponent_stars AS opponentStars,w.destruction,
      w.opponent_destruction AS opponentDestruction,w.war_size AS warSize,w.attacks_used AS attacksUsed,w.notes
    FROM wars w LEFT JOIN clans c ON c.id=w.clan_id ORDER BY w.start_at DESC`).all();
}
function allAlerts() {
  return db.prepare(`SELECT a.id,a.clan_id AS clanId,a.clan_name AS clanName,a.player_id AS playerId,a.player_name AS playerName,
      a.player_tag AS playerTag,a.title,a.details,a.category,a.severity,a.status,a.created_at AS createdAt,a.resolved_at AS resolvedAt
    FROM alerts a ORDER BY CASE a.severity WHEN 'critical' THEN 0 WHEN 'warning' THEN 1 ELSE 2 END,a.created_at DESC`).all();
}
function allHistory() {
  return db.prepare(`SELECT id,player_id AS playerId,player_name AS playerName,player_tag AS playerTag,clan_name AS clanName,
      event_type AS eventType,title,details,from_value AS fromValue,to_value AS toValue,created_at AS createdAt
    FROM progression_events ORDER BY created_at DESC LIMIT 100`).all();
}
function allRewards() {
  return db.prepare(`SELECT id,name,description,category,points_cost AS pointsCost,inventory,is_active AS isActive
    FROM rewards ORDER BY is_active DESC,points_cost ASC`).all().map((row) => ({ ...row, isActive: Boolean(row.isActive) }));
}
function allClaims(user) {
  const ownOnly = !roleAtLeast(user, 'co_leader');
  const rows = ownOnly
    ? db.prepare(`SELECT rc.id,rc.player_id AS playerId,rc.player_name AS playerName,rc.player_tag AS playerTag,rc.reward_id AS rewardId,
        rc.reward_name AS rewardName,rc.points_cost AS pointsCost,rc.status,rc.requested_at AS requestedAt,rc.updated_at AS updatedAt
        FROM reward_claims rc WHERE rc.player_id=? ORDER BY rc.requested_at DESC`).all(user.playerId)
    : db.prepare(`SELECT rc.id,rc.player_id AS playerId,rc.player_name AS playerName,rc.player_tag AS playerTag,rc.reward_id AS rewardId,
        rc.reward_name AS rewardName,rc.points_cost AS pointsCost,rc.status,rc.requested_at AS requestedAt,rc.updated_at AS updatedAt
        FROM reward_claims rc ORDER BY rc.requested_at DESC`).all();
  return rows;
}
function getIntegration() {
  const row = db.prepare('SELECT * FROM discord_integrations WHERE id=\'discord\'').get();
  if (!row) return null;
  let notifications = {};
  try { notifications = JSON.parse(row.notifications_json || '{}'); } catch { notifications = {}; }
  return {
    id: 'discord', enabled: Boolean(row.enabled), guildId: row.guild_id, channelLabel: row.channel_label,
    notifications: { warReminders: true, cwlLineup: true, memberMilestones: true, rankedMovement: false, applicantAlerts: true, ...notifications },
    webhookConfigured: Boolean(row.webhook_cipher), updatedAt: row.updated_at,
  };
}
async function dispatchDiscord(notificationKey, content) {
  const row = db.prepare(`SELECT enabled,webhook_cipher,notifications_json FROM discord_integrations WHERE id='discord'`).get();
  if (!row?.enabled) return false;
  let notifications = {};
  try { notifications = JSON.parse(row.notifications_json || '{}'); } catch { return false; }
  if (!notifications[notificationKey] && notificationKey !== 'applicantAlerts') return false;
  const webhook = decryptSecret(row.webhook_cipher);
  if (!webhook || !isAllowedDiscordWebhook(webhook)) return false;
  try {
    const response = await fetch(webhook, { method: 'POST', redirect: 'error', signal: AbortSignal.timeout(5000), headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ content: String(content).slice(0, 1800) }) });
    return response.ok;
  } catch { return false; /* Integration failures never block a saved clan action. */ }
}
function addHistory({ member, eventType, title, details = '', fromValue = null, toValue = null, userId = null, at = now() }) {
  db.prepare(`INSERT INTO progression_events (id,player_id,player_name,player_tag,clan_name,event_type,title,details,from_value,to_value,created_by,created_at)
    VALUES (@id,@playerId,@playerName,@playerTag,@clanName,@eventType,@title,@details,@fromValue,@toValue,@userId,@createdAt)`)
    .run({ id: id(), playerId: member?.id || null, playerName: member?.name || 'Clan Command', playerTag: member?.tag || '', clanName: member?.clanName || '', eventType, title, details, fromValue, toValue, userId, createdAt: at });
}

const loginFailures = new Map();
function allowLogin(ip) {
  const current = loginFailures.get(ip);
  if (!current || Date.now() - current.startedAt > 5 * 60_000) {
    loginFailures.set(ip, { count: 0, startedAt: Date.now() });
    return true;
  }
  return current.count < 12;
}
function failLogin(ip) {
  const current = loginFailures.get(ip) || { count: 0, startedAt: Date.now() };
  current.count += 1;
  loginFailures.set(ip, current);
}

function publicRecruitProfile(member) {
  const clan = allClans().find((item) => item.id === member.clanId);
  const hash = [...member.tag].reduce((value, char) => (value * 31 + char.charCodeAt(0)) >>> 0, 7);
  const equipmentNames = ['Giant Gauntlet', 'Rage Vial', 'Frozen Arrow', 'Healer Puppet', 'Eternal Tome', 'Life Gem'];
  const heroEquipment = equipmentNames.slice(0, 4).map((name, index) => ({ name, level: 9 + ((hash >> (index * 3)) % 18) }));
  const rushPercent = Math.max(0, Math.min(100, Math.round((100 - member.heroReadiness) * 0.62 + (hash % 13))));
  const labPurity = Math.max(35, Math.min(100, Math.round(48 + member.heroReadiness * 0.46 + (hash % 12))));
  const threeStarRate = Math.max(0, Math.min(100, Math.round(((member.averageStars90d || (1.5 + (hash % 15) / 10)) / 3) * 100)));
  const membershipTypes = new Set(['roster_join','roster_return','roster_departure','clan_transfer','name_change']);
  const mobilityTimeline = allHistory().filter((event) => (event.playerId === member.id || event.playerTag === member.tag) && membershipTypes.has(event.eventType))
    .map((event) => ({ title: event.title, type: event.eventType, from: event.fromValue, to: event.toValue, date: event.createdAt }))
    .sort((left, right) => left.date.localeCompare(right.date));
  if (!mobilityTimeline.some((event) => event.type === 'roster_join')) {
    mobilityTimeline.unshift({ title: 'Joined the family', type: 'roster_join', from: null, to: clan?.name || member.clanName, date: member.joinedAt });
  }
  return {
    tag: member.tag, name: member.name, townHall: member.townHall, trophies: member.trophies,
    clanName: clan?.name || member.clanName, clanTag: clan?.tag || '', clanLevel: clan?.clanLevel || 0,
    active: member.isActive, joinedAt: member.joinedAt, leftAt: member.leftAt || null,
    returnCount: member.returnCount || 0, rushPercent, labPurity, heroLevels: member.heroLevels,
    heroEquipment, threeStarRate, warStars: member.warStars, mobilityTimeline,
    mockMetrics: true,
  };
}

app.get('/api/health', (_req, res) => res.json({ ok: true, app: 'clan-command', demoMode, storage: 'sqlite' }));
app.get('/api/auth/session', (req, res) => {
  const user = getSessionUser(req);
  if (!user) return res.json({ user: null, demoMode });
  return res.json({ user: publicUser(user), demoMode });
});
app.post('/api/auth/login', (req, res) => {
  const ip = req.ip || 'unknown';
  if (!allowLogin(ip)) return publicError(res, 429, 'Too many sign-in attempts. Wait a few minutes and try again.');
  const email = String(req.body?.email || '').trim().toLowerCase();
  const password = String(req.body?.password || '');
  const user = email ? findUserByEmail(email) : null;
  if (!user || !user.isActive || !verifyPassword(password, user.passwordSalt, user.passwordHash)) {
    failLogin(ip);
    return publicError(res, 401, 'Email or password did not match.');
  }
  loginFailures.delete(ip);
  const sessionToken = issueSession(user.id, req, res);
  audit(user.id, 'sign_in', 'session', null, 'Password sign-in');
  return res.json({ user: publicUser(user), demoMode, ...(!isProduction ? { sessionToken } : {}) });
});
app.post('/api/auth/demo-login', (req, res) => {
  if (!demoMode) return publicError(res, 404, 'Demo sign-in is disabled.');
  const role = String(req.body?.role || 'leader');
  const account = getDemoRoles().find((entry) => entry.role === role);
  if (!account) return publicError(res, 400, 'Select a valid demo role.');
  const user = findUserByEmail(account.email);
  if (!user || !user.isActive) return publicError(res, 503, 'The demo account is not available in this database.');
  const sessionToken = issueSession(user.id, req, res);
  audit(user.id, 'demo_sign_in', 'session', null, `Demo role: ${role}`);
  return res.json({ user: publicUser(user), demoMode: true, ...(!isProduction ? { sessionToken } : {}) });
});
app.post('/api/auth/logout', (req, res) => {
  const cookies = parseCookies(req.headers.cookie);
  const bearerToken = req.get('authorization')?.match(/^Bearer\s+([A-Za-z0-9_-]+)$/i)?.[1];
  const queryToken = !isProduction && typeof req.query?.__cc_session === 'string' && /^[A-Za-z0-9_-]+$/.test(req.query.__cc_session) ? req.query.__cc_session : null;
  const tokens = [...new Set([queryToken, bearerToken, cookies.clan_command_session].filter(Boolean))];
  for (const token of tokens) {
    const row = db.prepare('SELECT user_id FROM sessions WHERE token_hash=?').get(hashToken(token));
    db.prepare('DELETE FROM sessions WHERE token_hash=?').run(hashToken(token));
    if (row) audit(row.user_id, 'sign_out', 'session', null, 'Signed out');
  }
  res.setHeader('Set-Cookie', `clan_command_session=; ${cookieOptions(req).replace('Max-Age=604800', 'Max-Age=0')}`);
  return res.json({ ok: true });
});

app.get('/api/public-search', (req, res) => {
  const query = String(req.query.q || req.query.tag || '').trim().toUpperCase();
  if (!query || query.length > 40) return res.json({ kind: 'none', query, items: [] });
  const tagQuery = query.startsWith('#') ? query : `#${query}`;
  const clan = /^#[0-9A-Z]{3,16}$/.test(tagQuery) ? allClans().find((item) => item.tag.toUpperCase() === tagQuery) : null;
  if (clan) {
    const members = allMembers().filter((member) => member.clanId === clan.id).map(publicRecruitProfile);
    return res.json({ kind: 'clan', query, clan, items: members });
  }
  const all = allMembers();
  let members = /^#[0-9A-Z]{3,16}$/.test(tagQuery)
    ? all.filter((member) => member.tag.toUpperCase() === tagQuery)
    : all.filter((member) => member.name.toUpperCase().includes(query) || member.clanName.toUpperCase().includes(query));
  members = members.slice(0, 12).map(publicRecruitProfile);
  return res.json({ kind: members.length ? 'player' : 'none', query, items: members });
});

app.use('/api', requireSession);

app.get('/api/bootstrap', (req, res) => {
  const user = req.user;
  const all = allMembers();
  const leadership = roleAtLeast(user, 'elder');
  const own = all.find((member) => member.id === user.playerId) || null;
  const members = leadership ? all : all.filter((member) => member.isActive).map((member) => member.id === user.playerId ? member : publicMember(member));
  const alerts = allAlerts().filter((alert) => leadership || alert.playerId === user.playerId);
  const history = allHistory().filter((event) => leadership || event.playerId === user.playerId);
  const claims = allClaims(user);
  const users = user.role === 'leader'
    ? db.prepare(`SELECT id,email,display_name AS displayName,role,player_id AS playerId,is_active AS isActive,created_at AS createdAt
        FROM users ORDER BY CASE role WHEN 'leader' THEN 0 WHEN 'co_leader' THEN 1 WHEN 'elder' THEN 2 ELSE 3 END,display_name COLLATE NOCASE`)
      .all().map((entry) => ({ ...entry, isActive: Boolean(entry.isActive) }))
    : [];
  const response = {
    clans: allClans(), members, wars: allWars(), alerts, history, rewards: allRewards(), claims,
    integration: user.role === 'leader' ? getIntegration() : null,
    users, demoMode, ownMember: leadership ? undefined : own,
  };
  return res.json({ user: publicUser(user), data: response });
});

app.get('/api/clans', (_req, res) => res.json({ items: allClans() }));
app.post('/api/clans', requireRole('leader'), (req, res) => {
  const body = req.body || {};
  const name = String(body.name || '').trim();
  const tag = String(body.tag || '').trim().toUpperCase();
  if (name.length < 2 || !/^#[0-9A-Z]{3,16}$/.test(tag)) return publicError(res, 400, 'Add a clan name and a valid player tag.');
  const stamp = now();
  const clanId = id();
  try {
    db.prepare(`INSERT INTO clans (id,name,tag,short_name,clan_level,league,trophies,war_win_streak,description,created_at,updated_at)
      VALUES (@id,@name,@tag,@shortName,@clanLevel,@league,@trophies,@warWinStreak,@description,@createdAt,@updatedAt)`)
      .run({ id: clanId, name, tag, shortName: String(body.shortName || name.slice(0, 10)).trim(), clanLevel: boundedInt(body.clanLevel, 1, 30, 1), league: safeText(body.league, 64, 'Unranked'), trophies: boundedInt(body.trophies, 0, 10_000_000, 0), warWinStreak: boundedInt(body.warWinStreak, 0, 999, 0), description: safeText(body.description, 600), createdAt: stamp, updatedAt: stamp });
  } catch (error) { return publicError(res, 409, isUniqueError(error) ? 'That clan tag is already in the family.' : 'Clan could not be saved.'); }
  audit(req.user.id, 'create', 'clan', clanId, name);
  return res.status(201).json({ item: allClans().find((clan) => clan.id === clanId) });
});
app.patch('/api/clans/:id', requireRole('leader'), (req, res) => {
  const current = db.prepare('SELECT * FROM clans WHERE id=?').get(req.params.id);
  if (!current) return publicError(res, 404, 'Clan not found.');
  const fields = {
    name: safeText(req.body?.name, 100, current.name), tag: safeTag(req.body?.tag, current.tag),
    shortName: safeText(req.body?.shortName, 24, current.short_name), clanLevel: boundedInt(req.body?.clanLevel, 1, 30, current.clan_level),
    league: safeText(req.body?.league, 64, current.league), trophies: boundedInt(req.body?.trophies, 0, 10_000_000, current.trophies),
    warWinStreak: boundedInt(req.body?.warWinStreak, 0, 999, current.war_win_streak), description: safeText(req.body?.description, 600, current.description),
  };
  try {
    db.prepare(`UPDATE clans SET name=@name,tag=@tag,short_name=@shortName,clan_level=@clanLevel,league=@league,trophies=@trophies,
      war_win_streak=@warWinStreak,description=@description,updated_at=@updatedAt WHERE id=@id`).run({ ...fields, id: current.id, updatedAt: now() });
  } catch (error) { return publicError(res, 409, isUniqueError(error) ? 'That clan tag is already in the family.' : 'Clan could not be saved.'); }
  audit(req.user.id, 'update', 'clan', current.id, fields.name);
  return res.json({ item: allClans().find((clan) => clan.id === current.id) });
});
app.delete('/api/clans/:id', requireRole('leader'), (req, res) => {
  const current = db.prepare('SELECT id,name FROM clans WHERE id=?').get(req.params.id);
  if (!current) return publicError(res, 404, 'Clan not found.');
  const count = db.prepare('SELECT COUNT(*) AS count FROM players WHERE clan_id=?').get(current.id).count;
  const wars = db.prepare('SELECT COUNT(*) AS count FROM wars WHERE clan_id=?').get(current.id).count;
  if (count || wars) return publicError(res, 409, 'Move its roster and archive its war records before deleting this clan.');
  db.prepare('DELETE FROM clans WHERE id=?').run(current.id);
  audit(req.user.id, 'delete', 'clan', current.id, current.name);
  return res.json({ ok: true });
});

app.get('/api/members', (req, res) => {
  let items = allMembers();
  const q = String(req.query.q || '').trim().toLowerCase();
  if (q) items = items.filter((member) => member.name.toLowerCase().includes(q) || member.tag.toLowerCase().includes(q) || member.clanName.toLowerCase().includes(q));
  if (req.query.clanId) items = items.filter((member) => member.clanId === req.query.clanId);
  if (req.query.townHall) items = items.filter((member) => member.townHall === Number(req.query.townHall));
  if (req.query.role) items = items.filter((member) => member.role === req.query.role);
  if (req.user.role === 'member') items = items.filter((member) => member.isActive).map(publicMember);
  return res.json({ items });
});
app.get('/api/members/:id', (req, res) => {
  const member = memberById(req.params.id);
  if (!member) return publicError(res, 404, 'Player base not found.');
  if (req.user.role === 'member' && member.id !== req.user.playerId) return publicError(res, 403, 'Member profiles are limited to your own base.');
  return res.json({ item: member });
});
app.post('/api/members', requireRole('co_leader'), (req, res) => {
  const body = req.body || {};
  const name = safeText(body.name, 32);
  const tag = String(body.tag || '').trim().toUpperCase();
  const clan = db.prepare('SELECT id,name FROM clans WHERE id=?').get(body.clanId);
  if (name.length < 2 || !/^#[0-9A-Z]{3,16}$/.test(tag) || !clan) return publicError(res, 400, 'Add a player name, valid tag, and clan.');
  const role = validRole(body.role) ? body.role : 'member';
  const townHall = boundedInt(body.townHall, 1, 18, 12);
  const trophies = boundedInt(body.trophies, 0, 20_000, 0);
  if (role === 'leader' && req.user.role !== 'leader') return publicError(res, 403, 'Only a Leader can assign the in-game Leader role.');
  const stamp = now();
  const memberId = id();
  try {
    db.prepare(`INSERT INTO players (id,tag,name,person_id,account_type,builder_hall,xp_level,best_trophies,builder_base_trophies,builder_base_league,
        war_stars,war_entries_90d,war_attacks_90d,war_missed_90d,average_stars_90d,average_destruction_90d,left_at,return_count,clan_id,role,town_hall,
        trophies,league,ranked_tier,ranked_points,reward_points,hero_readiness,hero_levels_json,war_opt_in,cwl_opt_in,missed_attacks_30d,war_attacks_30d,
        donation_ratio,last_active_at,joined_at,base_link,is_active,bio,created_at,updated_at)
      VALUES (@id,@tag,@name,@personId,@accountType,@builderHall,@xpLevel,@bestTrophies,@builderBaseTrophies,@builderBaseLeague,
        @warStars,@warEntries90d,@warAttacks90d,@warMissed90d,@averageStars90d,@averageDestruction90d,@leftAt,@returnCount,@clanId,@role,@townHall,
        @trophies,@league,@rankedTier,@rankedPoints,@rewardPoints,@heroReadiness,@heroLevels,@warOptIn,@cwlOptIn,@missedAttacks30d,@warAttacks30d,
        @donationRatio,@lastActiveAt,@joinedAt,@baseLink,1,@bio,@createdAt,@updatedAt)`)
      .run({ id: memberId, tag, name, personId: safeOptionalText(body.personId, 64) || '', accountType: safeText(body.accountType, 32, 'Main'),
        builderHall: boundedInt(body.builderHall, 0, 10, 1), xpLevel: boundedInt(body.xpLevel, 1, 500, Math.max(1, townHall * 10)),
        bestTrophies: boundedInt(body.bestTrophies, trophies, 100_000, trophies), builderBaseTrophies: boundedInt(body.builderBaseTrophies, 0, 20_000, 0),
        builderBaseLeague: safeText(body.builderBaseLeague, 64, 'Unranked'), warStars: boundedInt(body.warStars, 0, 100_000, 0),
        warEntries90d: boundedInt(body.warEntries90d, 0, 1000, 0), warAttacks90d: boundedInt(body.warAttacks90d, 0, 2000, 0),
        warMissed90d: boundedInt(body.warMissed90d, 0, 1000, 0), averageStars90d: boundedFloat(body.averageStars90d, 0, 6, 0),
        averageDestruction90d: boundedFloat(body.averageDestruction90d, 0, 100, 0), leftAt: safeDate(body.leftAt, null), returnCount: boundedInt(body.returnCount, 0, 999, 0),
        clanId: clan.id, role, townHall, trophies, league: safeText(body.league, 64, 'Unranked'), rankedTier: safeText(body.rankedTier, 32, 'Unranked'), rankedPoints: boundedInt(body.rankedPoints, 0, 50_000, 0), rewardPoints: boundedInt(body.rewardPoints, 0, 1_000_000, 0), heroReadiness: boundedInt(body.heroReadiness, 0, 100, 50), heroLevels: JSON.stringify(safeHeroLevels(body.heroLevels)), warOptIn: body.warOptIn === false ? 0 : 1, cwlOptIn: body.cwlOptIn === false ? 0 : 1, missedAttacks30d: boundedInt(body.missedAttacks30d, 0, 100, 0), warAttacks30d: boundedInt(body.warAttacks30d, 0, 100, 0), donationRatio: boundedFloat(body.donationRatio, 0, 1000, 1), lastActiveAt: stamp, joinedAt: safeDate(body.joinedAt, stamp), baseLink: safeText(body.baseLink, 400), bio: safeText(body.bio, 300), createdAt: stamp, updatedAt: stamp });
  } catch (error) { return publicError(res, 409, isUniqueError(error) ? 'That player tag is already in the roster.' : 'Player base could not be added.'); }
  const created = memberById(memberId);
  addHistory({ member: created, eventType: 'roster_join', title: 'Player added to the roster', details: `${created.name} joined ${created.clanName}.`, toValue: created.clanName, userId: req.user.id });
  audit(req.user.id, 'create', 'member', memberId, `${created.name} · ${created.tag}`);
  void dispatchDiscord('memberMilestones', `✦ ${created.name} joined ${created.clanName}.`);
  return res.status(201).json({ item: memberById(memberId) });
});
app.patch('/api/members/:id', (req, res) => {
  const before = memberById(req.params.id);
  if (!before) return publicError(res, 404, 'Player base not found.');
  const body = req.body || {};
  if (req.user.role === 'member' && before.id !== req.user.playerId) return publicError(res, 403, 'You can only update your own base.');
  const canManageRoster = roleAtLeast(req.user, 'co_leader');
  const allowedSelf = ['warOptIn','cwlOptIn','bio'];
  const allowedElder = [...allowedSelf,'heroReadiness'];
  const permittedFields = canManageRoster ? Object.keys(body) : req.user.role === 'elder' ? Object.keys(body).filter((key) => allowedElder.includes(key)) : Object.keys(body).filter((key) => allowedSelf.includes(key));
  if (!permittedFields.length) return publicError(res, 403, 'Your role cannot edit those base details.');
  const next = { ...before };
  for (const key of permittedFields) if (key in body) next[key] = body[key];
  if (next.role === 'leader' && req.user.role !== 'leader') return publicError(res, 403, 'Only a Leader can assign the in-game Leader role.');
  if (!db.prepare('SELECT id FROM clans WHERE id=?').get(next.clanId)) return publicError(res, 400, 'Choose an existing clan.');
  const stamp = now();
  try {
    db.prepare(`UPDATE players SET tag=@tag,name=@name,person_id=@personId,account_type=@accountType,builder_hall=@builderHall,xp_level=@xpLevel,
        best_trophies=@bestTrophies,builder_base_trophies=@builderBaseTrophies,builder_base_league=@builderBaseLeague,war_stars=@warStars,
        war_entries_90d=@warEntries90d,war_attacks_90d=@warAttacks90d,war_missed_90d=@warMissed90d,average_stars_90d=@averageStars90d,
        average_destruction_90d=@averageDestruction90d,left_at=@leftAt,return_count=@returnCount,clan_id=@clanId,role=@role,town_hall=@townHall,
        trophies=@trophies,league=@league,ranked_tier=@rankedTier,ranked_points=@rankedPoints,reward_points=@rewardPoints,
        hero_readiness=@heroReadiness,hero_levels_json=@heroLevels,war_opt_in=@warOptIn,cwl_opt_in=@cwlOptIn,
        missed_attacks_30d=@missedAttacks30d,war_attacks_30d=@warAttacks30d,donation_ratio=@donationRatio,
        joined_at=@joinedAt,base_link=@baseLink,is_active=@isActive,bio=@bio,updated_at=@updatedAt WHERE id=@id`)
      .run({ id: before.id, tag: safeTag(next.tag, before.tag), name: safeText(next.name, 32, before.name),
        personId: safeOptionalText(next.personId, 64) || '', accountType: safeText(next.accountType, 32, 'Main'),
        builderHall: boundedInt(next.builderHall, 0, 10, before.builderHall), xpLevel: boundedInt(next.xpLevel, 1, 500, before.xpLevel),
        bestTrophies: boundedInt(next.bestTrophies, boundedInt(next.trophies, 0, 20_000, before.trophies), 100_000, before.bestTrophies), builderBaseTrophies: boundedInt(next.builderBaseTrophies, 0, 20_000, before.builderBaseTrophies),
        builderBaseLeague: safeText(next.builderBaseLeague, 64, before.builderBaseLeague), warStars: boundedInt(next.warStars, 0, 100_000, before.warStars),
        warEntries90d: boundedInt(next.warEntries90d, 0, 1000, before.warEntries90d), warAttacks90d: boundedInt(next.warAttacks90d, 0, 2000, before.warAttacks90d),
        warMissed90d: boundedInt(next.warMissed90d, 0, 1000, before.warMissed90d), averageStars90d: boundedFloat(next.averageStars90d, 0, 6, before.averageStars90d),
        averageDestruction90d: boundedFloat(next.averageDestruction90d, 0, 100, before.averageDestruction90d),
        leftAt: next.isActive === false && before.isActive ? stamp : next.isActive !== false && !before.isActive ? null : safeDate(next.leftAt, before.leftAt),
        returnCount: next.isActive !== false && !before.isActive ? boundedInt(before.returnCount + 1, 0, 999, before.returnCount) : boundedInt(next.returnCount, 0, 999, before.returnCount),
        clanId: next.clanId, role: validRole(next.role) ? next.role : before.role,
        townHall: boundedInt(next.townHall, 1, 18, before.townHall), trophies: boundedInt(next.trophies, 0, 20_000, before.trophies),
        league: safeText(next.league, 64, before.league), rankedTier: safeText(next.rankedTier, 32, before.rankedTier), rankedPoints: boundedInt(next.rankedPoints, 0, 50_000, before.rankedPoints),
        rewardPoints: boundedInt(next.rewardPoints, 0, 1_000_000, before.rewardPoints), heroReadiness: boundedInt(next.heroReadiness, 0, 100, before.heroReadiness), heroLevels: JSON.stringify(safeHeroLevels(next.heroLevels)),
        warOptIn: next.warOptIn ? 1 : 0, cwlOptIn: next.cwlOptIn ? 1 : 0, missedAttacks30d: boundedInt(next.missedAttacks30d, 0, 100, before.missedAttacks30d),
        warAttacks30d: boundedInt(next.warAttacks30d, 0, 100, before.warAttacks30d), donationRatio: boundedFloat(next.donationRatio, 0, 1000, before.donationRatio),
        joinedAt: safeDate(next.joinedAt, before.joinedAt), baseLink: safeText(next.baseLink, 400, before.baseLink), isActive: next.isActive === false ? 0 : 1,
        bio: safeText(next.bio, 300, before.bio), updatedAt: stamp });
  } catch (error) { return publicError(res, 409, isUniqueError(error) ? 'That player tag is already in the roster.' : 'Player base could not be saved.'); }
  const after = memberById(before.id);
  const tracked = [
    ['name','name_change','Player name changed'], ['townHall','town_hall','Town Hall upgraded'], ['builderHall','builder_hall','Builder Hall upgraded'],
    ['league','league_change','Home village league changed'], ['bestTrophies','trophy_record','Home village trophy record updated'],
    ['builderBaseLeague','builder_league_change','Builder Base league changed'], ['builderBaseTrophies','builder_trophy_record','Builder Base trophy record updated'],
    ['rankedTier','ranked_promotion','Ranked tier updated'], ['rankedPoints','ranked_movement','Ranked points updated'],
    ['warStars','war_milestone','War stars updated'], ['role','role_change','In-game clan role changed'], ['clanName','clan_transfer','Clan assignment changed'],
  ];
  for (const [field, type, title] of tracked) {
    if (String(before[field]) !== String(after[field])) addHistory({ member: after, eventType: type, title, details: `${before[field]} → ${after[field]}`, fromValue: String(before[field]), toValue: String(after[field]), userId: req.user.id });
  }
  if (before.isActive !== after.isActive) addHistory({ member: after, eventType: after.isActive ? 'roster_return' : 'roster_departure', title: after.isActive ? 'Returned to the family' : 'Left the active roster', userId: req.user.id });
  if (before.rankedTier !== after.rankedTier || before.rankedPoints !== after.rankedPoints) void dispatchDiscord('rankedMovement', `🏆 ${after.name} · ${before.rankedTier} ${before.rankedPoints} → ${after.rankedTier} ${after.rankedPoints} points.`);
  audit(req.user.id, 'update', 'member', before.id, after.name);
  return res.json({ item: after });
});
app.delete('/api/members/:id', requireRole('co_leader'), (req, res) => {
  const before = memberById(req.params.id);
  if (!before) return publicError(res, 404, 'Player base not found.');
  db.prepare('DELETE FROM players WHERE id=?').run(before.id);
  audit(req.user.id, 'delete', 'member', before.id, `${before.name} · ${before.tag}`);
  return res.json({ ok: true });
});

app.get('/api/search', (req, res) => {
  const q = String(req.query.q || '').trim();
  if (!q) return res.json({ items: [] });
  const normalized = q.replace(/[%_]/g, '');
  const items = allMembers().filter((member) => member.tag.toLowerCase() === normalized.toLowerCase() || member.name.toLowerCase().includes(normalized.toLowerCase()) || member.clanName.toLowerCase().includes(normalized.toLowerCase()));
  return res.json({ items: req.user.role === 'member' ? items.filter((member) => member.isActive).map(publicMember) : items });
});

app.get('/api/wars', (_req, res) => res.json({ items: allWars() }));
app.post('/api/wars', requireRole('co_leader'), (req, res) => {
  const body = req.body || {};
  const clan = db.prepare('SELECT id,name FROM clans WHERE id=?').get(body.clanId);
  const opponent = safeText(body.opponent, 80);
  if (!clan || opponent.length < 2) return publicError(res, 400, 'Choose a clan and opponent.');
  const warId = id();
  const stamp = now();
  const startAt = safeDate(body.startAt, stamp);
  const endAt = safeDate(body.endAt, new Date(Date.parse(startAt) + 24 * 60 * 60 * 1000).toISOString());
  try {
    db.prepare(`INSERT INTO wars (id,clan_id,opponent,opponent_tag,war_type,state,start_at,end_at,result,stars,opponent_stars,destruction,opponent_destruction,war_size,attacks_used,notes,created_at,updated_at)
      VALUES (@id,@clanId,@opponent,@opponentTag,@warType,@state,@startAt,@endAt,@result,@stars,@opponentStars,@destruction,@opponentDestruction,@warSize,@attacksUsed,@notes,@createdAt,@updatedAt)`)
      .run({ id: warId, clanId: clan.id, opponent, opponentTag: safeTag(body.opponentTag, ''), warType: enumValue(body.warType, ['regular','cwl','friendly'], 'regular'), state: enumValue(body.state, ['preparation','in_war','complete','cancelled'], 'preparation'), startAt, endAt, result: enumValue(body.result, ['win','loss','draw','pending'], 'pending'), stars: boundedInt(body.stars, 0, 300, 0), opponentStars: boundedInt(body.opponentStars, 0, 300, 0), destruction: boundedFloat(body.destruction, 0, 100, 0), opponentDestruction: boundedFloat(body.opponentDestruction, 0, 100, 0), warSize: boundedInt(body.warSize, 5, 50, 15), attacksUsed: boundedInt(body.attacksUsed, 0, 100, 0), notes: safeText(body.notes, 1000), createdAt: stamp, updatedAt: stamp });
  } catch { return publicError(res, 400, 'War record could not be saved.'); }
  audit(req.user.id, 'create', 'war', warId, `${opponent} · ${body.warType || 'regular'}`);
  void dispatchDiscord(body.warType === 'cwl' ? 'cwlLineup' : 'warReminders', `⚔️ ${clan.name} logged a ${String(body.warType || 'regular').toUpperCase()} matchup against ${opponent}.`);
  return res.status(201).json({ item: allWars().find((war) => war.id === warId) });
});
app.patch('/api/wars/:id', requireRole('co_leader'), (req, res) => {
  const current = db.prepare('SELECT * FROM wars WHERE id=?').get(req.params.id);
  if (!current) return publicError(res, 404, 'War record not found.');
  const clanId = req.body?.clanId || current.clan_id;
  const clan = db.prepare('SELECT id FROM clans WHERE id=?').get(clanId);
  if (!clan) return publicError(res, 400, 'Choose an existing clan.');
  const startAt = safeDate(req.body?.startAt, current.start_at);
  const endAt = safeDate(req.body?.endAt, current.end_at);
  db.prepare(`UPDATE wars SET clan_id=@clanId,opponent=@opponent,opponent_tag=@opponentTag,war_type=@warType,state=@state,start_at=@startAt,end_at=@endAt,
    result=@result,stars=@stars,opponent_stars=@opponentStars,destruction=@destruction,opponent_destruction=@opponentDestruction,war_size=@warSize,attacks_used=@attacksUsed,notes=@notes,updated_at=@updatedAt WHERE id=@id`)
    .run({ id: current.id, clanId, opponent: safeText(req.body?.opponent, 80, current.opponent), opponentTag: safeTag(req.body?.opponentTag, current.opponent_tag), warType: enumValue(req.body?.warType, ['regular','cwl','friendly'], current.war_type), state: enumValue(req.body?.state, ['preparation','in_war','complete','cancelled'], current.state), startAt, endAt, result: enumValue(req.body?.result, ['win','loss','draw','pending'], current.result), stars: boundedInt(req.body?.stars, 0, 300, current.stars), opponentStars: boundedInt(req.body?.opponentStars, 0, 300, current.opponent_stars), destruction: boundedFloat(req.body?.destruction, 0, 100, current.destruction), opponentDestruction: boundedFloat(req.body?.opponentDestruction, 0, 100, current.opponent_destruction), warSize: boundedInt(req.body?.warSize, 5, 50, current.war_size), attacksUsed: boundedInt(req.body?.attacksUsed, 0, 100, current.attacks_used), notes: safeText(req.body?.notes, 1000, current.notes), updatedAt: now() });
  const updatedWar = allWars().find((war) => war.id === current.id);
  audit(req.user.id, 'update', 'war', current.id, safeText(req.body?.opponent, 80, current.opponent));
  if (current.state !== updatedWar?.state || current.war_type !== updatedWar?.warType) {
    void dispatchDiscord(updatedWar?.warType === 'cwl' ? 'cwlLineup' : 'warReminders', `⚔️ ${updatedWar?.clanName || 'Clan'} war status updated: ${updatedWar?.opponent || 'opponent'} · ${updatedWar?.state || 'updated'}.`);
  }
  return res.json({ item: updatedWar });
});
app.delete('/api/wars/:id', requireRole('co_leader'), (req, res) => {
  const current = db.prepare('SELECT id,opponent FROM wars WHERE id=?').get(req.params.id);
  if (!current) return publicError(res, 404, 'War record not found.');
  db.prepare('DELETE FROM wars WHERE id=?').run(current.id);
  audit(req.user.id, 'delete', 'war', current.id, current.opponent);
  return res.json({ ok: true });
});

app.get('/api/alerts', (req, res) => {
  const items = allAlerts().filter((alert) => req.user.role !== 'member' || alert.playerId === req.user.playerId);
  return res.json({ items });
});
app.post('/api/alerts', requireRole('elder'), (req, res) => {
  const body = req.body || {};
  const title = safeText(body.title, 120);
  const details = safeText(body.details, 1000);
  if (title.length < 3 || details.length < 4) return publicError(res, 400, 'Add a short title and a useful alert detail.');
  const clan = body.clanId ? db.prepare('SELECT id,name FROM clans WHERE id=?').get(body.clanId) : null;
  const member = body.playerId ? memberById(body.playerId) : null;
  const alertId = id();
  db.prepare(`INSERT INTO alerts (id,clan_id,clan_name,player_id,player_name,player_tag,title,details,category,severity,status,created_by,created_at,resolved_at)
    VALUES (@id,@clanId,@clanName,@playerId,@playerName,@playerTag,@title,@details,@category,@severity,'open',@userId,@createdAt,NULL)`)
    .run({ id: alertId, clanId: clan?.id || null, clanName: clan?.name || '', playerId: member?.id || null, playerName: member?.name || null, playerTag: member?.tag || null, title, details, category: enumValue(body.category, ['war','cwl','progression','roster','rewards','system'], 'system'), severity: enumValue(body.severity, ['critical','warning','info'], 'info'), userId: req.user.id, createdAt: now() });
  audit(req.user.id, 'create', 'alert', alertId, title);
  const category = enumValue(body.category, ['war','cwl','progression','roster','rewards','system'], 'system');
  const discordRoute = category === 'cwl' ? 'cwlLineup' : category === 'war' ? 'warReminders' : 'memberMilestones';
  void dispatchDiscord(discordRoute, `🔔 ${category.toUpperCase()} alert · ${title} · ${clan?.name || 'Clan family'}`);
  return res.status(201).json({ item: allAlerts().find((alert) => alert.id === alertId) });
});
app.patch('/api/alerts/:id', requireRole('elder'), (req, res) => {
  const current = db.prepare('SELECT * FROM alerts WHERE id=?').get(req.params.id);
  if (!current) return publicError(res, 404, 'Alert not found.');
  const status = enumValue(req.body?.status, ['open','acknowledged','resolved'], current.status);
  const severity = enumValue(req.body?.severity, ['critical','warning','info'], current.severity);
  const resolvedAt = status === 'resolved' ? current.resolved_at || now() : null;
  db.prepare(`UPDATE alerts SET title=@title,details=@details,severity=@severity,status=@status,resolved_at=@resolvedAt WHERE id=@id`)
    .run({ id: current.id, title: safeText(req.body?.title, 120, current.title), details: safeText(req.body?.details, 1000, current.details), severity, status, resolvedAt });
  audit(req.user.id, 'update', 'alert', current.id, status);
  return res.json({ item: allAlerts().find((alert) => alert.id === current.id) });
});
app.delete('/api/alerts/:id', requireRole('co_leader'), (req, res) => {
  const current = db.prepare('SELECT id,title FROM alerts WHERE id=?').get(req.params.id);
  if (!current) return publicError(res, 404, 'Alert not found.');
  db.prepare('DELETE FROM alerts WHERE id=?').run(current.id);
  audit(req.user.id, 'delete', 'alert', current.id, current.title);
  return res.json({ ok: true });
});

app.get('/api/history', (req, res) => {
  const items = allHistory().filter((event) => req.user.role !== 'member' || event.playerId === req.user.playerId);
  return res.json({ items });
});
app.post('/api/history', requireRole('elder'), (req, res) => {
  const member = req.body?.playerId ? memberById(req.body.playerId) : null;
  const title = safeText(req.body?.title, 120);
  const details = safeText(req.body?.details, 600);
  if (title.length < 3) return publicError(res, 400, 'Give the progression event a clear title.');
  const at = safeDate(req.body?.createdAt, now());
  addHistory({ member, eventType: enumValue(req.body?.eventType, ['town_hall','hero_upgrade','ranked_promotion','league_change','war_milestone','role_change','clan_transfer','note'], 'note'), title, details, fromValue: safeOptionalText(req.body?.fromValue, 80), toValue: safeOptionalText(req.body?.toValue, 80), userId: req.user.id, at });
  const item = allHistory()[0];
  audit(req.user.id, 'create', 'progression', item?.id, title);
  void dispatchDiscord('memberMilestones', `✦ ${item?.playerName || 'Clan family'} · ${title}`);
  return res.status(201).json({ item });
});

app.get('/api/rewards', (_req, res) => res.json({ items: allRewards() }));
app.post('/api/rewards', requireRole('co_leader'), (req, res) => {
  const body = req.body || {};
  const name = safeText(body.name, 100);
  if (name.length < 2) return publicError(res, 400, 'Add a reward name.');
  const rewardId = id();
  const stamp = now();
  db.prepare(`INSERT INTO rewards (id,name,description,category,points_cost,inventory,is_active,created_at,updated_at) VALUES (@id,@name,@description,@category,@pointsCost,@inventory,@isActive,@createdAt,@updatedAt)`)
    .run({ id: rewardId, name, description: safeText(body.description, 500), category: safeText(body.category, 48, 'Seasonal'), pointsCost: boundedInt(body.pointsCost, 0, 1_000_000, 100), inventory: boundedInt(body.inventory, 0, 1_000_000, 0), isActive: body.isActive === false ? 0 : 1, createdAt: stamp, updatedAt: stamp });
  audit(req.user.id, 'create', 'reward', rewardId, name);
  return res.status(201).json({ item: allRewards().find((reward) => reward.id === rewardId) });
});
app.patch('/api/rewards/:id', requireRole('co_leader'), (req, res) => {
  const current = db.prepare('SELECT * FROM rewards WHERE id=?').get(req.params.id);
  if (!current) return publicError(res, 404, 'Reward not found.');
  db.prepare(`UPDATE rewards SET name=@name,description=@description,category=@category,points_cost=@pointsCost,inventory=@inventory,is_active=@isActive,updated_at=@updatedAt WHERE id=@id`)
    .run({ id: current.id, name: safeText(req.body?.name, 100, current.name), description: safeText(req.body?.description, 500, current.description), category: safeText(req.body?.category, 48, current.category), pointsCost: boundedInt(req.body?.pointsCost, 0, 1_000_000, current.points_cost), inventory: boundedInt(req.body?.inventory, 0, 1_000_000, current.inventory), isActive: req.body?.isActive === undefined ? current.is_active : req.body.isActive ? 1 : 0, updatedAt: now() });
  audit(req.user.id, 'update', 'reward', current.id, current.name);
  return res.json({ item: allRewards().find((reward) => reward.id === current.id) });
});
app.delete('/api/rewards/:id', requireRole('co_leader'), (req, res) => {
  const current = db.prepare('SELECT id,name FROM rewards WHERE id=?').get(req.params.id);
  if (!current) return publicError(res, 404, 'Reward not found.');
  db.prepare('DELETE FROM rewards WHERE id=?').run(current.id);
  audit(req.user.id, 'delete', 'reward', current.id, current.name);
  return res.json({ ok: true });
});

app.get('/api/claims', (req, res) => res.json({ items: allClaims(req.user) }));
app.post('/api/claims', (req, res) => {
  if (!req.user.playerId) return publicError(res, 400, 'This login is not linked to a player base. Ask a Leader to link your account.');
  const result = () => runTransaction(() => {
    const reward = db.prepare('SELECT * FROM rewards WHERE id=? AND is_active=1').get(req.body?.rewardId);
    const player = db.prepare('SELECT id,name,tag,reward_points AS rewardPoints FROM players WHERE id=? AND is_active=1').get(req.user.playerId);
    if (!reward || !player) throw new Error('That reward is no longer available.');
    const activeClaims = db.prepare(`SELECT COUNT(*) AS count FROM reward_claims WHERE reward_id=? AND status IN ('pending','approved')`).get(reward.id).count;
    if (reward.inventory > 0 && activeClaims >= reward.inventory) throw new Error('That reward is out of stock.');
    if (player.rewardPoints < reward.points_cost) throw new Error('You do not have enough reward points yet.');
    const claimId = id();
    const stamp = now();
    db.prepare('UPDATE players SET reward_points=reward_points-?,updated_at=? WHERE id=?').run(reward.points_cost, stamp, player.id);
    db.prepare(`INSERT INTO reward_claims (id,player_id,player_name,player_tag,reward_id,reward_name,points_cost,status,requested_at,updated_at,resolved_by)
      VALUES (?,?,?,?,?,?,?,'pending',?,?,NULL)`)
      .run(claimId, player.id, player.name, player.tag, reward.id, reward.name, reward.points_cost, stamp, stamp);
    return claimId;
  });
  let claimId;
  try { claimId = result(); } catch (error) { return publicError(res, 409, error.message || 'Reward claim could not be placed.'); }
  audit(req.user.id, 'create', 'reward_claim', claimId, 'Reward requested');
  return res.status(201).json({ item: allClaims({ ...req.user, role: 'co_leader' }).find((claim) => claim.id === claimId), member: memberById(req.user.playerId) });
});
app.patch('/api/claims/:id', requireRole('co_leader'), (req, res) => {
  const nextStatus = enumValue(req.body?.status, ['approved','fulfilled','rejected'], null);
  if (!nextStatus) return publicError(res, 400, 'Choose approved, fulfilled, or rejected.');
  const apply = () => runTransaction(() => {
    const claim = db.prepare('SELECT * FROM reward_claims WHERE id=?').get(req.params.id);
    if (!claim) throw new Error('Reward request not found.');
    const allowed = (claim.status === 'pending' && ['approved','rejected'].includes(nextStatus)) || (claim.status === 'approved' && ['fulfilled','rejected'].includes(nextStatus));
    if (!allowed) throw new Error(`A ${claim.status} request cannot be changed to ${nextStatus}.`);
    if (nextStatus === 'fulfilled' && claim.reward_id) {
      const reward = db.prepare('SELECT inventory FROM rewards WHERE id=?').get(claim.reward_id);
      if (reward && reward.inventory > 0) db.prepare('UPDATE rewards SET inventory=MAX(0,inventory-1),updated_at=? WHERE id=?').run(now(), claim.reward_id);
    }
    if (nextStatus === 'rejected' && claim.player_id && claim.status !== 'rejected') {
      db.prepare('UPDATE players SET reward_points=reward_points+?,updated_at=? WHERE id=?').run(claim.points_cost, now(), claim.player_id);
    }
    db.prepare('UPDATE reward_claims SET status=?,updated_at=?,resolved_by=? WHERE id=?').run(nextStatus, now(), req.user.id, claim.id);
    return claim;
  });
  let previous;
  try { previous = apply(); } catch (error) { return publicError(res, 409, error.message || 'Request could not be updated.'); }
  audit(req.user.id, 'update', 'reward_claim', req.params.id, nextStatus);
  const item = allClaims({ ...req.user, role: 'co_leader' }).find((claim) => claim.id === req.params.id);
  return res.json({ item, member: previous.player_id ? memberById(previous.player_id) : null });
});

app.get('/api/integrations/discord', requireRole('leader'), (_req, res) => res.json({ item: getIntegration() }));
app.put('/api/integrations/discord', requireRole('leader'), (req, res) => {
  const current = db.prepare(`SELECT * FROM discord_integrations WHERE id='discord'`).get();
  let webhookCipher = current?.webhook_cipher || null;
  if (Object.hasOwn(req.body || {}, 'webhookUrl')) {
    const webhookUrl = String(req.body.webhookUrl || '').trim();
    if (webhookUrl && !isAllowedDiscordWebhook(webhookUrl)) return publicError(res, 400, 'Use a valid HTTPS Discord webhook URL.');
    webhookCipher = webhookUrl ? encryptSecret(webhookUrl) : null;
  }
  const notifications = {
    warReminders: req.body?.notifications?.warReminders !== false,
    cwlLineup: req.body?.notifications?.cwlLineup !== false,
    memberMilestones: req.body?.notifications?.memberMilestones !== false,
    rankedMovement: Boolean(req.body?.notifications?.rankedMovement),
    applicantAlerts: req.body?.notifications?.applicantAlerts !== false,
  };
  const enabled = Boolean(req.body?.enabled) && Boolean(webhookCipher);
  const updatedAt = now();
  db.prepare(`INSERT INTO discord_integrations (id,enabled,guild_id,channel_label,webhook_cipher,notifications_json,updated_at)
    VALUES ('discord',@enabled,@guildId,@channelLabel,@webhookCipher,@notifications,@updatedAt)
    ON CONFLICT(id) DO UPDATE SET enabled=excluded.enabled,guild_id=excluded.guild_id,channel_label=excluded.channel_label,
      webhook_cipher=excluded.webhook_cipher,notifications_json=excluded.notifications_json,updated_at=excluded.updated_at`)
    .run({ enabled: enabled ? 1 : 0, guildId: safeText(req.body?.guildId, 32), channelLabel: safeText(req.body?.channelLabel, 80, 'war-room'), webhookCipher, notifications: JSON.stringify(notifications), updatedAt });
  audit(req.user.id, 'update', 'integration', 'discord', enabled ? 'enabled' : 'settings saved');
  return res.json({ item: getIntegration() });
});
app.post('/api/integrations/discord/test', requireRole('leader'), async (_req, res) => {
  const row = db.prepare(`SELECT webhook_cipher FROM discord_integrations WHERE id='discord'`).get();
  const webhook = decryptSecret(row?.webhook_cipher);
  if (!webhook || !isAllowedDiscordWebhook(webhook)) return publicError(res, 400, 'Add and save a valid Discord webhook before sending a test.');
  try {
    const response = await fetch(webhook, {
      method: 'POST', redirect: 'error', signal: AbortSignal.timeout(5000),
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content: '⚔️ Clan Command connection test succeeded. No clan data was sent.' }),
    });
    if (!response.ok) return publicError(res, 502, `Discord returned ${response.status}. Check the webhook channel and try again.`);
    audit(_req.user.id, 'test', 'integration', 'discord', 'Discord webhook test');
    return res.json({ ok: true, message: 'Test message delivered to Discord.' });
  } catch {
    return publicError(res, 502, 'Discord could not be reached. Check the webhook and try again.');
  }
});
app.post('/api/integrations/discord/dispatch', requireRole('co_leader'), async (req, res) => {
  const kind = enumValue(req.body?.kind, ['applicant','cwl'], null);
  const content = safeText(req.body?.content, 1800);
  if (!kind || content.length < 2) return publicError(res, 400, 'Choose an alert type and provide a message.');
  const notificationKey = kind === 'applicant' ? 'applicantAlerts' : 'cwlLineup';
  const delivered = await dispatchDiscord(notificationKey, content);
  audit(req.user.id, 'dispatch', 'discord', kind, delivered ? 'Message delivered' : 'Message copied locally; Discord is not enabled');
  return res.json({ delivered, message: delivered ? 'Message delivered to Discord.' : 'Discord is not enabled for this workspace. Copy the generated message to share it.' });
});

app.get('/api/supercell/:kind/:tag', async (req, res) => {
  if (!['player','clan'].includes(req.params.kind)) return publicError(res, 400, 'Choose a player or clan lookup.');
  try {
    const result = await supercellLookup(req.params.kind, req.params.tag);
    if (!result.configured) return publicError(res, 503, 'Live Supercell lookup is not configured. Using local demo data.');
    return res.json({ item: result.item });
  } catch (error) {
    console.error('Supercell Lookup Error:', error);
    return publicError(res, Number(error?.status) || 502, error instanceof Error ? error.message : 'Supercell lookup failed.');
  }
});

app.get('/api/users', requireRole('leader'), (_req, res) => {
  const items = db.prepare(`SELECT id,email,display_name AS displayName,role,player_id AS playerId,is_active AS isActive,created_at AS createdAt
    FROM users ORDER BY CASE role WHEN 'leader' THEN 0 WHEN 'co_leader' THEN 1 WHEN 'elder' THEN 2 ELSE 3 END,display_name COLLATE NOCASE`).all()
    .map((user) => ({ ...user, isActive: Boolean(user.isActive) }));
  return res.json({ items });
});
app.post('/api/users', requireRole('leader'), (req, res) => {
  const email = String(req.body?.email || '').trim().toLowerCase();
  const displayName = safeText(req.body?.displayName, 80);
  const password = String(req.body?.password || '');
  const role = validRole(req.body?.role) ? req.body.role : 'member';
  const playerId = req.body?.playerId || null;
  if (!/^\S+@\S+\.\S+$/.test(email) || displayName.length < 2) return publicError(res, 400, 'Add a valid email address and display name.');
  if (password.length < 12) return publicError(res, 400, 'Use a temporary password with at least 12 characters.');
  if (playerId && !memberById(playerId)) return publicError(res, 400, 'Choose a player that exists in this roster.');
  const { salt, hash } = makePassword(password);
  const userId = id();
  const stamp = now();
  try {
    db.prepare(`INSERT INTO users (id,email,display_name,role,player_id,password_salt,password_hash,is_active,created_at,updated_at)
      VALUES (@id,@email,@displayName,@role,@playerId,@salt,@hash,1,@createdAt,@updatedAt)`)
      .run({ id: userId, email, displayName, role, playerId, salt, hash, createdAt: stamp, updatedAt: stamp });
  } catch (error) { return publicError(res, 409, isUniqueError(error) ? 'That email already has an account.' : 'Account could not be created.'); }
  audit(req.user.id, 'create', 'user', userId, email);
  const item = db.prepare(`SELECT id,email,display_name AS displayName,role,player_id AS playerId,is_active AS isActive,created_at AS createdAt FROM users WHERE id=?`).get(userId);
  return res.status(201).json({ item: { ...item, isActive: Boolean(item.isActive) } });
});
app.patch('/api/users/:id', requireRole('leader'), (req, res) => {
  const current = db.prepare('SELECT * FROM users WHERE id=?').get(req.params.id);
  if (!current) return publicError(res, 404, 'Account not found.');
  const role = validRole(req.body?.role) ? req.body.role : current.role;
  const isActive = req.body?.isActive === undefined ? Boolean(current.is_active) : Boolean(req.body.isActive);
  if (current.role === 'leader' && current.is_active && (role !== 'leader' || !isActive)) {
    const leaders = db.prepare(`SELECT COUNT(*) AS count FROM users WHERE role='leader' AND is_active=1`).get().count;
    if (leaders <= 1) return publicError(res, 409, 'Keep at least one active Leader account.');
  }
  const playerId = req.body?.playerId === undefined ? current.player_id : (req.body.playerId || null);
  if (playerId && !memberById(playerId)) return publicError(res, 400, 'Choose a player that exists in this roster.');
  const displayName = safeText(req.body?.displayName, 80, current.display_name);
  const email = req.body?.email === undefined ? current.email : String(req.body.email).trim().toLowerCase();
  if (!/^\S+@\S+\.\S+$/.test(email)) return publicError(res, 400, 'Add a valid email address.');
  let salt = current.password_salt;
  let hash = current.password_hash;
  if (req.body?.password) {
    if (String(req.body.password).length < 12) return publicError(res, 400, 'Use a password with at least 12 characters.');
    ({ salt, hash } = makePassword(String(req.body.password)));
  }
  try {
    db.prepare(`UPDATE users SET email=@email,display_name=@displayName,role=@role,player_id=@playerId,password_salt=@salt,password_hash=@hash,is_active=@isActive,updated_at=@updatedAt WHERE id=@id`)
      .run({ id: current.id, email, displayName, role, playerId, salt, hash, isActive: isActive ? 1 : 0, updatedAt: now() });
  } catch (error) { return publicError(res, 409, isUniqueError(error) ? 'That email already has an account.' : 'Account could not be updated.'); }
  if (!isActive) db.prepare('DELETE FROM sessions WHERE user_id=?').run(current.id);
  audit(req.user.id, 'update', 'user', current.id, email);
  const item = db.prepare(`SELECT id,email,display_name AS displayName,role,player_id AS playerId,is_active AS isActive,created_at AS createdAt FROM users WHERE id=?`).get(current.id);
  return res.json({ item: { ...item, isActive: Boolean(item.isActive) } });
});
app.delete('/api/users/:id', requireRole('leader'), (req, res) => {
  if (req.params.id === req.user.id) return publicError(res, 400, 'You cannot delete the account you are currently using.');
  const current = db.prepare('SELECT id,email,role,is_active AS isActive FROM users WHERE id=?').get(req.params.id);
  if (!current) return publicError(res, 404, 'Account not found.');
  if (current.role === 'leader' && current.isActive) {
    const leaders = db.prepare(`SELECT COUNT(*) AS count FROM users WHERE role='leader' AND is_active=1`).get().count;
    if (leaders <= 1) return publicError(res, 409, 'Keep at least one active Leader account.');
  }
  db.prepare('DELETE FROM users WHERE id=?').run(current.id);
  audit(req.user.id, 'delete', 'user', current.id, current.email);
  return res.json({ ok: true });
});
app.get('/api/audit', requireRole('leader'), (_req, res) => {
  const items = db.prepare(`SELECT a.id,a.action,a.resource,a.entity_id AS entityId,a.detail,a.created_at AS createdAt,u.display_name AS actor
    FROM audit_log a LEFT JOIN users u ON u.id=a.user_id ORDER BY a.created_at DESC LIMIT 100`).all();
  return res.json({ items });
});

app.use('/api', (_req, res) => publicError(res, 404, 'API route not found.'));

function validRole(value) { return ['leader','co_leader','elder','member'].includes(value); }
function isUniqueError(error) { return String(error?.message || '').includes('UNIQUE constraint failed'); }
function safeText(value, max = 300, fallback = '') { return typeof value === 'string' ? value.trim().slice(0, max) : fallback; }
function safeOptionalText(value, max = 120) { return typeof value === 'string' && value.trim() ? value.trim().slice(0, max) : null; }
function safeTag(value, fallback = '') {
  const text = typeof value === 'string' ? value.trim().toUpperCase() : fallback;
  return /^#[0-9A-Z]{3,16}$/.test(text) ? text : fallback;
}
function boundedInt(value, min, max, fallback) {
  const number = Number(value);
  return Number.isFinite(number) ? Math.min(max, Math.max(min, Math.trunc(number))) : fallback;
}
function boundedFloat(value, min, max, fallback) {
  const number = Number(value);
  return Number.isFinite(number) ? Math.min(max, Math.max(min, number)) : fallback;
}
function safeDate(value, fallback) {
  if (typeof value !== 'string' || !value.trim()) return fallback;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? fallback : date.toISOString();
}
function enumValue(value, options, fallback) { return options.includes(value) ? value : fallback; }
function safeHeroLevels(value) {
  const input = value && typeof value === 'object' ? value : {};
  return Object.fromEntries(['king','queen','warden','champion','prince','duke'].map((key) => [key, boundedInt(input[key], 0, 999, 0)]));
}

const sharedPublic = path.resolve(appDir, '../../public');
app.get('/family-crest.png', (_req, res) => res.sendFile(path.join(sharedPublic, 'crest-100.png')));
app.use('/game-assets', express.static(path.join(sharedPublic, 'clash-assets'), { maxAge: '7d', immutable: true, fallthrough: false }));

const server = createServer(app);
if (isProduction) {
  const distDir = path.join(appDir, 'dist');
  app.use(express.static(distDir, { index: false, maxAge: '1h' }));
  app.use((req, res) => {
    if (req.accepts('html')) return res.sendFile(path.join(distDir, 'index.html'));
    return publicError(res, 404, 'Not found.');
  });
} else {
  const vite = await createViteServer({
    configFile: path.join(appDir, 'vite.config.ts'),
    server: { middlewareMode: true, hmr: { server }, allowedHosts: true },
    appType: 'spa',
  });
  app.use(vite.middlewares);
}

server.listen(port, '0.0.0.0', () => {
  console.info(`Clan Command listening on 0.0.0.0:${port} (${isProduction ? 'production' : 'development'})`);
  if (!demoMode && !process.env.CLANCMD_APP_SECRET) console.warn('CLANCMD_APP_SECRET is unset: a local key file will encrypt Discord webhooks.');
});
