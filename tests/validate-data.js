#!/usr/bin/env node
/**
 * Data validation guard (#11).
 * Validates data/verses.json and config.json against the shape the app relies on.
 * Exit 0 = OK, exit 1 = failures listed. No dependencies (plain Node).
 *
 * Run:  node tests/validate-data.js
 */
'use strict';

const fs = require('fs');
const path = require('path');
const root = path.join(__dirname, '..');

const errors = [];
const fail = (msg) => errors.push(msg);

function readJson(rel) {
  try {
    return JSON.parse(fs.readFileSync(path.join(root, rel), 'utf8'));
  } catch (e) {
    fail(`${rel}: cannot read/parse — ${e.message}`);
    return null;
  }
}

/* ---- config.json (read first: verse validation needs the locale list) ---- */
const config = readJson('config.json');
const locales = (config && config.app && config.app.locales) || ['en'];
const defaultLocale = (config && config.app && config.app.defaultLocale) || 'en';
const localeGaps = [];

/* ---- verses.json ---- */
const data = readJson('data/verses.json');
if (data) {
  if (typeof data.metadata !== 'object' || data.metadata === null) fail('verses.json: missing "metadata" object');
  if (!Array.isArray(data.verses)) {
    fail('verses.json: "verses" must be an array');
  } else {
    const verses = data.verses;
    if (data.metadata && data.metadata.totalVerses !== verses.length) {
      fail(`verses.json: metadata.totalVerses (${data.metadata && data.metadata.totalVerses}) != verses.length (${verses.length})`);
    }
    const seen = new Set();
    const stringFields = ['sanskrit', 'transliteration'];
    const arrayFields = ['deities', 'directions', 'bodyParts'];
    verses.forEach((v, i) => {
      const at = `verses.json: verse[${i}]`;
      if (!Number.isInteger(v.number)) fail(`${at}: "number" must be an integer`);
      else {
        if (seen.has(v.number)) fail(`${at}: duplicate number ${v.number}`);
        seen.add(v.number);
      }
      stringFields.forEach((f) => {
        if (typeof v[f] !== 'string' || v[f].trim() === '') fail(`${at} (#${v.number}): "${f}" must be a non-empty string`);
      });
      arrayFields.forEach((f) => {
        if (!Array.isArray(v[f])) fail(`${at} (#${v.number}): "${f}" must be an array`);
      });
      // i18n (#25): translations is a locale map; the default locale is required,
      // other configured locales are reported as gaps (drafts land later, not an error).
      if (typeof v.translations !== 'object' || v.translations === null || Array.isArray(v.translations)) {
        fail(`${at} (#${v.number}): "translations" must be an object (locale map)`);
      } else if (typeof v.translations[defaultLocale] !== 'string' || v.translations[defaultLocale].trim() === '') {
        fail(`${at} (#${v.number}): translations.${defaultLocale} (default locale) must be a non-empty string`);
      } else {
        locales.forEach((loc) => {
          if (loc !== defaultLocale && !v.translations[loc]) localeGaps.push(`${loc}: verse ${v.number}`);
        });
      }
    });
    // sequential 1..N
    for (let n = 1; n <= verses.length; n++) {
      if (!seen.has(n)) fail(`verses.json: missing verse number ${n}`);
    }
  }
}

/* ---- config.json checks (already read above) ---- */
if (config) {
  if (!config.app || typeof config.app.version !== 'string') fail('config.json: missing app.version (string)');
  if (!Array.isArray(config.categories) || config.categories.length === 0) {
    fail('config.json: "categories" must be a non-empty array');
  } else {
    const required = ['key', 'dataField', 'domKey', 'cssVar', 'color'];
    config.categories.forEach((c, i) => {
      required.forEach((k) => {
        if (typeof c[k] !== 'string' || c[k] === '') fail(`config.json: categories[${i}] missing "${k}"`);
      });
    });
  }
}

/* ---- i18n locale files (#25) ---- */
locales.forEach((loc) => {
  const rel = `i18n/${loc}.json`;
  if (!fs.existsSync(path.join(root, rel))) {
    fail(`${rel}: missing locale file (config.app.locales lists "${loc}")`);
    return;
  }
  const l = readJson(rel);
  if (l && typeof l.ui !== 'object') fail(`${rel}: "ui" must be an object`);
  if (l && typeof l.terms !== 'object') fail(`${rel}: "terms" must be an object`);
});

/* ---- content regression guards (named failures we've already hit) ---- */
if (data && Array.isArray(data.verses)) {
  const v = data.verses;
  const byNum = (n) => v.find((x) => x.number === n);

  // #28/#4: verse 10 had a duplicated उग्रतारा (dittography). Guard it can't return.
  const v10 = byNum(10);
  if (v10 && typeof v10.sanskrit === 'string') {
    const hits = (v10.sanskrit.match(/उग्रतारा/g) || []).length;
    if (hits !== 1) fail(`verse 10: expected exactly one "उग्रतारा", found ${hits} (the removed repeat must not return)`);
    if (!/\nगुदं/.test(v10.sanskrit)) fail('verse 10: line 2 must begin with "गुदं" (no leading उग्रतारा repeat)');
  }

  // #28: verse 6 chant text follows the निल consensus (short i), not नील.
  const v6 = byNum(6);
  if (v6 && typeof v6.sanskrit === 'string') {
    if (v6.sanskrit.indexOf('निलसरस्वती') === -1) fail('verse 6: chant text must read "निलसरस्वती" (#28 consensus)');
    if (v6.sanskrit.indexOf('नीलसरस्वती') !== -1) fail('verse 6: chant text must NOT read "नीलसरस्वती" (that was the outlier; #28)');
  }

  // Format: every verse ends with a double-daṇḍa + Devanāgarī numeral + double-daṇḍa (॥N॥).
  v.forEach((x) => {
    if (typeof x.sanskrit === 'string' && !/॥[०-९]+॥\s*$/.test(x.sanskrit.trim())) {
      fail(`verse ${x.number}: sanskrit must end with ॥<Devanāgarī-numeral>॥`);
    }
  });
}

