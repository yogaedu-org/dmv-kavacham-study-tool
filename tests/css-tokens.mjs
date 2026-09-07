#!/usr/bin/env node
/**
 * CSS custom-property contract guard (#40).
 *
 * A custom property that is USED but never DECLARED fails silently. Per the CSS
 * spec a `var(--nope)` with no fallback makes the whole declaration *invalid at
 * computed-value time*: the property falls back to its inherited/initial value
 * and the element just renders wrong. No browser warns. Nothing throws.
 *
 * Three named failures:
 *
 *   F1  Used-but-undeclared. Hit for real during the #32 autocomplete unit — a
 *       rule referenced `var(--accent-color)`; the real token is `--color-accent`.
 *       The keyboard focus cursor would have rendered invisible, silently.
 *
 *   F2  Declared only inside a theme override. styles.css has a base `:root` plus
 *       `@media (prefers-color-scheme: light)`, `:root[data-theme="light"]` and
 *       `:root[data-theme="dark"]`. A token added only to the dark block but used
 *       unconditionally looks right in dark and is broken in light.
 *
 *   F3  Built at RUNTIME from config.json. js/config.js does
 *       `setProperty('--color-' + cat.cssVar, col)`. Rename a category's `cssVar`
 *       — exactly the edit the config-driven registry (#8, #32) invites — and the
 *       colour is written to a token no stylesheet reads. No linter can see this:
 *       the token name only exists after string concatenation. js/render.js
 *       compounds it by inlining `var(--color-deity)` etc. into generated SVG
 *       markup, outside any stylesheet a linter would parse.
 *
 * Deliberately STRICT on fallbacks: `var(--x, #fff)` is treated as a usage that
 * must still be declared. This stylesheet has no fallback form today, and a name
 * typo'd behind a fallback silently serves the fallback forever — which is the
 * bug, not the cure.
 *
 * NOT a failure: a declared-but-unused token. Dead weight renders nothing wrong,
 * so it is reported as a note.
 *
 * The analysis is a pure function so the guard can prove it goes RED — the
 * self-checks below feed it synthetic broken input before the real files are read.
 *
 * Exit 0 = OK, exit 1 = failures listed. No dependencies (plain Node).
 *
 * Run:  node tests/css-tokens.mjs
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(here, '..');

/* ------------------------------------------------------------------ parsing */

