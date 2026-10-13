import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';

/**
 * Localisation for the dark tracker.
 *
 * The unit of translation is the **English source string**, not an opaque key:
 *
 *   <span>{t('Remaining')}</span>
 *
 * Three consequences worth knowing:
 *
 * 1. A string with no Afrikaans entry renders its English source instead of a
 *    bare key or a blank, so a missed translation degrades gracefully.
 * 2. Clash of Clans game vocabulary is deliberately absent from `AF` below.
 *    `Clan`, `Heroes`, `Wars`, `Home Village`, `Builder Base`, `Laboratory`,
 *    `Equipment`, `Pets`, `Traps`, `Supercharge`, `Walls`, `Guardians`,
 *    `Builders`, `Pass`, `Trophies`, `Stars`, `Destruction`, `Attack` and every
 *    asset name (P.E.K.K.A, Inferno Tower, Barbarian King, Town Hall …) stay
 *    verbatim in both languages, which is what the game itself shows.
 * 3. English stays fully supported: the switch in Settings flips `lang` back to
 *    `'en'` and `t()` becomes the identity function.
 *
 * `{0}`, `{1}` … inside a source string are substituted positionally, so word
 * order can change between languages without touching the call site.
 */

export type Lang = 'af' | 'en';

const STORAGE_KEY = 'clash-command:lang:v1';