/* ---- i18n key PARITY across locales (structure must match; prose may lag) ---- */
(() => {
  const leaves = (obj, prefix, out) => {
    Object.keys(obj || {}).forEach((k) => {
      const val = obj[k];
      if (val && typeof val === 'object' && !Array.isArray(val)) leaves(val, prefix + k + '.', out);
      else out.push(prefix + k);
    });
    return out;
  };
  const ref = readJson(`i18n/${defaultLocale}.json`);
  if (!ref) return;
  const refUi = leaves(ref.ui, '', []).sort();
  const refTerms = leaves(ref.terms, '', []).sort();
  locales.forEach((loc) => {
    if (loc === defaultLocale) return;
    const l = readJson(`i18n/${loc}.json`);
    if (!l) return;
    const uiKeys = new Set(leaves(l.ui, '', []));
    const termKeys = new Set(leaves(l.terms, '', []));
    refUi.forEach((k) => { if (!uiKeys.has(k)) fail(`i18n/${loc}.json: missing ui key "${k}" (present in ${defaultLocale})`); });
    refTerms.forEach((k) => { if (!termKeys.has(k)) fail(`i18n/${loc}.json: missing terms key "${k}" (present in ${defaultLocale})`); });
  });
})();

/* ---- source drift guard: the #25/#1 translation-search bug must not return ---- */
(() => {
  // #10: app.js was split into ES modules under js/; scan them all (concatenated).
  const dir = path.join(root, 'js');
  let src;
  try {
    src = fs.readdirSync(dir)
      .filter((f) => f.endsWith('.js'))
      .map((f) => fs.readFileSync(path.join(dir, f), 'utf8'))
      .join('\n');
  } catch (e) { return; }
  // verse.translation (singular) is the pre-#25 field; search must use verse.translations.
  if (/verse\.translation\b(?!s)/.test(src)) {
    fail('js/*.js: reference to singular "verse.translation" — field is "translations" (locale map) since #25; search breaks. See #11/#1.');
  }
})();

/* ---- module-graph guard (#10): every js/ import must resolve to a real export ----
   Named failure: after the ES-module split, renaming/removing an export without
   updating its importers is a silent runtime break (blank app, console ReferenceError). */
(() => {
  const dir = path.join(root, 'js');
  let files;
  try { files = fs.readdirSync(dir).filter((f) => f.endsWith('.js')); } catch (e) { return; }
  const exportsOf = {}, importsOf = {};
  files.forEach((f) => {
    const src = fs.readFileSync(path.join(dir, f), 'utf8');
    const ex = new Set();
    let m;
    const reDecl = /export\s+(?:async\s+)?(?:function|const|let|var|class)\s+([A-Za-z0-9_$]+)/g;
    while ((m = reDecl.exec(src))) ex.add(m[1]);
    const reList = /export\s*\{([^}]*)\}/g;
    while ((m = reList.exec(src))) m[1].split(',').forEach((p) => { const n = p.trim().split(/\s+as\s+/).pop().trim(); if (n) ex.add(n); });
    exportsOf[f] = ex;
    const imps = [];
    const reImp = /import\s*\{([^}]*)\}\s*from\s*['"]\.\/([^'"]+)['"]/g;
    while ((m = reImp.exec(src))) {
      let target = m[2]; if (!target.endsWith('.js')) target += '.js';
      m[1].split(',').forEach((p) => { const n = p.trim().split(/\s+as\s+/)[0].trim(); if (n) imps.push([n, target]); });
    }
    importsOf[f] = imps;
  });
  files.forEach((f) => {
    importsOf[f].forEach(([name, target]) => {
      if (!exportsOf[target]) fail(`js/${f}: imports "${name}" from missing module ./${target}`);
      else if (!exportsOf[target].has(name)) fail(`js/${f}: imports "${name}" from ./${target} — not exported there (refactor drift)`);
    });
  });
})();

/* ---- report ---- */
if (localeGaps.length) {
  // Not a failure: draft locales fill in during P2; en always backstops the UI.
  const byLocale = localeGaps.reduce((acc, g) => {
    const loc = g.split(':')[0];
    acc[loc] = (acc[loc] || 0) + 1;
    return acc;
  }, {});
  console.log('ℹ️  translation gaps (fall back to ' + defaultLocale + '):',
    Object.entries(byLocale).map(([l, n]) => `${l}=${n}`).join(' '));
}

if (errors.length) {
  console.error(`❌ Data validation FAILED (${errors.length}):`);
  errors.forEach((e) => console.error('  - ' + e));
  process.exit(1);
}
console.log('✅ Data validation passed: verses.json + config.json are well-formed.');
process.exit(0);
