#!/usr/bin/env node
/**
 * Correction-form prefill contract guard (#41).
 *
 * The "Suggest a correction" link hands GitHub a URL carrying `language` and
 * `verse` query parameters. A GitHub issue *form* prefills a field from the
 * parameter named after that field's `id` — and a **dropdown only takes the
 * value when it matches one of its `options` EXACTLY**. A near-miss is not an
 * error: GitHub drops it, renders the field blank, and nobody is told. The
 * contract therefore lives in two files that no compiler relates to each other —
 * `js/util.js` builds the strings, `.github/ISSUE_TEMPLATE/translation-
 * correction.yml` defines what is acceptable — so only a test can hold them
 * together.
 *
 * Five named failures:
 *
 *   F1  A locale ships with no mapping. `config.json` lists the app's locales;
 *       add a fourth without a FEEDBACK_LANGUAGE_OPTIONS entry and that
 *       language's readers get no prefill at all.
 *
 *   F2  A mapped language string drifts from the .yml option. Reword
 *       "Nepali (नेपाली)" in the template — the obvious, harmless-looking edit —
 *       and every Nepali correction arrives with Language blank.
 *
 *   F3  A verse exists in the data that the template does not offer. The
 *       dropdown enumerates Verse 1..14 by hand; `data/verses.json` is the
 *       source of truth. Add verse 15 and its prefill silently drops.
 *
 *   F4  The unresolved-state fallback is not an option. `General / other` is a
 *       literal in js/util.js; it must remain a literal in the .yml.
 *
 *   F5  A field `id` is renamed. The parameter names ARE the ids. Rename
 *       `verse` to `verse_number` in the template and the parameter is ignored.
 *
 * Also asserts the deliberate non-prefill: an unmappable locale must return the
 * BARE template URL, carrying no `language`/`verse` at all. A wrong prefill is
 * worse than none — it puts words in a reporter's mouth.
 *
 * The parser is a pure function, and the self-checks below feed it synthetic
 * broken input before the real files are read: a guard that lands green must
 * prove it can go red.
 *
 * Exit 0 = OK, exit 1 = failures listed. No dependencies (plain Node).
 *
 * Run:  node tests/feedback-prefill.mjs
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  buildFeedbackUrl,
  FEEDBACK_LANGUAGE_OPTIONS,
  FEEDBACK_VERSE_FALLBACK
} from '../js/util.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(here, '..');

/* ------------------------------------------------------------------ parsing */

