import { createHash } from 'node:crypto';
import { db, makePassword, nowIso, cryptoId, runTransaction } from './database.mjs';

const DEMO_ROLES = [
  { role: 'leader', email: 'leader@clan.demo', displayName: 'Rook Thirteen', playerIndex: 0 },
  { role: 'co_leader', email: 'coleader@clan.demo', displayName: 'Ember Saint', playerIndex: 1 },
  { role: 'elder', email: 'elder@clan.demo', displayName: 'Lumen Arrow', playerIndex: 2 },
  { role: 'member', email: 'member@clan.demo', displayName: 'Iron Warden', playerIndex: 3 },
];

const CLANS = [
  { name: 'Misclicked Main', shortName: 'MAIN', tag: '#2Q0P2YLRG', clanLevel: 27, league: 'Champion II', trophies: 48_620, warWinStreak: 8, description: 'The flagship war roster. Calm calls, clean hits, no missed stars.' },
  { name: 'Misclicked Feeder', shortName: 'FEEDER', tag: '#8Y2Q0P9LV', clanLevel: 22, league: 'Master I', trophies: 39_240, warWinStreak: 3, description: 'A disciplined second home for builders, grinders and dependable attackers.' },
  { name: 'Misclicked Academy', shortName: 'ACADEMY', tag: '#YJ2P8Q0RC', clanLevel: 19, league: 'Crystal I', trophies: 31_870, warWinStreak: 5, description: 'The proving ground. Grow your base, learn your hits, earn your place.' },
];

const CORE_PLAYER_SEED = [
  ['RookThirteen',0,'leader',17,5580,'Legend League','Legend',5940,94,0,25,2.7],
  ['EmberSaint',0,'co_leader',17,5362,'Legend League','Legend',5780,91,0,24,2.1],
  ['LumenArrow',0,'elder',16,5010,'Titan I','Champion',4980,88,0,21,1.8],
  ['IronWarden',0,'member',16,4932,'Titan I','Champion',4820,82,0,20,2.4],
  ['RuneRunner',0,'member',15,4714,'Titan II','Titan',4420,76,1,18,1.7],
  ['MoonCircuit',0,'member',15,4568,'Titan II','Titan',4310,89,0,23,3.2],
  ['NovaBell',0,'member',14,4224,'Titan III','Titan',4050,71,1,17,1.2],
  ['BirchKnight',0,'elder',14,4108,'Titan III','Titan',3980,86,0,22,1.9],
  ['FrostSignal',1,'leader',17,5196,'Legend League','Legend',5620,92,0,24,2.5],
  ['WinterHex',1,'co_leader',16,4864,'Titan I','Champion',4790,83,0,21,1.6],
  ['SnowVandal',1,'elder',16,4740,'Titan II','Titan',4510,77,1,16,1.1],
  ['BirchShade',1,'member',15,4602,'Titan II','Titan',4380,80,0,19,1.4],
  ['GlacialFox',1,'member',15,4488,'Titan III','Titan',4180,68,2,13,0.9],
  ['EchoRider',1,'member',14,4196,'Titan III','Titan',4020,74,1,17,2.2],
  ['CobaltKite',1,'member',14,4054,'Titan III','Titan',3900,90,0,22,2.0],
  ['PineShield',1,'member',13,3820,'Champion III','Champion',3580,65,2,12,0.8],
  ['GoblinMarshal',2,'leader',16,4672,'Titan II','Titan',4480,85,0,20,2.9],
  ['AlloyGoblin',2,'co_leader',15,4410,'Titan III','Titan',4190,81,0,19,2.4],
  ['CoinFlipKing',2,'elder',15,4324,'Titan III','Titan',4060,73,1,16,1.5],
  ['EchoTunnel',2,'member',14,4082,'Champion I','Champion',3910,78,0,18,1.3],
  ['LanternCave',2,'member',14,3950,'Champion II','Champion',3760,87,0,22,2.6],
  ['StoneSneak',2,'member',13,3728,'Champion II','Champion',3510,62,2,11,0.7],
  ['MintyMole',2,'member',13,3640,'Champion III','Champion',3420,75,1,15,1.8],
  ['PocketGiant',2,'member',12,3388,'Master I','Master',3180,69,1,14,1.1],
];
const EXTRA_NAME_PREFIXES = ['Ash','Amber','Astra','Boulder','Cipher','Cinder','Copper','Crimson','Dusk','Fable','Frost','Glacier','Glyph','Harbor','Hex','Ivory','Jade','Kestrel','Lunar','Moss','Mythic','Night','Oaken','Onyx','Quartz','Raven','Rift','Sable','Solar','Storm','Thorn','Topaz','Violet','Wild','Zephyr'];
const EXTRA_NAME_SUFFIXES = ['Bastion','Circuit','Falcon','Keeper','Mender','Nomad','Orchid','Pioneer','Ranger','Signal','Sparrow','Vandal','Voyager'];
const EXTRA_LEAGUES = ['Gold I','Crystal II','Master III','Champion II','Titan I','Titan III','Legend League'];
const EXTRA_RANKED_TIERS = ['Silver','Gold','Crystal','Master','Champion','Legend'];
const GENERATED_PLAYER_SEED = Array.from({ length: 46 }, (_, offset) => {
  const clanIndex = offset < 11 ? 0 : offset < 36 ? 1 : 2;
  const townHall = 10 + (offset * 5 % 9);
  const missed = offset % 9 === 0 ? 2 : offset % 4 === 0 ? 1 : 0;
  const name = `${EXTRA_NAME_PREFIXES[Math.floor(offset / EXTRA_NAME_SUFFIXES.length)]}${EXTRA_NAME_SUFFIXES[offset % EXTRA_NAME_SUFFIXES.length]}`;
  return [name, clanIndex, offset % 11 === 0 ? 'elder' : 'member', townHall, 1840 + (offset * 277 % 4100),
    EXTRA_LEAGUES[offset % EXTRA_LEAGUES.length], EXTRA_RANKED_TIERS[offset % EXTRA_RANKED_TIERS.length], 850 + (offset * 173 % 6200),
    58 + (offset * 7 % 41), missed, 10 + (offset * 5 % 30), Math.round((0.7 + (offset % 20) / 10) * 10) / 10];
});
const PLAYER_SEED = [...CORE_PLAYER_SEED, ...GENERATED_PLAYER_SEED];