export const AF: Record<string, string> = {
  // ---- shell / navigation ----
  'Home': 'Tuis',
  'Profile': 'Profiel',
  'Clan family': 'Clan-familie',
  'War & CWL': 'War & CWL',
  'Go back': 'Gaan terug',
  'Share': 'Deel',
  'Settings': 'Instellings',
  'Options': 'Opsies',
  'About this screen': 'Oor hierdie skerm',
  'Select view': 'Kies aansig',
  'Close': 'Maak toe',
  'Dismiss': 'Maak toe',
  'Done': 'Klaar',
  'Cancel': 'Kanselleer',
  'Import': 'Voer in',
  'Primary': 'Primêr',
  'Language': 'Taal',
  'Afrikaans': 'Afrikaans',
  'English': 'English',
  'Interface language': 'Koppelvlaktaal',
  'Game terms stay in English, as the game shows them.':
    'Spelterme bly in Engels, soos die spel hulle wys.',
  'Updated at': 'Opgedateer om',
  'Updated at {0}': 'Opgedateer om {0}',
  'Viewing': 'Besig om te kyk',
  'Misclicked Family': 'Misclicked-familie',

  // ---- home ----
  'Progression snapshot': 'Vorderingsmomentopname',
  'Sync live': 'Sink direk',
  'Syncing…': 'Sink tans…',
  'Sync now': 'Sink nou',
  'Calendar': 'Kalender',
  'Plan': 'Plan',
  'No group yet': 'Nog geen groep nie',
  'Closest categories to a gold pill.': 'Kategorieë naaste aan ’n goue pill.',
  'War Day · vs {0}': 'War-dag · teen {0}',
  'Preparation day': 'Voorbereidingsdag',
  'War Day': 'War-dag',
  'Preparation': 'Voorbereiding',
  'Attacks': 'Aanvalle',
  'Attack': 'Aanval',
  'War stars': 'War-sterre',
  'War stars (season)': 'War-sterre (seisoen)',
  'Donated': 'Geskenk',
  'Received': 'Ontvang',
  'Connected — profiles and stored tags persist server-side.':
    'Gekoppel — profiele en gestoorde tags bly op die bediener.',

  // ---- progression ----
  'Upgrade tracker': 'Opgraderingspoorsnyer',
  'Category completion': 'Kategorievoltooiing',
  'Tap a category to adjust levels or push it into the plan.':
    'Tik op ’n kategorie om vlakke te verstel of dit in die plan te stoot.',
  'Fully maxed': 'Vollangs maks',
  'Maxed': 'Maks',
  'Remaining': 'Oorblewend',
  'Next': 'Volgende',
  'Live': 'Direk',
  'Demo data': 'Demonstrasiedata',
  'Best': 'Beste',
  'Level': 'Vlak',
  'Levels': 'Vlakke',
  'Lvl {0}': 'Vlk {0}',
  'Level {0}': 'Vlak {0}',
  'Total segments': 'Totale segmente',
  'segments': 'segmente',
  'War machines': 'Oorlogsmasjiene',
  'Hero pets': 'Hero pets',
  'Epic equipment': 'Epiese toerusting',
  'Not charged': 'Nie gelaai nie',
  'Charged': 'Gelaai',
  'Levels gate every attack composition.': 'Vlakke bepaal elke aanvalsamestelling.',
  'Wall segments at level {0}': 'Muursegmente op vlak {0}',
  'segments to level {0}': 'segmente tot vlak {0}',
  'to level {0}': 'tot vlak {0}',
  '{0} to level {1}': '{0} tot vlak {1}',
  'Charge a defence this season': 'Laai ’n verdediging hierdie seisoen',
  'Gold = 100% for Town Hall 17.': 'Goud = 100% vir Town Hall 17.',
  'Royal blue = still upgrading.': 'Koningsblou = word steeds opgegradeer.',
  'Green = home team.': 'Groen = tuisspan.',
  'Search upgrades': 'Soek opgraderings',
  'Search upgrades…': 'Soek opgraderings…',
  'Nothing to upgrade here yet.': 'Niks om hier op te gradeer nie.',

  // ---- plan ----
  'Upgrade plan': 'Opgraderingsplan',
  'Queue': 'Tou',
  'Nothing planned yet': 'Niks nog beplan nie',
  'Add an upgrade': 'Voeg ’n opgradering by',
  'Queue position {0}': 'Touposisie {0}',
  'Search the catalog': 'Soek die katalogus',
  'Search the catalog…': 'Soek die katalogus…',
  'Sorted by priority, then longest upgrade first.':
    'Gerangskik volgens prioriteit, dan die langste opgradering eerste.',
  'Only items below their Town Hall 17 cap are listed.':
    'Slegs items onder hul Town Hall 17-perk word gelys.',
  'Import JSON payload': 'Voer JSON-lading in',
  'Paste a clash-command export or your own progression payload.':
    'Plak ’n clash-command-uitvoer of jou eige vorderingslading.',
  'JSON payload': 'JSON-lading',
  'Dark elixir': 'Donker elixir',
  'Priority': 'Prioriteit',
  'Cost': 'Koste',
  'Duration': 'Duur',
  'Add to plan': 'Voeg by plan',
  'Remove': 'Verwyder',
  'Remove from plan': 'Verwyder uit plan',

  // ---- calendar / gantt ----
  'Builder schedule': 'Bouerskedule',
  'Scheduled upgrades': 'Geskeduleerde opgraderings',
  'Active slots': 'Aktiewe slots',
  'Queued': 'In tou',
  'Total time': 'Totale tyd',
  'Move': 'Skuif',
  'Slot': 'Slot',
  'Slot {0}': 'Slot {0}',
  'Window': 'Venster',
  'Earlier dates': 'Vroeër datums',
  'Later dates': 'Later datums',
  'Ordered by slot, then start date.': 'Gerangskik volgens slot, dan begindatum.',
  'Builder': 'Builder',
  'Builders': 'Builders',
  'No upgrades scheduled.': 'Geen opgraderings geskeduleer nie.',

  // ---- war & cwl ----
  'State of the war': 'Status van die War',
  'Attacks used': 'Aanvalle gebruik',
  'Avg stars': 'Gem. sterre',
  'Max possible': 'Maks moontlik',
  'Attack feed': 'Aanvalsvoer',
  'CWL group standings': 'CWL-groepstand',
  'War history': 'War-geskiedenis',
  'Wins': 'Oorwinnings',
  'Losses': 'Nederlae',
  'Ties': 'Gelykop',
  'Group rank': 'Groep-rang',
  'War size': 'War-grootte',
  'Destruction': 'Vernietiging',
  'Destruction rate': 'Destruction rate',
  'Current group · ranks #1–#8': 'Huidige groep · range #1–#8',
  'Current period': 'Huidige periode',
  'Your clan': 'Jou Clan',
  'Opponent': 'Teenstander',
  'No attack feed yet.': 'Nog geen aanvalsvoer nie.',
  'Detailed battle logs are not available for this period.':
    'Gedetailleerde geveglogboeke is nie beskikbaar vir hierdie periode nie.',
  'Cannot be mathematically secured from this position.':
    'Kan nie wiskundig verseker word vanuit hierdie posisie nie.',
  'Cannot be mathematically secured…': 'Kan nie wiskundig verseker word nie…',
  'Result': 'Resultaat',
  'Stars': 'Stars',
  'Win': 'Wen',
  'Loss': 'Verlies',
  'Tie': 'Gelykop',
  'Round {0}': 'Rondte {0}',

  // ---- clan ----
  'Roster': 'Roster',
  'War readiness': 'War-gereedheid',
  'You': 'Jy',
  'Last seen': 'Laas gesien',
  'Active': 'Aktief',
  'Points': 'Punte',
  'Versus': 'Versus',
  'War wins': 'War-wenners',
  'War wins (clan)': 'War-wenne (Clan)',
  'Streak': 'Reeks',
  'Avg TH': 'Gem. TH',
  'Search name or #TAG…': 'Soek naam of #TAG…',
  'Search roster': 'Soek roster',
  'Search accounts': 'Soek rekeninge',
  'No members match': 'Geen lede pas nie',
  'Clear the search or turn off the war opted-in filter.':
    'Maak die soektog skoon of skakel die war-ingeskryf-filter af.',
  'Scout a tag': 'Verken ’n tag',
  'Player or clan tag': 'Speler- of clan-tag',
  'Rush est.': 'Rush-bepaling',
  'Lab purity': 'Lab-suiwerheid',
  'No match': 'Geen resultaat',
  'Town Hall': 'Town Hall',
  'War in': 'War in',
  'War out': 'War uit',
  'Switch the clan this workspace is tracking.': 'Wissel die Clan wat hierdie werkruimte dophou.',
  'Enter a player or clan tag.': 'Voer ’n speler- of clan-tag in.',
  'Public search is unavailable.': 'Openbare soektog is nie beskikbaar nie.',
  'Public player and clan lookup — no sign-in needed.':
    'Openbare speler- en clan-soektog — geen aanmelding nodig nie.',
  'Rush, lab and war figures are demo estimates, not live game data.':
    'Rush-, lab- en war-syfers is demonstrasieberamings, nie direkte speldata nie.',
  'Figures from the stored game profile.': 'Syfers uit die gestoorde spelprofiel.',
  'Check the tag and try again. Search takes a player #PLAYERTAG or a clan #CLANTAG.':
    'Kontroleer die tag en probeer weer. Soektog aanvaar ’n speler #PLAYERTAG of ’n clan #CLANTAG.',
  '{0} clans in family': '{0} Clans in familie',
  'Searching…': 'Soek tans…',
  'Members': 'Lede',
  'Required for war': 'Benodig vir War',
  'Opted in': 'Ingeskryf',
  'Opted out': 'Uitgeskryf',
  'War opted-in only': 'Slegs war-ingeskryf',

  // ---- collection ----
  'Search every asset': 'Soek elke bate',
  'Search every asset…': 'Soek elke bate…',
  'Clear search': 'Maak soektog skoon',
  'No assets match': 'Geen bates pas nie',
  'Try a different search term, or switch the filter back to Everything.':
    'Probeer ’n ander soekterm, of skuif die filter terug na Alles.',
  'Everything': 'Alles',
  'assets': 'bates',

  // ---- settings / info / data ----
  'Linked player tags': 'Gekoppelde speler-tags',
  'Verified with the in-game API token.': 'Geverifieer met die in-game API token.',
  'Verified': 'Geverifieer',
  'Unverified': 'Ongeverifieer',
  'Verify': 'Verifieer',
  'Link another village': 'Koppel nog ’n village',
  'Link village': 'Koppel village',
  'Player tag': 'Speler-tag',
  'Label': 'Etiket',
  'Label (Main, War alt…)': 'Etiket (Main, War alt…)',
  'In-game API token': 'In-game API token',
  'Enter a valid Supercell tag, e.g. #2YL8V0JQ.': 'Voer ’n geldige Supercell-tag in, bv. #2YL8V0JQ.',
  '{0} linked. Run Verify to check ownership.': '{0} gekoppel. Druk Verifieer om eienaarskap te kontroleer.',
  'Only a fingerprint of the token is stored locally — never the token itself.':
    'Slegs ’n vingerafdruk van die token word plaaslik gestoor — nooit die token self nie.',
  'Integrations': 'Integrasies',
  'Signed in as {0} · {1}': 'Aangemeld as {0} · {1}',
  'Not signed in — live Supercell lookups need a session.':
    'Nie aangemeld nie — direkte Supercell-soektogte benodig ’n sessie.',
  'Server key detected.': 'Bedienersleutel bespeur.',
  'Set SUPERCELL_API_KEY on the server to enable live lookups.':
    'Stel SUPERCELL_API_KEY op die bediener om direkte soektogte te aktiveer.',
  'Connected for auth and stored profiles.': 'Gekoppel vir magtiging en gestoorde profiele.',
  'Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY.': 'Stel VITE_SUPABASE_URL en VITE_SUPABASE_ANON_KEY.',
  'ClashKing endpoint': 'ClashKing-eindpunt',
  'ClashOfStats endpoint': 'ClashOfStats-eindpunt',
  'Signed out.': 'Afgemeld.',
  'Sign out': 'Meld af',
  'Sign in': 'Meld aan',
  'Data': 'Data',
  'Everything in this workspace is yours to export.': 'Alles in hierdie werkruimte is joune om uit te voer.',
  'Export JSON': 'Voer JSON uit',
  'Import JSON': 'Voer JSON in',
  'Progression entries': 'Vorderingsinskrywings',
  'Scheduled / planned': 'Geskeduleer / beplan',
  'Reset to the seeded demo village': 'Stel terug na die gesaaide demo-village',
  'Merges progression, plan and schedule from a payload.':
    'Voeg vordering, plan en skedule uit ’n lading saam.',
  'Linked villages, integrations and data': 'Gekoppelde villages, integrasies en data',
  'How this screen is built': 'Hoe hierdie skerm gebou is',
  'Artwork policy': 'Kunswerkbeleid',
  'Demo vs live': 'Demo teenoor direk',
  'Link copied to the clipboard.': 'Skakel na die knipbord gekopieer.',
  'Sharing is unavailable in this browser.': 'Deel is nie in hierdie blaaier beskikbaar nie.',

  // ---- artwork policy copy ----
  'no generated artwork': 'geen gegenereerde kunswerk nie',
  'This app renders': 'Hierdie app toon',
  'Tiles show official Supercell icons when an': 'Teëls wys amptelike Supercell-ikone wanneer ’n',
  'is supplied by the live API or a JSON import; otherwise they show a neutral typographic mark. Clan badges and the ClashKing logo are used exactly as provided, without recolouring or cropping.':
    'deur die direkte API of ’n JSON-invoer verskaf word; andersins wys hulle ’n neutrale tipografiese merkie. Clan-badges en die ClashKing-logo word presies soos verskaf gebruik, sonder herkleuring of sny.',

  // ---- sign-in ----
  'Sign in to run live Supercell lookups.': 'Meld aan om direkte Supercell-soektogte te doen.',
  'Email': 'E-pos',
  'Password': 'Wagwoord',
  'Sandbox access': 'Sandbox-toegang',
  'Fictional demo data': 'Fiktiewe demonstrasiedata',
  'Full command': 'Volle beheer',
  'War & roster': 'War & roster',
  'Readiness tools': 'Gereedheidsgereedskap',
  'Player view': 'Speleraansig',
  'Sign-in could not be completed.': 'Aanmelding kon nie voltooi word nie.',
  'Sandbox access could not be opened.': 'Sandbox-toegang kon nie oopgemaak word nie.',
  'Checking access…': 'Kontroleer tans toegang…',
  'Signing in…': 'Meld tans aan…',
  'Role': 'Rol',

  // ---- shared bits ----
  'Search': 'Soek',
  'All': 'Alles',
  'None': 'Geen',
  'Yes': 'Ja',
  'No': 'Nee',
  'Loading…': 'Laai tans…',
  'Retry': 'Probeer weer',
  'Save': 'Stoor',
  'To-do list': 'To-do lys',
  'Copied': 'Gekopieer',
  'Collection': 'Versameling',
  'Every asset, one grid': 'Elke bate, een rooster',
  'Tracker, heroes, equipment': 'Spoorsnyer, Heroes, toerusting',
  'Builder Hall progression': 'Builder Hall-vordering',
  'Multi-slot builder schedule': 'Multi-slot bouerskedule',
  'Upgrade queue & budget': 'Opgraderingstou & begroting',
  '{0} complete': '{0} voltooi',

  // ---- long-form explanatory copy ----
  'Clash Command stores this workspace in your browser’s local storage. Supabase, when configured, adds server-side profiles and linked tags; the Supercell key and any Discord webhook stay on the server and are never exposed to the client.':
    'Clash Command stoor hierdie werkruimte in jou blaaier se plaaslike berging. Supabase voeg, indien opgestel, bedienerprofielle en gekoppelde tags by; die Supercell-sleutel en enige Discord-webhook bly op die bediener en word nooit aan die kliënt blootgestel nie.',
  'Costs and times in this queue are planning estimates. Export the plan as JSON, or replace it with a payload from your own tracking sheet — imports merge progression, plan and schedule.':
    'Koste en tye in hierdie tou is beplanningsberamings. Voer die plan as JSON uit, of vervang dit met ’n lading uit jou eige dophoudblad — invoere voeg vordering, plan en skedule saam.',
  'Everything matching that filter is already maxed.': 'Alles wat by daardie filter pas, is reeds maks.',
  'Unknown keys are ignored, and the demo record fills anything you omit.':
    'Onbekende sleutels word geïgnoreer, en die demo-rekord vul alles wat jy weglaat.',
  'Expected shape:': 'Verwagte vorm:',
  'Export the current state first': 'Voer eers die huidige toestand uit',
  'One seasonal charge per eligible defence. Toggle what is currently charged in your village.':
    'Een seisoenlading per in aanmerking komende verdediging. Wissel wat tans in jou village gelaai is.',
  'The Supercell API does not expose wall segments, so the wall ring is tracked locally or through a JSON import.':
    'Die Supercell-API stel nie muursegmente bloot nie, dus word die muurring plaaslik of deur ’n JSON-invoer dopgehou.',
  'Level caps follow the Town Hall 17 reference sheet. Official artwork appears automatically once a Supercell API key or JSON import supplies':
    'Vlakperke volg die Town Hall 17-verwysingsblad. Amptelike kunswerk verskyn outomaties sodra ’n Supercell-API-sleutel of JSON-invoer',
  '— no generated images are used anywhere in this app.':
    'verskaf — geen gegenereerde beelde word êrens in hierdie app gebruik nie.',
  'Nothing scheduled. Add an upgrade from the plan or the tracker.':
    'Niks geskeduleer nie. Voeg ’n opgradering uit die plan of die spoorsnyer by.',
  "Switching clans re-points the tracker, calendar and war room at that clan's tag. Roster records for the other family clans load from the same Supercell key or JSON import.":
    'Om Clans te wissel, rig die spoorsnyer, kalender en war-kamer op daardie Clan se tag. Roster-rekords vir die ander familie-Clans laai uit dieselfde Supercell-sleutel of JSON-invoer.',
  'Uses the public search endpoint: game-profile fields and membership milestones only. Contact details and leadership notes are never returned.':
    'Gebruik die openbare soekeindpunt: slegs spelprofielvelde en lidmaatskapylpunte. Kontakbesonderhede en leierskapaantekeninge word nooit teruggestuur nie.',


  // ---- screen explainer (info sheet) ----
  'Clan': 'Clan',
  'War': 'War',
  'Family overview: village completion, the live war bar, CWL position and clan readiness in one scroll.':
    'Familie-oorsig: village-voltooiing, die direkte war-balk, CWL-posisie en Clan-gereedheid in een rol.',
  'Sync live pulls the Supercell player endpoint through this app’s own server. The API key never reaches the browser.':
    'Sink direk trek die Supercell-speler-eindpunt deur hierdie app se eie bediener. Die API-sleutel bereik nooit die blaaier nie.',
  'The view selector switches between Home Village, Builder Base, Calendar, Plan and Collection without leaving the player.':
    'Die aansigkieser wissel tussen Home Village, Builder Base, Kalender, Plan en Versameling sonder om die speler te verlaat.',
  'Completion pills are gold at exactly 100% and royal blue below it. Tap any category row to adjust levels or push an item into the plan.':
    'Voltooiing-pills is goud by presies 100% en koningsblou daaronder. Tik op enige kategoryry om vlakke te verstel of ’n item in die plan te stoot.',
  'Level caps follow the Town Hall 17 reference sheet, so a maxed row really means maxed for that hall.':
    'Vlakperke volg die Town Hall 17-verwysingsblad, dus beteken ’n maks-ry werklik maks vir daardie hall.',
  'Roster is sortable by trophies, donations, war stars or Town Hall, and can be filtered to members who opted in to war.':
    'Roster kan gerangskik word volgens Trophies, skenkings, War-sterre of Town Hall, en kan gefiltreer word tot lede wat vir War ingeskryf het.',
  'The family switcher re-points the whole workspace at another clan tag in the family.':
    'Die familiewisselaar rig die hele werkruimte op ’n ander clan-tag in die familie.',
  'The dual-team bar compares contested stars and destruction: green is your clan, royal blue is the opponent.':
    'Die dubbelspan-balk vergelyk betwiste sterre en vernietiging: groen is jou Clan, koningsblou is die teenstander.',
  'History cards show the CWL group rank, the W-T-L record, stars and destruction for each round.':
    'Geskiedeniskaarte wys die CWL-groep-rang, die W-T-L-rekord, sterre en vernietiging vir elke rondte.',

  // ---- priority + round outcomes ----
  'Now': 'Nou',
  'Later': 'Later',
  'Round record': 'Rondte-rekord',
  'Group won on stars against {0}.': 'Groep het op sterre gewen teen {0}.',
  'Tied on stars — destruction decides the round.': 'Gelykop op sterre — vernietiging beslis die rondte.',
  'Lost the round to {0} on stars.': 'Die rondte teen {0} op sterre verloor.',
  '{0} wins': '{0} wen',
  '{0} ties': '{0} gelykop',
  '{0} losses': '{0} nederlae',

  // ---- interpolated counts & notices ----
  '{0} members shown': '{0} lede gewys',
  '{0} queued upgrades': '{0} opgraderings in tou',
  '{0} scheduled · {1} slots busy': '{0} geskeduleer · {1} slots besig',
  '{0} removed from the schedule.': '{0} uit die skedule verwyder.',
  '{0} scheduled in Slot {1}.': '{0} in Slot {1} geskeduleer.',
  '{0} removed from the plan.': '{0} uit die plan verwyder.',
  '{0} added to the plan.': '{0} by die plan gevoeg.',
  '{0} of {1} at max level': '{0} van {1} op maks vlak',
  '{0} segments · cap level {1}': '{0} segmente · perkvlak {1}',
  '{0} recorded attacks': '{0} aangetekende aanvalle',
  '{0}W {1}T {2}L · {3}% average destruction': '{0}W {1}G {2}V · {3}% gemiddelde vernietiging',
  'Ownership check for {0} sent to {1}.': 'Eienaarskapkontrole vir {0} na {1} gestuur.',
  'Synced from the Supercell API — {0} updated.': 'Van die Supercell-API gesink — {0} opgedateer.',
  'This village was loaded from the Supercell API at {0}. Buildings, defences, traps and wall segments are still local — the player endpoint does not expose them.':
    'Hierdie village is om {0} vanaf die Supercell-API gelaai. Buildings, Defenses, Traps en muursegmente is steeds plaaslik — die spelereindpunt stel hulle nie bloot nie.',
  'Every number on screen is seeded demo data held in this browser. Configure a Supercell API key or import a JSON payload to replace it.':
    'Elke syfer op die skerm is gesaaide demonstrasiedata wat in hierdie blaaier gehou word. Stel ’n Supercell-API-sleutel op of voer ’n JSON-lading in om dit te vervang.',
  'h': 'u',


  // ---- counts, levels and composite labels ----
  '{0} of {1} maxed': '{0} van {1} maks',
  '{0}/{1} maxed': '{0}/{1} maks',
  '{0} of {1} categories maxed': '{0} van {1} kategorieë maks',
  '{0} categories maxed': '{0} kategorieë maks',
  '{0} at level {1}': '{0} op vlak {1}',
  '{0} segments left to ring': '{0} segmente oor om te ring',
  'Level {0} · {1}': 'Vlak {0} · {1}',
  '{0} — level {1}/{2}': '{0} — vlak {1}/{2}',
  '{0} — level {1}, {2} left': '{0} — vlak {1}, {2} oor',
  '{0} segments to level {1}': '{0} segmente tot vlak {1}',


  // ---- sign-in: Supabase + Discord ----
  'Continue with Discord': 'Gaan voort met Discord',
  'Opening Discord…': 'Maak tans Discord oop…',
  'or': 'of',
  'Supabase account': 'Supabase-rekening',
  'Clan server': 'Clan-bediener',
  'Signs you into your account. Live Supercell lookups still need a clan-server session.':
    'Meld jou by jou rekening aan. Direkte Supercell-soektogte benodig steeds ’n clan-bediener-sessie.',
  'Issues the session the Supercell proxy checks, which unlocks live lookups.':
    'Reik die sessie uit wat die Supercell-instaanbediener kontroleer, wat direkte soektogte ontsluit.',
  'Enter your email address first.': 'Voer eers jou e-posadres in.',
  'Check your inbox for the sign-in link.': 'Kyk in jou inkassie vir die aanmeldskakel.',
  'The magic link could not be sent.': 'Die towenskakel kon nie gestuur word nie.',
  'Discord sign-in could not start.': 'Discord-aanmelding kon nie begin nie.',
  'Email me a sign-in link instead': 'Stuur eerder ’n aanmeldskakel per e-pos',
  'Supabase is not configured on this build.': 'Supabase is nie op hierdie bou opgestel nie.',
  'The clan server below still works.': 'Die clan-bediener hieronder werk steeds.',
  'Continue without signing in': 'Gaan voort sonder om aan te meld',
  'Demo password is': 'Demo-wagwoord is',
  'Fan content': 'Ondersteunersinhoud',


  // ---- global tag search ----
  'Search by #playertag or #clantag...': 'Soek op #playertag of #clantag...',
  'Former': 'Voormalig',

  /* `Clan`, `War`, `Home Village` and `Builder Base` map to themselves on
     purpose: they are Clash of Clans game terms and must stay verbatim in the
     Afrikaans interface. Listing them explicitly keeps that decision visible
     instead of relying on the silent fallback. */
  'Home Village': 'Home Village',
  'Builder Base': 'Builder Base',
};

