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
    const stringFields = ['sanskrit', 'transliteration', 'translation'];
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
    });
    // sequential 1..N
    for (let n = 1; n <= verses.length; n++) {
      if (!seen.has(n)) fail(`verses.json: missing verse number ${n}`);
    }
  }
}

/* ---- config.json ---- */
const config = readJson('config.json');
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

/* ---- report ---- */
if (errors.length) {
  console.error(`❌ Data validation FAILED (${errors.length}):`);
  errors.forEach((e) => console.error('  - ' + e));
  process.exit(1);
}
console.log('✅ Data validation passed: verses.json + config.json are well-formed.');
process.exit(0);