const alphabet = '0289PYLQGRJCUV';
function tagFrom(value, length = 9) {
  const digest = createHash('sha256').update(value).digest();
  return `#${Array.from({ length }, (_, index) => alphabet[digest[index] % alphabet.length]).join('')}`;
}
function ago(hours) { return new Date(Date.now() - hours * 3_600_000).toISOString(); }
function ahead(hours) { return new Date(Date.now() + hours * 3_600_000).toISOString(); }
function aroundTownHall(townHall, seed) {
  const max = Math.max(20, townHall * 5 - 4);
  const level = (offset) => Math.max(8, Math.min(max, max - ((seed + offset) % 11)));
  return { king: level(0), queen: level(2), warden: level(4), champion: Math.max(4, Math.min(max - 8, max - ((seed + 6) % 15))), prince: level(8), duke: Math.max(2, Math.min(max - 14, max - ((seed + 10) % 17))) };
}

function createDemoData() {
  const stamp = nowIso();
  const clanInsert = db.prepare(`INSERT INTO clans (id,name,tag,short_name,clan_level,league,trophies,war_win_streak,description,created_at,updated_at)
    VALUES (@id,@name,@tag,@shortName,@clanLevel,@league,@trophies,@warWinStreak,@description,@createdAt,@updatedAt)`);
  const clanIds = CLANS.map((clan, index) => {
    const id = cryptoId();
    clanInsert.run({ id, ...clan, createdAt: ago(24 * (90 + index * 14)), updatedAt: stamp });
    return id;
  });

  const playerInsert = db.prepare(`INSERT INTO players (
    id,tag,name,person_id,account_type,builder_hall,xp_level,best_trophies,builder_base_trophies,builder_base_league,war_stars,
    war_entries_90d,war_attacks_90d,war_missed_90d,average_stars_90d,average_destruction_90d,left_at,return_count,clan_id,role,town_hall,
    trophies,league,ranked_tier,ranked_points,reward_points,hero_readiness,hero_levels_json,war_opt_in,cwl_opt_in,missed_attacks_30d,war_attacks_30d,
    donation_ratio,last_active_at,joined_at,base_link,is_active,bio,created_at,updated_at
  ) VALUES (
    @id,@tag,@name,@personId,@accountType,@builderHall,@xpLevel,@bestTrophies,@builderBaseTrophies,@builderBaseLeague,@warStars,
    @warEntries90d,@warAttacks90d,@warMissed90d,@averageStars90d,@averageDestruction90d,@leftAt,@returnCount,@clanId,@role,@townHall,
    @trophies,@league,@rankedTier,@rankedPoints,@rewardPoints,@heroReadiness,@heroLevels,@warOptIn,@cwlOptIn,@missedAttacks30d,@warAttacks30d,
    @donationRatio,@lastActiveAt,@joinedAt,@baseLink,@isActive,@bio,@createdAt,@updatedAt
  )`);
  const formerIndexes = new Set([40, 54, 68]);
  const playerRows = PLAYER_SEED.map((person, index) => {
    const [name, clanIndex, role, townHall, trophies, league, rankedTier, rankedPoints, heroReadiness, missedAttacks30d, warAttacks30d, donationRatio] = person;
    const isFormer = formerIndexes.has(index);
    const id = cryptoId();
    const tag = tagFrom(`clan-command-demo-player-${index}-${name}`);
    playerInsert.run({
      id, tag, name, personId: `demo-person-${Math.floor(index / 2) + 1}`, accountType: index % 2 ? 'Alt' : 'Main',
      builderHall: townHall >= 10 ? 10 : Math.max(1, Math.ceil(townHall / 2)), xpLevel: townHall * 10 + 25 + (index * 3 % 60),
      bestTrophies: Math.max(trophies, 3200 + index * 47), builderBaseTrophies: 850 + (index * 173 % 4200),
      builderBaseLeague: ['Copper League II','Iron League I','Steel League III','Platinum League I','Titanium League II'][index % 5],
      warStars: 175 + index * 83, warEntries90d: 8 + (index * 3 % 17), warAttacks90d: 15 + (index * 7 % 38),
      warMissed90d: missedAttacks30d + index % 2, averageStars90d: Math.round((2.1 + (index % 9) * 0.1) * 100) / 100,
      averageDestruction90d: 72 + (index * 7 % 28), leftAt: isFormer ? ago(24 * (12 + index % 20)) : null, returnCount: index % 8 === 0 ? 1 : 0,
      clanId: clanIds[clanIndex], role, townHall, trophies, league, rankedTier, rankedPoints,
      rewardPoints: 55 + ((index * 37) % 440), heroReadiness, heroLevels: JSON.stringify(aroundTownHall(townHall, index)),

      warOptIn: index % 6 === 4 ? 0 : 1, cwlOptIn: index % 7 === 6 ? 0 : 1,
      missedAttacks30d, warAttacks30d, donationRatio,
      lastActiveAt: ago((index * 5) % 38), joinedAt: ago(24 * (45 + index * 9)),
      baseLink: `https://link.clashofclans.com/en?action=OpenPlayerProfile&tag=${encodeURIComponent(tag)}`,
      bio: ['Three-star specialist and calm war caller.', 'Working toward max heroes this season.', 'Always up for friendly challenges.', 'Focused on clean attacks and steady upgrades.'][index % 4],
      isActive: isFormer ? 0 : 1,
      createdAt: ago(24 * (45 + index * 9)), updatedAt: stamp,
    });
    return { id, tag, name, clanId: clanIds[clanIndex], role, townHall, index, isFormer };
  });

  const userInsert = db.prepare(`INSERT INTO users (id,email,display_name,role,player_id,password_salt,password_hash,is_active,created_at,updated_at)
    VALUES (@id,@email,@displayName,@role,@playerId,@salt,@hash,1,@createdAt,@updatedAt)`);
  const password = process.env.CLANCMD_DEMO_PASSWORD || 'Clash2026!';
  for (const demo of DEMO_ROLES) {
    const player = playerRows[demo.playerIndex];
    const { salt, hash } = makePassword(password);
    userInsert.run({ id: cryptoId(), email: demo.email, displayName: demo.displayName, role: demo.role, playerId: player.id, salt, hash, createdAt: stamp, updatedAt: stamp });
  }

  const warInsert = db.prepare(`INSERT INTO wars (id,clan_id,opponent,opponent_tag,war_type,state,start_at,end_at,result,stars,opponent_stars,destruction,opponent_destruction,war_size,attacks_used,notes,created_at,updated_at)
    VALUES (@id,@clanId,@opponent,@opponentTag,@warType,@state,@startAt,@endAt,@result,@stars,@opponentStars,@destruction,@opponentDestruction,@warSize,@attacksUsed,@notes,@createdAt,@updatedAt)`);
  const wars = [
    { clan: 0, opponent: 'Nightfall Empire', type: 'regular', state: 'in_war', start: -13, end: 11, result: 'pending', stars: 61, opponentStars: 57, destruction: 94.8, opponentDestruction: 91.2, size: 30, attacks: 46, notes: 'Battle day is live. 14 attacks still on the board.' },
    { clan: 1, opponent: 'Royal Phoenix', type: 'cwl', state: 'preparation', start: 18, end: 42, result: 'pending', stars: 0, opponentStars: 0, destruction: 0, opponentDestruction: 0, size: 15, attacks: 0, notes: 'Lineup lock in 18 hours.' },
    { clan: 2, opponent: 'Obsidian Guard', type: 'regular', state: 'complete', start: -55, end: -31, result: 'win', stars: 58, opponentStars: 54, destruction: 96.1, opponentDestruction: 89.4, size: 30, attacks: 59, notes: 'Five-star margin. Clean cleanup calls.' },
    { clan: 0, opponent: 'Crimson Citadel', type: 'cwl', state: 'complete', start: -102, end: -78, result: 'win', stars: 43, opponentStars: 40, destruction: 96.7, opponentDestruction: 93.8, size: 15, attacks: 29, notes: 'A strong finish secured the round.' },
    { clan: 1, opponent: 'Cloudbreakers', type: 'regular', state: 'complete', start: -150, end: -126, result: 'loss', stars: 51, opponentStars: 55, destruction: 88.2, opponentDestruction: 91.7, size: 30, attacks: 55, notes: 'Review missed attacks before the next war.' },
    { clan: 2, opponent: 'Silver Wyverns', type: 'friendly', state: 'complete', start: -214, end: -190, result: 'draw', stars: 38, opponentStars: 38, destruction: 93.4, opponentDestruction: 94.1, size: 15, attacks: 29, notes: 'Practice war: dragon and root-rider entries.' },
  ];
  const warIds = wars.map((war, index) => {
    const id = cryptoId();
    warInsert.run({
      id, clanId: clanIds[war.clan], opponent: war.opponent, opponentTag: tagFrom(`demo-opponent-${index}`, 9),
      warType: war.type, state: war.state, startAt: war.start < 0 ? ago(-war.start) : ahead(war.start),
      endAt: war.end < 0 ? ago(-war.end) : ahead(war.end), result: war.result,
      stars: war.stars, opponentStars: war.opponentStars, destruction: war.destruction,
      opponentDestruction: war.opponentDestruction, warSize: war.size, attacksUsed: war.attacks,
      notes: war.notes, createdAt: war.start < 0 ? ago(-war.start) : stamp, updatedAt: stamp,
    });
    return id;
  });
  const participantInsert = db.prepare(`INSERT INTO war_participants (id,war_id,player_id,player_name,player_tag,attacks_used,stars,destruction) VALUES (?,?,?,?,?,?,?,?)`);
  for (const [warIndex, war] of wars.entries()) {
    const roster = playerRows.filter((player) => player.clanId === clanIds[war.clan]).slice(0, Math.min(8, war.size));
    roster.forEach((player, index) => participantInsert.run(
      cryptoId(), warIds[warIndex], player.id, player.name, player.tag,
      war.state === 'preparation' ? 0 : index === 6 ? 0 : 1,
      war.state === 'preparation' ? 0 : (index * 2 + warIndex) % 4,
      war.state === 'preparation' ? 0 : 64 + ((index * 9 + warIndex * 5) % 37),
    ));
  }

  const historyInsert = db.prepare(`INSERT INTO progression_events (id,player_id,player_name,player_tag,clan_name,event_type,title,details,from_value,to_value,created_by,created_at)
    VALUES (@id,@playerId,@playerName,@playerTag,@clanName,@eventType,@title,@details,@fromValue,@toValue,NULL,@createdAt)`);
  const history = [
    [0,'town_hall','Town Hall upgraded','A new village tier unlocked. Builder queue is ready for the next push.','TH16','TH17',3],
    [1,'ranked_promotion','Ranked promotion','Pushed into the Legend tier after a perfect final session.','Champion I','Legend',8],
    [2,'hero_upgrade','Hero upgrade','Archer Queen reached a new level.','89','90',13],
    [4,'war_milestone','War milestone','Ten consecutive wars with every attack used.','8/10','10/10',22],
    [7,'role_change','Promoted to Elder','Recognized for helpful calls and consistent donations.','Member','Elder',31],
    [8,'ranked_promotion','Ranked promotion','A clean week of attacks moved this base into Legend.','Champion I','Legend',39],
    [11,'league_change','Season league climbed','Trophy push secured a new home-village league.','Titan III','Titan II',49],
    [17,'hero_upgrade','Warden upgrade complete','Grand Warden upgrade finished before war day.','56','57',61],
    [20,'war_milestone','First three-star in war','A confident hit earned the Foundry its cleanup bonus.','0','1',72],
    [23,'note','Recovery plan started','Leadership set a 30-day hero and attack consistency goal.','','',88],
  ];
  for (const [playerIndex, eventType, title, details, fromValue, toValue, ageHours] of history) {
    const player = playerRows[playerIndex];
    const clan = CLANS[PLAYER_SEED[playerIndex][1]];
    historyInsert.run({ id: cryptoId(), playerId: player.id, playerName: player.name, playerTag: player.tag, clanName: clan.name, eventType, title, details, fromValue, toValue, createdAt: ago(ageHours) });
  }
  for (const playerIndex of formerIndexes) {
    const player = playerRows[playerIndex];
    const clan = CLANS[PLAYER_SEED[playerIndex][1]];
    historyInsert.run({ id: cryptoId(), playerId: player.id, playerName: player.name, playerTag: player.tag, clanName: clan.name, eventType: 'roster_departure', title: 'Left the family roster', details: `${player.name} was archived as a former family member.`, fromValue: clan.name, toValue: 'Former member', createdAt: ago(24 * (12 + playerIndex % 20)) });
  }
  const formerNameChange = playerRows[40];
  historyInsert.run({ id: cryptoId(), playerId: formerNameChange.id, playerName: formerNameChange.name, playerTag: formerNameChange.tag, clanName: CLANS[PLAYER_SEED[40][1]].name, eventType: 'name_change', title: 'Player name changed', details: 'The account name was updated after the member left.', fromValue: 'AshSignal', toValue: formerNameChange.name, createdAt: ago(24 * 6) });
  historyInsert.run({ id: cryptoId(), playerId: formerNameChange.id, playerName: formerNameChange.name, playerTag: formerNameChange.tag, clanName: CLANS[PLAYER_SEED[40][1]].name, eventType: 'town_hall', title: 'Town Hall progressed after departure', details: 'The player continued upgrading their village while away from the family.', fromValue: 'TH17', toValue: 'TH18', createdAt: ago(24 * 4) });

  const alertInsert = db.prepare(`INSERT INTO alerts (id,clan_id,clan_name,player_id,player_name,player_tag,title,details,category,severity,status,created_by,created_at,resolved_at)
    VALUES (@id,@clanId,@clanName,@playerId,@playerName,@playerTag,@title,@details,@category,@severity,@status,NULL,@createdAt,NULL)`);
  const alertSeed = [
    [0,'war','critical','2 attacks still open','Ironclad has two unspent hits with 11 hours left in battle day.','open',1],
    [4,'cwl','warning','CWL opt-in needed','Confirm availability before the lineup locks.','open',5],
    [12,'progression','warning','Hero readiness below target','Queen and Warden levels are behind the clan TH16 target.','acknowledged',12],
    [21,'war','warning','Attack reliability review','Two missed attacks were recorded over the last 30 days.','open',19],
    [19,'rewards','info','Reward claim awaiting review','A season reward claim is waiting in the queue.','open',26],
    [8,'roster','info','Lineup candidate added','Strong ranked form makes this base a likely CWL selection.','resolved',43],
    [6,'system','info','New player joined','NovaBell linked a new home village to the Foundry.','resolved',56],
  ];
  for (const [playerIndex, category, severity, title, details, status, ageHours] of alertSeed) {
    const player = playerRows[playerIndex];
    const clan = CLANS[PLAYER_SEED[playerIndex][1]];
    alertInsert.run({ id: cryptoId(), clanId: player.clanId, clanName: clan.name, playerId: player.id, playerName: player.name, playerTag: player.tag, title, details, category, severity, status, createdAt: ago(ageHours) });
  }

  const rewardInsert = db.prepare(`INSERT INTO rewards (id,name,description,category,points_cost,inventory,is_active,created_at,updated_at) VALUES (?,?,?,?,?,?,1,?,?)`);
  const rewards = [
    ['Gold Pass','One Gold Pass for the next season.','Season prize',1200,2],
    ['CWL Bonus Chest','Leadership-selected bonus for a standout CWL week.','War performance',700,8],
    ['Training Potion Pack','Three training potions for your next push.','Magic items',450,12],
    ['Clan Champion Badge','A profile badge for this season’s top contributor.','Recognition',300,25],
    ['Builder Potion','One builder potion for the village upgrade queue.','Magic items',380,9],
  ];
  const rewardRows = rewards.map(([name, description, category, cost, inventory]) => {
    const id = cryptoId();
    rewardInsert.run(id, name, description, category, cost, inventory, ago(24 * 15), stamp);
    return { id, name, cost };
  });

  const claimInsert = db.prepare(`INSERT INTO reward_claims (id,player_id,player_name,player_tag,reward_id,reward_name,points_cost,status,requested_at,updated_at,resolved_by)
    VALUES (?,?,?,?,?,?,?,?,?,?,NULL)`);
  const claimSeed = [
    [19, 2, 'pending', 5],
    [1, 1, 'approved', 18],
    [7, 3, 'fulfilled', 32],
    [22, 4, 'pending', 45],
  ];
  for (const [playerIndex, rewardIndex, status, ageHours] of claimSeed) {
    const player = playerRows[playerIndex];
    const reward = rewardRows[rewardIndex];
    claimInsert.run(cryptoId(), player.id, player.name, player.tag, reward.id, reward.name, reward.cost, status, ago(ageHours), ago(Math.max(1, ageHours - 3)));
  }

  db.prepare(`INSERT INTO discord_integrations (id,enabled,guild_id,channel_label,webhook_cipher,notifications_json,updated_at)
    VALUES ('discord',0,'','war-room',NULL,?,?)`)
    .run(JSON.stringify({ warReminders: true, cwlLineup: true, memberMilestones: true, rankedMovement: false, applicantAlerts: true }), stamp);
}