/* ------------------------------------------------------------------ */

/**
 * Some strings arrive as *data*, not source text — the seeded demo village
 * writes task names such as "104 segments to level 18" into localStorage. They
 * cannot be wrapped at a call site, so `substitute` recognises a handful of
 * generated shapes and rewrites them through the dictionary.
 */
const PATTERNS: Array<[RegExp, string]> = [
  [/^([\d,]+) segments to level (\d+)$/, '{0} segments to level {1}'],
];

function substitute(source: string, table: Record<string, string> | null): string {
  let out = (table && table[source]) || source;
  if (!table) return out;
  for (const [pattern, key] of PATTERNS) {
    const match = pattern.exec(source);
    if (match) {
      out = table[key] ?? key;
      for (let i = 1; i < match.length; i += 1) out = out.replace(`{${i - 1}}`, match[i]);
      return out;
    }
  }
  return out;
}

/**
 * Non-hook translator for helpers that run at render time but are not
 * components (`hoursLabel`, the demo seed). It reads the language the provider
 * last published, so any component that re-renders on a language change picks
 * up the new wording on the same pass.
 */
let activeLang: Lang = 'af';

export function publishLang(lang: Lang) {
  activeLang = lang;
}

export function tt(source: string, ...values: Array<string | number>): string {
  let out = substitute(source, activeLang === 'af' ? AF : null);
  for (let i = 0; i < values.length; i += 1) out = out.replace(`{${i}}`, String(values[i]));
  return out;
}

