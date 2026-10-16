#!/usr/bin/env node
/**
 * Controls-panel clipping guard (#43).
 *
 * The filter lists (Deities / Directions / Body) and the search suggestions
 * are `position: absolute` children of `.controls`. They open DOWNWARD, past
 * the panel's bottom edge. If `.controls` clips its overflow, the list opens
 * but only its top ~15 px is drawn and clicks fall through to the verse
 * beneath — nothing can be seen or selected. That shipped live (#43).
 *
 * Two named failures:
 *
 *   F1  A `.controls` rule declares overflow hidden/clip/auto/scroll, which
 *       clips the absolutely-positioned lists.
 *
 *   F2  A popup list hard-codes its background instead of using a theme
 *       token. The old navy `rgba(22,33,62,.95)` made light-theme items
 *       dark-on-navy, i.e. unreadable.
 *
 * Static CSS check: no browser needed, runs alongside the other tests.
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

/** Innermost CSS rules as {selectors[], decls{}}; comments stripped. */
export function parseRules(css) {
  const rules = [];
  const re = /([^{}]+)\{([^{}]*)\}/g;
  for (const m of css.replace(/\/\*[\s\S]*?\*\//g, '').matchAll(re)) {
    const decls = {};
    for (const d of m[2].split(';')) {
      const i = d.indexOf(':');
      if (i > 0) decls[d.slice(0, i).trim()] = d.slice(i + 1).trim();
    }
    rules.push({ selectors: m[1].split(',').map(s => s.trim()), decls });
  }
  return rules;
}

const CLIPPING = /^(hidden|clip|auto|scroll)\b/;
const POPUPS = ['.dropdown-content', '.autocomplete-dropdown'];

export function check(css) {
  const errors = [];
  for (const r of parseRules(css)) {
    if (r.selectors.includes('.controls')) {
      for (const p of ['overflow', 'overflow-y']) {
        if (CLIPPING.test(r.decls[p] || '')) {
          errors.push(`F1 .controls has ${p}: ${r.decls[p]} — clips the filter/search popups`);
        }
      }
    }
    for (const sel of POPUPS) {
      if (r.selectors.includes(sel) && r.decls.background && !r.decls.background.includes('var(')) {
        errors.push(`F2 ${sel} background is hard-coded (${r.decls.background}) — use a theme token`);
      }
    }
  }
  return errors;
}

// Self-checks: the guard must fail on the broken shape before it is trusted.
const selfChecks = [
  ['.controls { position: sticky; overflow: hidden; }', 'F1'],
  ['.a, .controls { overflow-y: auto }', 'F1'],
  ['.dropdown-content { background: rgba(22, 33, 62, 0.95); }', 'F2'],
];
for (const [css, want] of selfChecks) {
  if (!check(css).some(e => e.startsWith(want))) {
    console.error(`self-check failed: expected ${want} for: ${css}`);
    process.exit(2);
  }
}
if (check('.controls.compact { overflow: hidden } .controls { overflow: visible }').length) {
  console.error('self-check failed: false positive on .controls.compact / overflow: visible');
  process.exit(2);
}

const errors = check(readFileSync(join(root, 'styles.css'), 'utf8'));
if (errors.length) {
  for (const e of errors) console.error('FAIL', e);
  process.exit(1);
}
console.log('controls-overflow: OK (popups can extend past .controls; backgrounds themed)');