function createBootstrapLeader() {
  const email = process.env.CLANCMD_ADMIN_EMAIL?.trim();
  const password = process.env.CLANCMD_ADMIN_PASSWORD;
  if (!email || !password) return;
  if (password.length < 12) throw new Error('CLANCMD_ADMIN_PASSWORD must contain at least 12 characters.');
  const { salt, hash } = makePassword(password);
  const stamp = nowIso();
  db.prepare(`INSERT INTO users (id,email,display_name,role,player_id,password_salt,password_hash,is_active,created_at,updated_at)
    VALUES (@id,@email,@displayName,'leader',NULL,@salt,@hash,1,@createdAt,@updatedAt)`)
    .run({ id: cryptoId(), email, displayName: email.split('@')[0], salt, hash, createdAt: stamp, updatedAt: stamp });
}

export function seedIfEmpty(demoMode) {
  const counts = db.prepare(`SELECT
      (SELECT COUNT(*) FROM clans) AS clans,
      (SELECT COUNT(*) FROM players) AS players,
      (SELECT COUNT(*) FROM users) AS users`).get();
  if (counts.clans > 0 || counts.players > 0 || counts.users > 0) return { seeded: false, demoMode };

  if (demoMode) {
    runTransaction(createDemoData);
    console.info('Clan Command: created fictional demo records in the new local SQLite database.');
    return { seeded: true, demoMode: true };
  }

  createBootstrapLeader();
  return { seeded: false, demoMode: false };
}

export function getDemoRoles() {
  return DEMO_ROLES.map(({ role, email, displayName }) => ({ role, email, displayName }));
}