type I18nValue = {
  lang: Lang;
  setLang: (lang: Lang) => void;
  toggleLang: () => void;
  /** Translate an English source string; falls back to the source itself. */
  t: (source: string, ...values: Array<string | number>) => string;
};

const I18nContext = createContext<I18nValue | null>(null);

function readStoredLang(): Lang {
  if (typeof window === 'undefined') return 'af';
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    if (stored === 'af' || stored === 'en') return stored;
  } catch {
    /* private mode — fall through to the default */
  }
  return 'af';
}

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>(readStoredLang);

  // Publish synchronously during render so `tt()` is never a frame behind.
  if (activeLang !== lang) activeLang = lang;

  useEffect(() => {
    try {
      window.localStorage.setItem(STORAGE_KEY, lang);
    } catch {
      /* storage unavailable; the choice just will not persist */
    }
    if (typeof document !== 'undefined') document.documentElement.lang = lang;
  }, [lang]);

  const setLang = useCallback((next: Lang) => setLangState(next), []);
  const toggleLang = useCallback(() => setLangState((prev) => (prev === 'af' ? 'en' : 'af')), []);

  const t = useCallback(
    (source: string, ...values: Array<string | number>) => {
      let out = substitute(source, lang === 'af' ? AF : null);
      for (let i = 0; i < values.length; i += 1) out = out.replace(`{${i}}`, String(values[i]));
      return out;
    },
    [lang],
  );

  const value = useMemo<I18nValue>(() => ({ lang, setLang, toggleLang, t }), [lang, setLang, toggleLang, t]);
  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n(): I18nValue {
  const ctx = useContext(I18nContext);
  if (!ctx) {
    // Outside the provider (unit tests, the smoke harness) behave as English.
    return {
      lang: 'en',
      setLang: () => {},
      toggleLang: () => {},
      t: (source: string, ...values: Array<string | number>) => {
        let out = source;
        for (let i = 0; i < values.length; i += 1) out = out.replace(`{${i}}`, String(values[i]));
        return out;
      },
    };
  }
  return ctx;
}

/** Shorthand for components: `const { t } = useI18n();` */
export function useT() {
  return useI18n().t;
}
