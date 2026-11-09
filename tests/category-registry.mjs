#!/usr/bin/env node
/**
 * Category-registry resolution guard (#32).
 *
 * The named failure: `CONFIG.categories` is the single source of truth for the
 * DOM key -> state key mapping ('body' -> 'selectedBodyParts'), and it is
 * OVERRIDDEN AT RUNTIME by config.json — so it is data, editable without
 * touching code. `updateDropdownLabel()` reads the registry; but
 * handleFilterChange/addFilterTag/removeFilterTag used to re-derive the state key
 * by string munging (`'selected' + capitalize(type === 'body' ? 'bodyParts' : type)`).
 * Any registry entry whose stateKey is not exactly that munged spelling — a
 * renamed key, or a fourth category added to config.json — yielded `undefined`,
 * and the next `.indexOf()` threw a TypeError that killed the click handler,
 * while the label kept working. The two paths silently desynced.
 *
 * This pins the resolution through the registry, and pins config.json against
 * the AppState fields it names.
 *
 * Exit 0 = OK, exit 1 = failures listed. No dependencies (plain Node).
 *
 * Run:  node tests/category-registry.mjs
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(here, '..');

// Same data: URL trick as tests/autocomplete-keyboard.mjs — the repo has no
// package.json, so Node reads a bare `.js` as CommonJS and chokes on `export`.
// Safe only because js/state.js has NO relative imports. Keep it that way.
const src = fs.readFileSync(path.join(root, 'js', 'state.js'), 'utf8');
const state = await import('data:text/javascript;base64,' + Buffer.from(src).toString('base64'));

const { AppState, DEFAULT_CONFIG, CONFIG, setConfig, categoryByDomKey, selectedListFor } = state;

const failures = [];
const fail = (msg) => failures.push(msg);
function check(label, actual, expected) {
  if (actual !== expected) fail(`${label}: expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
}

for (const name of ['categoryByDomKey', 'selectedListFor']) {
  if (typeof state[name] !== 'function') fail(`js/state.js does not export ${name}()`);
}
if (failures.length) {
  console.error('❌ Category registry: missing exports');
  failures.forEach((f) => console.error(`   - ${f}`));
  process.exit(1);
}

/* ---- Every registry entry must name real AppState fields ---- */
// Catches a category added or renamed in config.json with no backing state.
for (const cat of DEFAULT_CONFIG.categories) {
  if (!Array.isArray(AppState[cat.stateKey])) fail(`category "${cat.key}": AppState.${cat.stateKey} is not an array`);
  if (!Array.isArray(AppState[cat.allKey])) fail(`category "${cat.key}": AppState.${cat.allKey} is not an array`);
}

/* ---- DOM keys must be unique, or a lookup silently picks the first ---- */
const domKeys = DEFAULT_CONFIG.categories.map((c) => c.domKey);
check('domKeys are unique', new Set(domKeys).size, domKeys.length);

/* ---- Resolution goes through the registry, for every category ---- */
for (const cat of DEFAULT_CONFIG.categories) {
  check(`categoryByDomKey('${cat.domKey}') finds its entry`, categoryByDomKey(cat.domKey)?.key, cat.key);
  check(
    `selectedListFor('${cat.domKey}') is AppState.${cat.stateKey}`,
    selectedListFor(cat.domKey) === AppState[cat.stateKey],
    true
  );
}

/* ---- The historical special case still resolves ---- */
check("selectedListFor('body') resolves to selectedBodyParts", selectedListFor('body') === AppState.selectedBodyParts, true);

/* ---- An unknown DOM key must yield null, never throw and never undefined ---- */
// Callers no-op on null; `undefined` used to reach `.indexOf()` and throw.
for (const bogus in { bodyParts: 1, nope: 1, '': 1 }) {
  let got;
  try {
    got = selectedListFor(bogus);
  } catch (e) {
    fail(`selectedListFor(${JSON.stringify(bogus)}) threw ${e.name}: ${e.message}`);
    continue;
  }
  check(`selectedListFor(${JSON.stringify(bogus)}) is null`, got, null);
}

/* ---- A stateKey the old munging could not have guessed still resolves ---- */
// This is the regression proper: prove the lookup follows the registry rather
// than reconstructing the name. 'selectedMantra' is not 'selected' + 'Mantras'.
const originalConfig = CONFIG;
try {
  AppState.selectedMantra = [];
  setConfig({
    ...DEFAULT_CONFIG,
    categories: [
      ...DEFAULT_CONFIG.categories,
      { key: 'mantras', dataField: 'mantras', stateKey: 'selectedMantra', allKey: 'allMantras', domKey: 'mantra', cssVar: 'mantra', label: 'Mantras', color: '#000', colorLight: '#000' }
    ]
  });
  check("selectedListFor('mantra') follows the registry's stateKey", selectedListFor('mantra') === AppState.selectedMantra, true);
} finally {
  setConfig(originalConfig);
  delete AppState.selectedMantra;
}

/* ---- config.json must agree with the code's default registry ---- */
// config.json overrides DEFAULT_CONFIG at runtime; a drift between them means the
// app behaves differently from everything asserted above.
const shipped = JSON.parse(fs.readFileSync(path.join(root, 'config.json'), 'utf8')).categories;
if (!Array.isArray(shipped)) {
  fail('config.json: "categories" must be an array');
} else {
  check('config.json category count matches DEFAULT_CONFIG', shipped.length, DEFAULT_CONFIG.categories.length);
  for (const cat of shipped) {
    const own = DEFAULT_CONFIG.categories.filter((c) => c.key === cat.key)[0];
    if (!own) {
      fail(`config.json category "${cat.key}" has no DEFAULT_CONFIG counterpart`);
      continue;
    }
    for (const field of ['dataField', 'stateKey', 'allKey', 'domKey', 'cssVar']) {
      check(`config.json "${cat.key}".${field}`, cat[field], own[field]);
    }
    if (!Array.isArray(AppState[cat.stateKey])) fail(`config.json "${cat.key}": AppState.${cat.stateKey} is not an array`);
  }
}

/* ---- Every dataField must exist on every verse ---- */
const verses = JSON.parse(fs.readFileSync(path.join(root, 'data', 'verses.json'), 'utf8')).verses;
for (const cat of DEFAULT_CONFIG.categories) {
  const missing = verses.filter((v) => !Array.isArray(v[cat.dataField])).map((v) => v.number ?? '?');
  if (missing.length) fail(`verses missing array field "${cat.dataField}": ${missing.join(', ')}`);
}

if (failures.length) {
  console.error(`❌ Category registry: ${failures.length} failure(s)`);
  failures.forEach((f) => console.error(`   - ${f}`));
  process.exit(1);
}

console.log('✅ Category registry: filter state resolves through the registry; config.json agrees with the code.');
