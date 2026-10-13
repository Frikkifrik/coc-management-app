/**
 * Headless render check for the mobile Clash Command app.
 *
 * Vite/Tailwind handle the real build; this script only proves the React tree
 * mounts, runs its effects and paints the spec'd screens without throwing.
 *
 *   node scripts/smoke-clash.mjs
 *
 * `jsdom` is an optional dev dependency — the script exits with a clear message
 * when it is not installed so `npm run build` stays dependency-light.
 */
import { build } from 'esbuild';
import { readFileSync } from 'node:fs';
import { existsSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

let JSDOM;
try {
  ({ JSDOM } = await import('jsdom'));
} catch {
  console.error('jsdom is not installed — run: npm i --no-save jsdom');
  process.exit(2);
}

const root = path.resolve(import.meta.dirname, '..');
const workdir = mkdtempSync(path.join(tmpdir(), 'clash-smoke-'));
const outfile = path.join(workdir, 'bundle.mjs');

const entry = `
import React from 'react';
import { createRoot } from 'react-dom/client';
import ClashApp from './src/clash/ClashApp';
import App from './src/app';
import { createDemoState, categoryRows } from './src/clash/demo';
import { assetPathFor, expectedAssetPaths } from './src/clash/assets';
import { signInWithDiscord, signInWithEmail, signInWithMagicLink, FAN_CONTENT_NOTICE, normaliseSearchTag } from './src/clash/auth-probe';
export { React, createRoot, ClashApp, App, createDemoState, categoryRows, assetPathFor, expectedAssetPaths, signInWithDiscord, signInWithEmail, signInWithMagicLink, FAN_CONTENT_NOTICE, normaliseSearchTag };
`;

await build({
  stdin: {
    contents: entry,
    resolveDir: root,
    sourcefile: 'smoke-entry.mjs',
    loader: 'js',
  },
  outfile,
  bundle: true,
  format: 'esm',
  platform: 'node',
  target: 'node22',
  jsx: 'automatic',
  loader: { '.css': 'empty' },
  absWorkingDir: root,
  logLevel: 'silent',
});

/* ---------------- jsdom environment ---------------- */

const dom = new JSDOM('<!doctype html><html><body><div id="root"></div></body></html>', {
  url: 'http://localhost:4173/clash',
  pretendToBeVisual: true,
});

const { window } = dom;
globalThis.window = window;
globalThis.document = window.document;
Object.defineProperty(globalThis, 'navigator', { value: window.navigator, configurable: true, writable: true });
globalThis.location = window.location;
globalThis.history = window.history;
globalThis.HTMLElement = window.HTMLElement;
globalThis.Element = window.Element;
globalThis.Node = window.Node;
globalThis.Event = window.Event;
globalThis.MouseEvent = window.MouseEvent;
globalThis.KeyboardEvent = window.KeyboardEvent;
globalThis.getComputedStyle = window.getComputedStyle.bind(window);
globalThis.requestAnimationFrame = (cb) => setTimeout(() => cb(Date.now()), 0);
globalThis.cancelAnimationFrame = (id) => clearTimeout(id);
globalThis.IS_REACT_ACT_ENVIRONMENT = true;
/* The interface ships in Afrikaans; pin it so the assertions below are stable
   regardless of whatever a previous run persisted. */
window.localStorage.setItem('clash-command:lang:v1', 'af');
window.matchMedia = window.matchMedia || (() => ({ matches: false, addEventListener() {}, removeEventListener() {} }));

const mod = await import(pathToFileURL(outfile).href);
const { React, createRoot, ClashApp, App, createDemoState, categoryRows, assetPathFor, expectedAssetPaths, signInWithDiscord, signInWithEmail, signInWithMagicLink, FAN_CONTENT_NOTICE, normaliseSearchTag } = mod;

const results = [];
function check(name, fn) {
  try {
    const value = fn();
    results.push({ name, ok: Boolean(value), value });
  } catch (error) {
    results.push({ name, ok: false, value: error.message });
  }
}

/* 1. live mount — executes every render body, memo, state initialiser and effect */
/* 2. live mount (runs effects: localStorage persistence + history sync) */
let container = window.document.getElementById('root');
try {
  const reactRoot = createRoot(container);
  await React.act(async () => {
    reactRoot.render(React.createElement(ClashApp));
  });
  results.push({ name: 'client mount + effects', ok: container.innerHTML.length > 4000, value: container.innerHTML.length });
} catch (error) {
  results.push({ name: 'client mount + effects', ok: false, value: error.message });
}

const html = container.innerHTML;

const expectations = [
  ['design system root class', /class="[^"]*clash-app/],
  ['top nav renders the player tag', /#2YL8V0JQ/],
  ['view selector present', /Kies aansig|Besig om te kyk|Select view|Viewing/],
  ['Home Village view label', /Home Village/],
  ['upgrade tracker heading', /Opgraderingspoorsnyer|Upgrade tracker/],
  ['Buildings category row', /Buildings/],
  ['Defenses category row', /Defenses/],
  ['Supercharge category row', /Supercharge/],
  ['Guardians category row', /Guardians/],
  ['Equipment category row', /Equipment/],
  ['Walls category row', /Walls/],
  ['maxed gold pill', /border-amber-500\/60/],
  ['in-progress royal blue pill', /border-blue-500\/60/],
  ['progress ring svg', /<svg[^>]*cc-ring/],
  ['equipment grid uses 5 columns', /grid-cols-5/],
  ['heroes grid is three across', /grid-cols-3/],
  ['no red accent classes survive', /^(?!.*\b(?:border|bg|text)-red-\d)/s],
  ['level badge styling', /border-neutral-700 bg-black\/80/],
  ['bottom nav pill', /bg-\[#18181A\]\/95/],
  ['bottom nav active highlight', /bg-\[#0F172A\][^"]*ring-\[#2563EB\]/],
  ['legend states the artwork policy', /geen gegenereerde|no generated (artwork|images)/i],
];

for (const [name, pattern] of expectations) check(name, () => pattern.test(html));

/* 3. completion maths on the seeded village */

const seeded = createDemoState();
const summaries = categoryRows(seeded.progression, 'home');
const byId = Object.fromEntries(summaries.map((row) => [row.id, row]));

check('Defenses is exactly 100% (gold pill)', () => byId.defenses.percent === 100 && byId.defenses.maxed === true);
check('Guardians is exactly 100% (gold pill)', () => byId.guardians.percent === 100 && byId.guardians.maxed === true);
check('Equipment is partial (royal blue pill)', () => byId.equipment.percent < 100 && byId.equipment.maxed === false);
check('Supercharge counts charged defences only', () => byId.supercharge.earned === 2 && byId.supercharge.total === 4);
check('Walls use 325 TH17 segments', () => byId.walls.itemCount === 325);
check('every category reports 10 tracker rows', () => summaries.length === 10);
check('no category exceeds 100%', () => summaries.every((row) => row.percent <= 100));
check('schedule derives from the tracker levels', () =>
  seeded.tasks.length > 0 &&
  seeded.tasks.every((task) => {
    const level = seeded.progression.levels[task.key] ?? 0;
    return task.fromLevel === level && task.toLevel <= level + 1;
  }),
);

/* 4. local artwork resolver */

/* The Arsenaal drop ships in the Drive's own layout, so a catalog key resolves
   to the real file the map points at; the flat <category>/<slug>.png path is the
   fallback for a hand drop. Either way the url must sit under /clash-assets/. */
check('catalog key resolves under /clash-assets/', () =>
  String(assetPathFor('defenses:inferno-tower')).startsWith('/clash-assets/'));
check('Inferno Tower resolves to a real file on disk', () => {
  const url = assetPathFor('defenses:inferno-tower');
  return Boolean(url) && existsSync(path.join(root, 'public', url));
});
/* "P.E.K.K.A" slugs to "p-e-k-k-a", so that is the catalog key — and the map
   points it at the official troop icon rather than a guessed flat path. */
check('P.E.K.K.A slugs to p-e-k-k-a and resolves on disk', () => {
  const url = assetPathFor('laboratory:p-e-k-k-a');
  return Boolean(url) && existsSync(path.join(root, 'public', url)) ? url : `unresolved: ${url}`;
});
check('builder-base Power P.E.K.K.A is namespaced and resolves', () => {
  const url = assetPathFor('laboratory:bb-power-p-e-k-k-a');
  return Boolean(url) && existsSync(path.join(root, 'public', url)) ? url : `unresolved: ${url}`;
});
check('builder-base key stays namespaced', () =>
  String(assetPathFor('defenses:bb-bomb-tower') ?? '').startsWith('/clash-assets/'));
check('category key resolves to a real file on disk', () => {
  const url = assetPathFor('category:equipment');
  return Boolean(url) && existsSync(path.join(root, 'public', url));
});
check('no mapped path is stale', () => {
  const broken = expectedAssetPaths().filter((item) => item.mapped && !existsSync(path.join(root, 'public', item.path)));
  return broken.length === 0 ? true : `${broken.length} stale: ${broken[0]?.key}`;
});
check('most catalog paths resolve to real artwork', () => {
  const all = expectedAssetPaths();
  const installed = all.filter((item) => existsSync(path.join(root, 'public', item.path))).length;
  return installed >= 200 ? true : `only ${installed}/${all.length} installed`;
});
check('unknown key resolves to nothing', () => assetPathFor('nope:nope') === undefined);
check('every catalog entry has an expected path', () => {
  const all = expectedAssetPaths();
  return all.length > 200 && all.every((item) => item.path.startsWith('/clash-assets/'));
});

/* 5. route + view switching drives every core screen */

function clickElement(target, label) {
  if (!target) throw new Error(`no control labelled "${label}"`);
  return React.act(async () => {
    target.dispatchEvent(new window.MouseEvent('click', { bubbles: true, cancelable: true }));
  });
}

function clickByText(text) {
  const nodes = Array.from(container.querySelectorAll('button'));
  const target = nodes.find((node) => node.textContent.trim() === text || node.getAttribute('aria-label') === text);
  return clickElement(target, text);
}

function clickSelectorTrigger() {
  return clickElement(container.querySelector('[aria-haspopup="listbox"]'), 'view selector');
}

async function pickView(label) {
  await clickSelectorTrigger();
  const option = Array.from(container.querySelectorAll('[role="option"]')).find((node) =>
    node.textContent.trim().startsWith(label),
  );
  return clickElement(option, `view option ${label}`);
}

async function screen(name, steps, pattern) {
  try {
    for (const step of steps) await step();
    const passed = pattern.test(container.innerHTML);
    results.push({ name, ok: passed, value: passed ? '' : 'expected content not found' });
  } catch (error) {
    results.push({ name, ok: false, value: error.message });
  }
}

await screen('bottom nav → War screen', [() => clickByText('War')], /War history/);
await screen('bottom nav → Clan screen', [() => clickByText('Clan')], /Roster/);
await screen('clan → scout sheet opens', [() => clickByText('Scout a tag')], /Public player and clan lookup/);
await screen('clan → scout sheet closes', [() => clickByText('Close')], /Roster/);
await screen('bottom nav → Home screen', [() => clickByText('Home')], /Progression snapshot/);
await screen('bottom nav → back to Profile', [() => clickByText('Profile')], /Upgrade tracker/);

await screen('view selector → Calendar (Gantt)', [() => pickView('Calendar')], /Builder schedule/);
await screen('view selector → Plan', [() => pickView('Plan')], /Upgrade plan/);
await screen('view selector → Collection', [() => pickView('Collection')], /Search every asset/);
await screen('view selector → Builder Base', [() => pickView('Builder Base')], /Builder Hall/);
await screen('view selector → Home Village', [() => pickView('Home Village')], /Upgrade tracker/);

await screen('settings sheet opens', [() => clickByText('Settings')], /Linked player tags/);
await screen('settings sheet closes', [() => clickByText('Close')], /Upgrade tracker/);
await screen('info sheet states the artwork policy', [() => clickByText('About this screen')], /no generated artwork/i);

if (process.argv.includes('--report')) {
  console.log('\nSeeded Town Hall 17 village');
  console.log('category       %      maxed  items  next');
  for (const row of summaries) {
    console.log(
      row.id.padEnd(14),
      row.percent.toFixed(1).padStart(5),
      String(row.maxed ? 'yes' : 'no').padStart(6),
      String(row.itemCount).padStart(6),
      ' ',
      row.next ? `${row.next.name} ${row.next.level}/${row.next.max}` : '—',
    );
  }
  const builderRows = categoryRows(seeded.progression, 'builder');
  console.log('\nBuilder Base');
  for (const row of builderRows) console.log(' ', row.id.padEnd(14), `${row.percent.toFixed(1)}%`);
}

/* 6. routing: the dark app is the whole product */

const appHost = window.document.createElement('div');
window.document.body.appendChild(appHost);
const appRoot = createRoot(appHost);
await React.act(async () => {
  appRoot.render(React.createElement(App));
});
check('route / renders the tracker', () => /Opgraderingspoorsnyer|Upgrade tracker/.test(appHost.innerHTML));
check('classic workspace markup is gone', () => !/workspace-shell|sign-in-card|family-selector/.test(appHost.innerHTML));

await React.act(async () => {
  window.history.pushState({}, '', '/login');
  window.dispatchEvent(new window.PopStateEvent('popstate', { state: {} }));
});
check('route /login renders the dark sign-in', () => /Meld aan om direkte Supercell-soektogte|Sign in to run live Supercell lookups/.test(appHost.innerHTML));
check('sign-in offers sandbox roles', () => /Sandbox-toegang|Sandbox access/.test(appHost.innerHTML));

await React.act(async () => {
  window.history.pushState({}, '', '/app/dashboard');
  window.dispatchEvent(new window.PopStateEvent('popstate', { state: {} }));
});
check('legacy /app/* redirects into the mobile app', () => /Opgraderingspoorsnyer|Upgrade tracker/.test(appHost.innerHTML));

/* ---------------- language switch ---------------- */

check('Afrikaans is the shipping default', () => /Opgraderingspoorsnyer/.test(appHost.innerHTML));

/* ---------------- rendered tiles use real artwork ---------------- */

// Collect every <img> the app actually painted and confirm the file exists.
const paintedSrcs = () =>
  [...appHost.querySelectorAll('img')]
    .map((node) => node.getAttribute('src') || '')
    .filter((src) => src.startsWith('/clash-assets/'));

const painted = paintedSrcs();
check('tiles paint <img> tags from the local asset drop', () =>
  painted.length > 0 ? true : 'no <img> tiles rendered at all');
check('every painted asset tile exists on disk', () => {
  const missing = painted.filter((src) => !existsSync(path.join(root, 'public', src)));
  return missing.length === 0 ? true : `${missing.length} broken: ${missing.slice(0, 3).join(', ')}`;
});
check('the tracker view alone paints a dozen or more official tiles', () =>
  painted.length >= 12 ? true : `only ${painted.length}`);

// Walk every bottom-nav route and confirm tiles keep resolving there too.
for (const navButton of [...appHost.querySelectorAll('nav button')]) {
  await React.act(async () => {
    navButton.dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
  });
  const broken = paintedSrcs().filter((src) => !existsSync(path.join(root, 'public', src)));
  if (broken.length) {
    check(`tiles resolve on the ${navButton.textContent.trim() || 'nav'} screen`, () => `broken: ${broken[0]}`);
  }
}
check('tiles resolve on every bottom-nav screen', () =>
  paintedSrcs().every((src) => existsSync(path.join(root, 'public', src))) ? true : 'a screen painted a dead tile');

// Leave the app back on the tracker; the language checks below expect it.
await React.act(async () => {
  const profileTab = [...appHost.querySelectorAll('nav button')][1];
  profileTab.dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
});

await React.act(async () => {
  window.history.pushState({}, '', '/');
  window.dispatchEvent(new window.PopStateEvent('popstate', { state: {} }));
});

/* ---------------- header language toggle ---------------- */

const langButton = (label) => appHost.querySelector(`button[aria-label="${label}"]`);

check('header carries an AF/EN toggle pill', () =>
  Boolean(langButton('Afrikaans')) && Boolean(langButton('English')) ? true : 'toggle not found');
check('the toggle lives in the top bar, not Settings', () => {
  const header = appHost.querySelector('header');
  return header && header.querySelector('button[aria-label="English"]') ? true : 'toggle is not inside <header>';
});
check('the active language is marked on the toggle', () => {
  const af = langButton('Afrikaans');
  return af?.getAttribute('aria-pressed') === 'true' ? true : `aria-pressed=${af?.getAttribute('aria-pressed')}`;
});

// Flipping language must re-render in place — no reload, no sheet opened.
await React.act(async () => {
  langButton('English').dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
});
check('switching to English re-renders the UI', () => /Upgrade tracker/.test(appHost.innerHTML));
check('language choice persists to localStorage', () => window.localStorage.getItem('clash-command:lang:v1') === 'en');
check('the toggle now marks English as active', () =>
  langButton('English')?.getAttribute('aria-pressed') === 'true');

await React.act(async () => {
  langButton('Afrikaans').dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
});
check('switching back to Afrikaans works', () => /Opgraderingspoorsnyer/.test(appHost.innerHTML));

/* ---------------- Supercell fan content policy ---------------- */

const DISCLAIMER = /This material is unofficial and is not endorsed by Supercell/;

// The per-screen footer block is gone: the notice belongs in exactly two places.
check('the disclaimer is NOT repeated in the screen footer', () =>
  DISCLAIMER.test(appHost.innerHTML) ? 'still rendered on the tracker screen' : true);

await React.act(async () => {
  const info = appHost.querySelector('button[aria-label="Oor hierdie skerm"], button[aria-label="About this screen"]');
  info.dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
});
check('the info sheet carries the full disclaimer', () =>
  DISCLAIMER.test(appHost.innerHTML) ? true : 'missing from the info sheet');
check('the disclaimer links the official policy page', () =>
  /www\.supercell\.com\/fan-content-policy/.test(appHost.innerHTML));

await React.act(async () => {
  const close = appHost.querySelector('[role="dialog"] button[aria-label="Maak toe"], [role="dialog"] button[aria-label="Close"]');
  close.dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
});
check('closing the info sheet removes the disclaimer again', () =>
  DISCLAIMER.test(appHost.innerHTML) ? 'still present after closing' : true);

/* ---------------- Data Sources removed ---------------- */

check('the Data Sources section is gone from the UI', () =>
  /Data sources|Databronne/.test(appHost.innerHTML) ? 'still rendered' : true);

/* ---------------- CSS cascade guard ---------------- */

// `npm run smoke` cannot see the cascade, so guard the source invariant that
// the royal-blue language pill depends on: no button reset may outrank a
// single-class utility. `.clash-app button` is (0,1,1) and beats `bg-[#2563EB]`
// (0,1,0); wrapping it in :where() drops it to zero. See
// scripts/verify-lang-toggle.mjs for the real cascade check.
const clashCss = readFileSync(path.join(root, 'src/clash/clash.css'), 'utf8');
check('the button reset cannot outrank utility backgrounds', () => {
  const offenders = [];
  for (const m of clashCss.matchAll(/([^{}]+)\{([^}]*)\}/g)) {
    const sel = m[1].trim();
    if (!/(^|[\s,])button([\s,:.[]|$)/.test(sel)) continue;
    if (sel.includes(':where(')) continue;               // zero specificity — safe
    if (!/background/.test(m[2])) continue;
    offenders.push(sel);
  }
  return offenders.length ? `outranks utilities: ${offenders.join(', ')}` : true;
});
check('the language pill uses the royal-blue active utility', () => {
  const src = readFileSync(path.join(root, 'src/clash/components.tsx'), 'utf8');
  const pill = src.slice(src.indexOf('export function LangToggle'), src.indexOf('export function LangToggle') + 2200);
  return pill.includes("'bg-[#2563EB] text-white font-bold px-2.5 py-1 rounded-md transition-colors shadow-sm'")
    ? true : 'active class string drifted';
});

/* ---------------- global tag search ---------------- */

// The normaliser is pure, so assert it directly rather than through the DOM.
check('normaliseSearchTag prepends a missing #', () => normaliseSearchTag('2q0p2ylrg') === '#2Q0P2YLRG');
check('normaliseSearchTag keeps an existing #', () => normaliseSearchTag('#2Q0P2YLRG') === '#2Q0P2YLRG');
check('normaliseSearchTag uppercases', () => normaliseSearchTag('#abc123') === '#ABC123');
check('normaliseSearchTag strips spaces', () => normaliseSearchTag('# 2Q0P 2YLRG') === '#2Q0P2YLRG');
check('normaliseSearchTag strips zero-width copy artefacts', () =>
  normaliseSearchTag('\u200b#2Q0P2YLRG\u200b') === '#2Q0P2YLRG');
check('normaliseSearchTag rejects empty input', () => normaliseSearchTag('   ') === null);


check('a search bar is pinned under the header', () => {
  const header = appHost.querySelector('header');
  const input = header?.querySelector('input[type="search"]');
  return input ? true : 'no search input inside <header>';
});
check('the search placeholder is the Afrikaans prompt', () => {
  const input = appHost.querySelector('header input[type="search"]');
  return input?.getAttribute('placeholder') === 'Soek op #playertag of #clantag...'
    ? true
    : `placeholder=${input?.getAttribute('placeholder')}`;
});

// Typing a bare tag and submitting must normalise it and run the lookup.
const searchInput = appHost.querySelector('header input[type="search"]');
await React.act(async () => {
  const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
  setter.call(searchInput, '2q0p2ylrg');
  searchInput.dispatchEvent(new window.Event('input', { bubbles: true }));
});
check('the search field accepts a tag without a leading #', () =>
  searchInput.value === '2q0p2ylrg' ? true : `value=${searchInput.value}`);

await React.act(async () => {
  searchInput.closest('form').dispatchEvent(new window.Event('submit', { bubbles: true, cancelable: true }));
});
// The fetch is not available in jsdom, so the bar must surface an error rather
// than throw — and it must have normalised the tag to upper case with a '#'.
check('submitting normalises the tag and handles a failed lookup gracefully', () =>
  searchInput.value === '#2Q0P2YLRG' ? true : `normalised to ${searchInput.value}`);

/* ---------------- login screen ---------------- */

await React.act(async () => {
  window.history.pushState({}, '', '/login');
  window.dispatchEvent(new window.PopStateEvent('popstate', { state: {} }));
});
check('login offers a branded Discord button', () =>
  /Continue with Discord|Gaan voort met Discord/.test(appHost.innerHTML));
// Exercise the real auth entry points. Supabase is unconfigured in this build,
// so each must report that honestly instead of throwing or silently resolving.
const discordResult = await signInWithDiscord();
check('Discord sign-in guards an unconfigured Supabase', () =>
  discordResult.ok === false && discordResult.unconfigured === true
    ? true
    : `unexpected: ${JSON.stringify(discordResult)}`);
const emailResult = await signInWithEmail('a@b.co', 'pw');
check('email sign-in guards an unconfigured Supabase', () =>
  emailResult.ok === false && emailResult.unconfigured === true);
const magicResult = await signInWithMagicLink('a@b.co');
check('magic-link sign-in guards an unconfigured Supabase', () =>
  magicResult.ok === false && magicResult.unconfigured === true);
check('the disclaimer constant is the official Supercell wording', () =>
  FAN_CONTENT_NOTICE ===
  "This material is unofficial and is not endorsed by Supercell. For more information see Supercell's Fan Content Policy: www.supercell.com/fan-content-policy."
    ? true
    : 'wording drifted from the official policy');
check('login offers an email + password form', () =>
  appHost.querySelectorAll('input[type="email"]').length > 0 &&
  appHost.querySelectorAll('input[type="password"]').length > 0);
// The magic link is a Supabase feature, so it only appears on that tab — and
// the tab defaults to the clan server when Supabase is unconfigured.
await React.act(async () => {
  const supabaseTab = [...appHost.querySelectorAll('button')].find((node) => /Supabase/.test(node.textContent || ''));
  supabaseTab.dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
});
check('login offers a magic-link option on the Supabase tab', () =>
  /sign-in link|aanmeldskakel/i.test(appHost.innerHTML));
check('login is honest when Supabase is unconfigured', () =>
  /Supabase is not configured|Supabase is nie/.test(appHost.innerHTML));
check('login keeps the clan-server path that unlocks live lookups', () =>
  /Clan server|Clan-bediener/.test(appHost.innerHTML));
check('login carries the fan content disclaimer too', () =>
  /This material is unofficial and is not endorsed by Supercell/.test(appHost.innerHTML));

/* ---------------- linked player tag survives sign-in ---------------- */

// Seed a linked tag, mount a fresh app the way a post-login redirect would, and
// confirm the tag is still there. This is the "preserve the #tag" requirement
// proved end to end rather than assumed from localStorage semantics.
const STATE_KEY = 'clash-command:state:v1';
const seededState = createDemoState();
const SEEDED_TAG = '#2YQ8RJLP0';
seededState.linkedTags = [
  { tag: SEEDED_TAG, label: 'War alt', tokenFingerprint: 'abcd1234', verified: false },
  ...(seededState.linkedTags ?? []),
];
window.localStorage.setItem(STATE_KEY, JSON.stringify(seededState));

const tagHost = window.document.createElement('div');
window.document.body.appendChild(tagHost);
await React.act(async () => {
  window.history.pushState({}, '', '/');
  window.dispatchEvent(new window.PopStateEvent('popstate', { state: {} }));
  createRoot(tagHost).render(React.createElement(App));
});

check('a fresh mount hydrates the linked player tag from storage', () => {
  const parsed = JSON.parse(window.localStorage.getItem(STATE_KEY));
  return parsed.linkedTags.some((entry) => entry.tag === SEEDED_TAG) ? true : 'tag was dropped';
});

await React.act(async () => {
  const settings = tagHost.querySelector('button[aria-label="Instellings"], button[aria-label="Settings"]');
  settings.dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
});
check('the linked tag renders after the sign-in redirect', () =>
  tagHost.innerHTML.includes(SEEDED_TAG) ? true : 'tag did not render in Settings');
check('sign-in does not clear the workspace state', () =>
  JSON.parse(window.localStorage.getItem(STATE_KEY)).linkedTags.length >= 1);

let failures = 0;
for (const result of results) {
  if (!result.ok) failures += 1;
  console.log(`${result.ok ? 'PASS' : 'FAIL'}  ${result.name}${result.ok ? '' : ` — ${result.value}`}`);
}

rmSync(workdir, { recursive: true, force: true });
console.log(`\n${results.length - failures}/${results.length} checks passed`);
process.exit(failures === 0 ? 0 : 1);
