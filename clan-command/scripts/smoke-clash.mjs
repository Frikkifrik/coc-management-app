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
import { mkdtempSync, rmSync } from 'node:fs';
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
export { React, createRoot, ClashApp, App, createDemoState, categoryRows, assetPathFor, expectedAssetPaths };
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
window.matchMedia = window.matchMedia || (() => ({ matches: false, addEventListener() {}, removeEventListener() {} }));

const mod = await import(pathToFileURL(outfile).href);
const { React, createRoot, ClashApp, App, createDemoState, categoryRows, assetPathFor, expectedAssetPaths } = mod;

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
  ['view selector present', /Select view|Viewing/],
  ['Home Village view label', /Home Village/],
  ['upgrade tracker heading', /Upgrade tracker/],
  ['Buildings category row', /Buildings/],
  ['Defenses category row', /Defenses/],
  ['Supercharge category row', /Supercharge/],
  ['Guardians category row', /Guardians/],
  ['Equipment category row', /Equipment/],
  ['Walls category row', /Walls/],
  ['maxed gold pill', /border-amber-500\/60/],
  ['in-progress red pill', /border-red-500\/60/],
  ['progress ring svg', /<svg[^>]*cc-ring/],
  ['equipment grid uses 5 columns', /grid-cols-5/],
  ['level badge styling', /border-neutral-700 bg-black\/80/],
  ['bottom nav pill', /bg-\[#18181A\]\/95/],
  ['bottom nav active highlight', /bg-\[#28282B\]/],
  ['legend states the artwork policy', /no generated (artwork|images)/i],
];

for (const [name, pattern] of expectations) check(name, () => pattern.test(html));

/* 3. completion maths on the seeded village */

const seeded = createDemoState();
const summaries = categoryRows(seeded.progression, 'home');
const byId = Object.fromEntries(summaries.map((row) => [row.id, row]));

check('Defenses is exactly 100% (gold pill)', () => byId.defenses.percent === 100 && byId.defenses.maxed === true);
check('Guardians is exactly 100% (gold pill)', () => byId.guardians.percent === 100 && byId.guardians.maxed === true);
check('Equipment is partial (red pill)', () => byId.equipment.percent < 100 && byId.equipment.maxed === false);
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

check('catalog key resolves to a clash-assets path', () => assetPathFor('defenses:inferno-tower') === '/clash-assets/defenses/inferno-tower.png');
check('builder-base key is namespaced', () => assetPathFor('defenses:bb-bomb-tower') === '/clash-assets/defenses/bomb-tower.png');
check('category key resolves under categories/', () => assetPathFor('category:equipment') === '/clash-assets/categories/equipment.png');
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
check('route / renders the tracker', () => /Upgrade tracker/.test(appHost.innerHTML));
check('classic workspace markup is gone', () => !/workspace-shell|sign-in-card|family-selector/.test(appHost.innerHTML));

await React.act(async () => {
  window.history.pushState({}, '', '/login');
  window.dispatchEvent(new window.PopStateEvent('popstate', { state: {} }));
});
check('route /login renders the dark sign-in', () => /Sign in to run live Supercell lookups/.test(appHost.innerHTML));
check('sign-in offers sandbox roles', () => /Sandbox access/.test(appHost.innerHTML));

await React.act(async () => {
  window.history.pushState({}, '', '/app/dashboard');
  window.dispatchEvent(new window.PopStateEvent('popstate', { state: {} }));
});
check('legacy /app/* redirects into the mobile app', () => /Upgrade tracker/.test(appHost.innerHTML));

let failures = 0;
for (const result of results) {
  if (!result.ok) failures += 1;
  console.log(`${result.ok ? 'PASS' : 'FAIL'}  ${result.name}${result.ok ? '' : ` — ${result.value}`}`);
}

rmSync(workdir, { recursive: true, force: true });
console.log(`\n${results.length - failures}/${results.length} checks passed`);
process.exit(failures === 0 ? 0 : 1);