const indentOf = (line) => line.length - line.trimStart().length;
const unquote = (value) => value.replace(/^(['"])([\s\S]*)\1$/, '$2');

/**
 * Field ids and dropdown options from a GitHub issue-form .yml.
 * Deliberately minimal — it only needs `id:` and `options:` list items, so it
 * carries no YAML dependency into a repo that has none.
 * @param {string} yml
 * @returns {{ids: string[], options: Record<string, string[]>}}
 */
export function parseIssueForm(yml) {
  const ids = [];
  const options = {};
  let currentId = null;
  let optionIndent = null;

  for (const raw of yml.split(/\r?\n/)) {
    const line = raw.replace(/\s+$/, '');
    if (!line.trim()) continue;

    // An options list ends as soon as indentation returns to or above `options:`.
    if (optionIndent !== null && indentOf(line) <= optionIndent) optionIndent = null;

    if (optionIndent !== null) {
      const item = line.trim().match(/^-\s+(.*)$/);
      if (item) options[currentId].push(unquote(item[1].trim()));
      continue;
    }

    const idMatch = line.trim().match(/^id:\s*(.+)$/);
    if (idMatch) {
      currentId = unquote(idMatch[1].trim());
      ids.push(currentId);
      continue;
    }

    if (currentId && /^options:\s*$/.test(line.trim())) {
      options[currentId] = [];
      optionIndent = indentOf(line);
    }
  }

  return { ids, options };
}

/* --------------------------------------------------------------- self-check */

const failures = [];
const fail = (msg) => failures.push(msg);

const SAMPLE_YML = [
  'body:',
  '  - type: dropdown',
  '    id: language',
  '    attributes:',
  '      label: Language',
  '      options:',
  '        - Nepali (नेपाली)',
  '        - English',
  '    validations:',
  '      required: true',
  '  - type: dropdown',
  '    id: verse',
  '    attributes:',
  '      options:',
  '        - "Verse 1"',
  '        - "General / other"',
  '  - type: input',
  '    id: name',
  '    attributes:',
  '      label: Your name (optional)',
  ''
].join('\n');

const BASE = 'https://example.test/issues/new?template=translation-correction.yml';
const paramsOf = (url) => new URL(url).searchParams;

const SELF_CHECKS = [
  {
    name: 'parser reads every field id, dropdown or not',
    ok: () => parseIssueForm(SAMPLE_YML).ids.join() === 'language,verse,name'
  },
  {
    name: 'parser reads options and strips YAML quoting',
    ok: () => {
      const { options } = parseIssueForm(SAMPLE_YML);
      return options.language.join('|') === 'Nepali (नेपाली)|English' &&
             options.verse.join('|') === 'Verse 1|General / other';
    }
  },
  {
    name: 'parser stops an options list at the next key, not the next dash',
    ok: () => !parseIssueForm(SAMPLE_YML).options.language.includes('required: true')
  },
  {
    name: 'a field with no options list is absent from options',
    ok: () => parseIssueForm(SAMPLE_YML).options.name === undefined
  },
  {
    name: 'builder emits the mapped option string, not the locale code',
    ok: () => paramsOf(buildFeedbackUrl(BASE, 'ne', 7)).get('language') === 'Nepali (नेपाली)'
  },
  {
    name: 'builder emits "Verse N" for a verse in view',
    ok: () => paramsOf(buildFeedbackUrl(BASE, 'en', 7)).get('verse') === 'Verse 7'
  },
  {
    name: 'an unresolved verse falls back to the template option, not to nothing',
    ok: () => [null, undefined, 0, 'x', NaN].every(
      (v) => paramsOf(buildFeedbackUrl(BASE, 'en', v)).get('verse') === FEEDBACK_VERSE_FALLBACK
    )
  },
  {
    name: 'an unmappable locale yields the BARE template URL — no wrong prefill',
    ok: () => ['fr', '', null, undefined].every((loc) => buildFeedbackUrl(BASE, loc, 3) === BASE)
  },
  {
    name: 'a malformed base URL is returned untouched rather than thrown on',
    ok: () => buildFeedbackUrl('not a url', 'en', 3) === 'not a url'
  },
  {
    name: 'values are URL-encoded, so Devanāgarī and "/" survive the round trip',
    ok: () => {
      const url = buildFeedbackUrl(BASE, 'ne', null);
      return !/[नप]/.test(url) && paramsOf(url).get('verse') === FEEDBACK_VERSE_FALLBACK;
    }
  }
];

for (const check of SELF_CHECKS) {
  let passed;
  try {
    passed = check.ok();
  } catch (e) {
    fail(`self-check "${check.name}" threw ${e.name}: ${e.message}`);
    continue;
  }
  if (!passed) fail(`self-check "${check.name}" did not hold`);
}

if (failures.length) {
  console.error(`❌ Feedback prefill: the guard itself is broken — ${failures.length} self-check failure(s)`);
  failures.forEach((f) => console.error(`   - ${f}`));
  process.exit(1);
}

/* ------------------------------------------------------------- the real app */

const template = fs.readFileSync(
  path.join(root, '.github', 'ISSUE_TEMPLATE', 'translation-correction.yml'), 'utf8');
const { ids, options } = parseIssueForm(template);
const config = JSON.parse(fs.readFileSync(path.join(root, 'config.json'), 'utf8'));
const verses = JSON.parse(fs.readFileSync(path.join(root, 'data', 'verses.json'), 'utf8')).verses;
const baseUrl = config.app.feedbackUrl;

// F5 — the parameter names are the field ids.
for (const id of ['language', 'verse']) {
  if (ids.indexOf(id) === -1) {
    fail(`the built URL sets "${id}", but the template has no field with that id — GitHub ignores the parameter (F5)`);
  } else if (!options[id]) {
    fail(`field "${id}" is no longer a dropdown with options — the exact-match contract this guard checks no longer applies (F5)`);
  }
}

if (!failures.length) {
  // F1 — every configured locale must be mappable.
  for (const locale of config.app.locales) {
    if (!FEEDBACK_LANGUAGE_OPTIONS[locale]) {
      fail(`config.json ships locale "${locale}", but FEEDBACK_LANGUAGE_OPTIONS in js/util.js has no entry — its readers get no language prefill (F1)`);
    }
  }

  // F2 — every emitted language value must be an exact option.
  for (const locale of Object.keys(FEEDBACK_LANGUAGE_OPTIONS)) {
    const emitted = new URL(buildFeedbackUrl(baseUrl, locale, 1)).searchParams.get('language');
    if (options.language.indexOf(emitted) === -1) {
      fail(`locale "${locale}" emits language=${JSON.stringify(emitted)}, which the template does not offer — the dropdown drops it silently. Template offers: ${options.language.map((o) => JSON.stringify(o)).join(', ')} (F2)`);
    }
  }

  // F3 — every verse in the data must be an exact option.
  for (const verse of verses) {
    const emitted = new URL(buildFeedbackUrl(baseUrl, 'en', verse.number)).searchParams.get('verse');
    if (options.verse.indexOf(emitted) === -1) {
      fail(`verses.json has verse ${verse.number}, which emits verse=${JSON.stringify(emitted)} — the template's dropdown does not offer it, so the prefill drops silently (F3)`);
    }
  }

  // F4 — the unresolved-state fallback must be an exact option.
  if (options.verse.indexOf(FEEDBACK_VERSE_FALLBACK) === -1) {
    fail(`FEEDBACK_VERSE_FALLBACK is ${JSON.stringify(FEEDBACK_VERSE_FALLBACK)}, which the template's verse dropdown does not offer — a verse-less click prefills nothing (F4)`);
  }

  // The deliberate non-prefill, against the real configured URL.
  if (buildFeedbackUrl(baseUrl, 'zz', 3) !== baseUrl) {
    fail('an unmappable locale must yield the bare template URL — a wrong prefill is worse than none');
  }
}

if (failures.length) {
  console.error(`❌ Feedback prefill: ${failures.length} failure(s)`);
  failures.forEach((f) => console.error(`   - ${f}`));
  process.exit(1);
}

console.log(`✅ Feedback prefill: ${config.app.locales.length} locales and ${verses.length} verses map to options the template actually offers (${options.language.length} language, ${options.verse.length} verse).`);
