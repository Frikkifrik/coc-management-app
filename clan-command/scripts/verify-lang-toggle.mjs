/**
 * Real-cascade check for the AF/EN language pill.
 *
 * The smoke suite can only assert that React puts the right class names on the
 * DOM. That was never the bug: the classes were always correct, but a
 * `.clash-app button { background: none }` reset outranked `bg-[#2563EB]` and
 * silently painted the highlight away. Only a real stylesheet cascade can catch
 * that, so this script loads the *built* CSS into jsdom and reads
 * getComputedStyle().backgroundColor off the mounted buttons.
 *
 *   npm run build && npm run verify:lang
 */
import { build } from 'esbuild';
import { globSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
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

// The compiled Tailwind sheet — this is the stylesheet the browser actually
// loads, arbitrary utilities and all.
const cssFiles = globSync('dist/assets/main-*.css', { cwd: root });
if (!cssFiles.length) {
  console.error('no built CSS found — run `npm run build` first');
  process.exit(2);
}
const css = readFileSync(path.join(root, cssFiles[0]), 'utf8');

const workdir = mkdtempSync(path.join(tmpdir(), 'clash-lang-'));
const outfile = path.join(workdir, 'bundle.mjs');
const entry = `
import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './src/app';
export { React, createRoot, App };
`;

await build({
  stdin: { contents: entry, resolveDir: root, sourcefile: 'entry.tsx', loader: 'tsx' },
  bundle: true,
  format: 'esm',
  platform: 'node',
  outfile,
  jsx: 'automatic',
  logLevel: 'silent',
  external: ['jsdom'],
});

globalThis.IS_REACT_ACT_ENVIRONMENT = true;
const mod = await import(pathToFileURL(outfile).href);
const { React, createRoot, App } = mod;

// localStorage shim, same keys the app persists to.
const store = new Map();
globalThis.localStorage = {
  getItem: (k) => (store.has(k) ? store.get(k) : null),
  setItem: (k, v) => store.set(k, String(v)),
  removeItem: (k) => store.delete(k),
  clear: () => store.clear(),
  key: (i) => [...store.keys()][i] ?? null,
  get length() { return store.size; },
};

const dom = new JSDOM('<!doctype html><html><body><div id="app"></div></body></html>', {
  pretendToBeVisual: true,
  url: 'http://localhost/',
});
const { window } = dom;
// The built sheet, injected the way a <link> would be.
const style = window.document.createElement('style');
style.textContent = css;
window.document.head.appendChild(style);

for (const key of ['HTMLElement', 'Element', 'Node', 'Event', 'MouseEvent', 'getComputedStyle']) {
  globalThis[key] ??= window[key];
}
Object.defineProperty(globalThis, 'navigator', { value: window.navigator, configurable: true });
Object.defineProperty(globalThis, 'document', { value: window.document, configurable: true });
globalThis.window = window;
globalThis.localStorage = window.localStorage;

const host = window.document.getElementById('app');
const root2 = createRoot(host);
await React.act(async () => { // The real root: App owns the LanguageProvider. Rendering bare ClashApp would
// hit useI18n()'s outside-the-provider fallback (lang 'en', no-op setLang) and
// the toggle would never respond.
              root2.render(React.createElement(App)); });

// jsdom reports the utility's raw value, `rgb(37 99 235 / var(--tw-bg-opacity, 1))`,
// without resolving the var, so match on the channel triple.
const isRoyal = (v) => v.replace(/\s+/g, ' ').includes('rgb(37 99 235');
const CLEAR = ['rgba(0, 0, 0, 0)', 'transparent', ''];
let failures = 0;
const check = (name, fn) => {
  try {
    const r = fn();
    if (r === true) { console.log(`PASS  ${name}`); return; }
    failures += 1;
    console.log(`FAIL  ${name} — ${r}`);
  } catch (e) {
    failures += 1;
    console.log(`FAIL  ${name} — threw ${e.message}`);
  }
};

const pill = (label) => host.querySelector(`button[aria-label="${label}"]`);
const bgOf = (label) => window.getComputedStyle(pill(label)).backgroundColor;
const click = (label) =>
  React.act(async () => {
    pill(label).dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
  });

console.log(`\ncascade source: ${cssFiles[0]}\n`);

check('the stylesheet actually defines the royal-blue utility', () =>
  css.includes('.bg-\\[\\#2563EB\\]') ? true : 'utility missing from the built CSS');

check('AF starts active with a painted royal-blue background', () =>
  isRoyal(bgOf('Afrikaans')) ? true : `computed background is ${bgOf('Afrikaans')}`);
check('EN starts inactive and transparent', () =>
  CLEAR.includes(bgOf('English')) ? true : `computed background is ${bgOf('English')}`);

await click('English');

check('clicking EN moves the royal blue to EN', () =>
  isRoyal(bgOf('English')) ? true : `computed background is ${bgOf('English')}`);
check('and clears it from AF', () =>
  CLEAR.includes(bgOf('Afrikaans')) ? true : `computed background is ${bgOf('Afrikaans')}`);

await click('Afrikaans');

check('clicking AF moves the royal blue back', () =>
  isRoyal(bgOf('Afrikaans')) ? true : `computed background is ${bgOf('Afrikaans')}`);
check('and clears it from EN again', () =>
  CLEAR.includes(bgOf('English')) ? true : `computed background is ${bgOf('English')}`);

check('aria-pressed tracks the same state as the paint', () =>
  pill('Afrikaans').getAttribute('aria-pressed') === 'true' &&
  pill('English').getAttribute('aria-pressed') === 'false' ? true : 'aria-pressed out of step');

await React.act(async () => { root2.unmount(); });
rmSync(workdir, { recursive: true, force: true });

console.log(`\n${failures === 0 ? 'all cascade checks passed' : `${failures} cascade check(s) FAILED`}\n`);
process.exit(failures === 0 ? 0 : 1);
