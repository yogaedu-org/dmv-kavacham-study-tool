#!/usr/bin/env node
/**
 * Autocomplete keyboard-navigation guard (#32).
 *
 * The named failure: the search box declares `role="combobox"` and
 * `showAutocomplete()` sets `aria-expanded="true"`, but the only key ever handled
 * was Escape — so a keyboard-only or screen-reader user was told a listbox had
 * opened and then could not reach a single suggestion. This pins the pure index
 * walk that drives the fix, so the wrap-around and the "nothing active yet" entry
 * points cannot silently regress.
 *
 * Exit 0 = OK, exit 1 = failures listed. No dependencies (plain Node).
 *
 * Run:  node tests/autocomplete-keyboard.mjs
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const utilPath = path.join(here, '..', 'js', 'util.js');

// The repo has no package.json, so Node reads a bare `.js` as CommonJS and chokes on
// `export`. Importing the source as a data: URL forces ESM parsing without adding a
// build config. Safe only because js/util.js has NO relative imports — a data: URL
// has no base to resolve them against. Keep it that way.
const src = fs.readFileSync(utilPath, 'utf8');
const util = await import('data:text/javascript;base64,' + Buffer.from(src).toString('base64'));

const { nextActiveIndex } = util;

const failures = [];
function check(label, actual, expected) {
  if (actual !== expected) failures.push(`${label}: expected ${expected}, got ${actual}`);
}

if (typeof nextActiveIndex !== 'function') {
  console.error('❌ js/util.js does not export nextActiveIndex()');
  process.exit(1);
}

const DOWN = 'ArrowDown';
const UP = 'ArrowUp';

/* ---- Entry from "nothing active" (-1) ---- */
check('ArrowDown from -1 lands on the first item', nextActiveIndex(-1, 5, DOWN), 0);
check('ArrowUp from -1 lands on the last item', nextActiveIndex(-1, 5, UP), 4);

/* ---- Ordinary walk ---- */
check('ArrowDown advances', nextActiveIndex(0, 5, DOWN), 1);
check('ArrowUp retreats', nextActiveIndex(3, 5, UP), 2);

/* ---- Wrap-around in both directions ---- */
check('ArrowDown past the end wraps to the first', nextActiveIndex(4, 5, DOWN), 0);
check('ArrowUp past the start wraps to the last', nextActiveIndex(0, 5, UP), 4);

/* ---- Single-item list: both keys stay put, never go out of range ---- */
check('ArrowDown on a 1-item list stays on it', nextActiveIndex(0, 1, DOWN), 0);
check('ArrowUp on a 1-item list stays on it', nextActiveIndex(0, 1, UP), 0);

/* ---- Empty list: never return an index into nothing ---- */
check('ArrowDown on an empty list yields -1', nextActiveIndex(-1, 0, DOWN), -1);
check('ArrowUp on an empty list yields -1', nextActiveIndex(0, 0, UP), -1);

/* ---- A stale index (list shrank under us) must not escape the range ---- */
check('stale index past the end wraps forward to 0', nextActiveIndex(9, 3, DOWN), 0);
check('stale index past the end walks back into range', nextActiveIndex(9, 3, UP), 2);

/* ---- Unrelated keys leave the selection alone ---- */
check('Enter does not move the cursor', nextActiveIndex(2, 5, 'Enter'), 2);
check('Escape does not move the cursor', nextActiveIndex(2, 5, 'Escape'), 2);
check('a printable key does not move the cursor', nextActiveIndex(2, 5, 'a'), 2);

if (failures.length) {
  console.error(`❌ Autocomplete keyboard navigation: ${failures.length} failure(s)`);
  failures.forEach((f) => console.error(`   - ${f}`));
  process.exit(1);
}

console.log('✅ Autocomplete keyboard navigation: index walk wraps and clamps correctly.');