// `/* ... */` is a comment in BOTH CSS and JS. Without this, a commented-out rule
// or a token named in prose counts as real usage.
const stripComments = (text) => text.replace(/\/\*[\s\S]*?\*\//g, ' ');

/**
 * Split a stylesheet into blocks, each tagged with its selector ancestry.
 * `@media (x) { :root { --a: 1 } }` yields path ['@media (x)', ':root'].
 * Only depends on braces, so it copes with this repo's flat + @media stylesheet.
 */
function parseBlocks(css) {
  const blocks = [];
  const stack = [];
  let buf = '';
  for (const ch of css) {
    if (ch === '{') {
      stack.push(buf.trim().replace(/\s+/g, ' '));
      buf = '';
    } else if (ch === '}') {
      blocks.push({ path: stack.slice(), body: buf });
      stack.pop();
      buf = '';
    } else {
      buf += ch;
    }
  }
  return blocks;
}

const declaredIn = (body) =>
  Array.from(body.matchAll(/(^|[;{])\s*(--[A-Za-z0-9_-]+)\s*:/g), (m) => m[2]);

const usedIn = (text) =>
  Array.from(text.matchAll(/var\(\s*(--[A-Za-z0-9_-]+)/g), (m) => m[1]);

/* ----------------------------------------------------------------- analysis */

/**
 * @param {{css: string, js?: string, categories?: Array<{key: string, cssVar?: string}>}} input
 * @returns {{declared: Set, base: Set, used: Set, undeclared: string[],
 *            themeOnly: string[], missingCategoryToken: string[], unused: string[]}}
 */
export function analyse({ css, js = '', categories = [] }) {
  const cleanCss = stripComments(css);
  const blocks = parseBlocks(cleanCss);

  const declared = new Set();
  const base = new Set();
  for (const block of blocks) {
    const names = declaredIn(block.body);
    names.forEach((n) => declared.add(n));
    // Base = the unconditional top-level `:root {` block. Not `@media`-wrapped,
    // not `:root[data-theme=...]`, not `:root:not(...)`.
    if (block.path.length === 1 && block.path[0] === ':root') names.forEach((n) => base.add(n));
  }

  const used = new Set([...usedIn(cleanCss), ...usedIn(stripComments(js))]);

  const undeclared = [...used].filter((n) => !declared.has(n)).sort();
  const themeOnly = [...used].filter((n) => declared.has(n) && !base.has(n)).sort();
  const unused = [...declared].filter((n) => !used.has(n)).sort();

  // F3: every category's runtime-built token must exist in the stylesheet.
  const missingCategoryToken = categories
    .filter((c) => c.cssVar)
    .map((c) => '--color-' + c.cssVar)
    .filter((token) => !declared.has(token))
    .sort();

  return { declared, base, used, undeclared, themeOnly, missingCategoryToken, unused };
}

/* --------------------------------------------------------------- self-check */
// A guard that lands green must demonstrate it can go red, or it proves nothing.

const SELF_CHECKS = [
  {
    name: 'F1 — flags a used-but-undeclared token',
    input: { css: ':root { --color-accent: #e4b25a; }\n.fs-btn:focus-visible { outline: 2px solid var(--accent-color); }' },
    ok: (r) => r.undeclared.join() === '--accent-color'
  },
  {
    name: 'F2 — flags a token declared only in a theme override',
    input: { css: ':root { --a: 1; }\n:root[data-theme="dark"] { --dusk: #000; }\n.x { color: var(--dusk); }' },
    ok: (r) => r.themeOnly.join() === '--dusk' && r.undeclared.length === 0
  },
  {
    name: 'F2 — a token in an @media-wrapped :root is not base',
    input: { css: ':root { --a: 1; }\n@media (prefers-color-scheme: light) { :root { --lit: #fff; } }\n.x { color: var(--lit); }' },
    ok: (r) => r.themeOnly.join() === '--lit'
  },
  {
    name: 'F3 — flags a config cssVar with no matching --color-* token',
    input: { css: ':root { --color-deity: #d9615a; }', categories: [{ key: 'deities', cssVar: 'deity' }, { key: 'mantras', cssVar: 'mantra' }] },
    ok: (r) => r.missingCategoryToken.join() === '--color-mantra'
  },
  {
    name: 'sees var() inlined in generated JS markup, not just CSS',
    input: { css: ':root { --a: 1; }', js: "p += '<circle fill=\"var(--color-ghost)\"/>';" },
    ok: (r) => r.undeclared.join() === '--color-ghost'
  },
  {
    name: 'a var() with a fallback still has to be declared',
    input: { css: ':root { --a: 1; }\n.x { color: var(--b, #fff); }' },
    ok: (r) => r.undeclared.join() === '--b'
  },
  {
    name: 'ignores tokens named inside comments',
    input: { css: ':root { --a: 1; }\n/* .x { color: var(--ghost); } */\n/* --ghost-decl: 1; */' },
    ok: (r) => r.undeclared.length === 0 && !r.declared.has('--ghost-decl')
  },
  {
    name: 'reports an unused token as a note, never a failure',
    input: { css: ':root { --used: 1; --dead: 2; }\n.x { color: var(--used); }' },
    ok: (r) => r.unused.join() === '--dead' && r.undeclared.length === 0 && r.themeOnly.length === 0
  },
  {
    name: 'clean input yields no findings at all',
    input: { css: ':root { --color-deity: #d00; }\n.x { color: var(--color-deity); }', categories: [{ key: 'deities', cssVar: 'deity' }] },
    ok: (r) => r.undeclared.length + r.themeOnly.length + r.missingCategoryToken.length + r.unused.length === 0
  }
];

const failures = [];
const fail = (msg) => failures.push(msg);

for (const c of SELF_CHECKS) {
  let result;
  try {
    result = analyse(c.input);
  } catch (e) {
    fail(`self-check "${c.name}" threw ${e.name}: ${e.message}`);
    continue;
  }
  if (!c.ok(result)) {
    fail(`self-check "${c.name}" did not detect what it should — got ${JSON.stringify({
      undeclared: result.undeclared, themeOnly: result.themeOnly,
      missingCategoryToken: result.missingCategoryToken, unused: result.unused
    })}`);
  }
}

if (failures.length) {
  console.error(`❌ CSS tokens: the guard itself is broken — ${failures.length} self-check failure(s)`);
  failures.forEach((f) => console.error(`   - ${f}`));
  process.exit(1);
}

/* ------------------------------------------------------------- the real app */

const css = fs.readFileSync(path.join(root, 'styles.css'), 'utf8');
// js/render.js inlines var() into generated SVG markup — outside the stylesheet.
const js = fs.readFileSync(path.join(root, 'js', 'render.js'), 'utf8');
const categories = JSON.parse(fs.readFileSync(path.join(root, 'config.json'), 'utf8')).categories || [];

const r = analyse({ css, js, categories });

for (const token of r.undeclared) {
  fail(`${token} is used but never declared — the declaration is invalid at computed-value time and renders silently wrong (F1)`);
}
for (const token of r.themeOnly) {
  fail(`${token} is declared only in a theme/@media override, never in the base :root — broken in the other theme (F2)`);
}
for (const token of r.missingCategoryToken) {
  const cat = categories.filter((c) => '--color-' + c.cssVar === token)[0];
  fail(`config.json category "${cat?.key}" has cssVar "${cat?.cssVar}", but styles.css declares no ${token} — js/config.js writes the colour to a token nothing reads (F3)`);
}

if (failures.length) {
  console.error(`❌ CSS tokens: ${failures.length} failure(s)`);
  failures.forEach((f) => console.error(`   - ${f}`));
  process.exit(1);
}

if (r.unused.length) {
  console.log(`ℹ️  declared but unused (not a failure): ${r.unused.join(', ')}`);
}
console.log(`✅ CSS tokens: ${r.used.size} used, ${r.declared.size} declared, all in the base :root; ${categories.length} config.json cssVar values resolve.`);
