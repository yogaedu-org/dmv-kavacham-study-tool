#!/usr/bin/env node
/**
 * Recitation-set data guard (#56).
 *
 * audio/sets/index.json + audio/sets/<set>/manifest.json are the ONLY place that says which audio exists, so
 * adding a set (Day 5, another reciter) is a data change. That is safe only while the data stays well-formed.
 * Named failures:
 *
 *   F1  The index has no recommended set, or two: the app picks the wrong default (or an arbitrary one).
 *   F2  An index entry points at a manifest that does not exist: the switcher offers a set that cannot load.
 *   F3  A manifest misses a verse that exists in data/verses.json: that verse's button says "no audio" for the whole set.
 *   F4  A manifest entry has no key, or a sha256/bytes that is not well-formed: integrity checking silently becomes impossible.
 *   F5  An audio file was committed to git (#48: audio lives outside git): the repo grows 3 MB per set.
 *   F6  A js/ module hard-codes a clip URL or host: swapping the cloud would then need a code change.
 *
 * The self-check feeds the validator a broken set first: a guard that cannot fail proves nothing.
 *
 * Run:  node tests/audio-sets.mjs
 */
import { readFileSync, existsSync, readdirSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const readJson = (rel) => JSON.parse(readFileSync(join(root, rel), 'utf8'));

export function validateSets(index, manifests, verseNumbers) {
  const errors = [];
  const rec = (index.sets || []).filter((s) => s.recommended);
  if (rec.length !== 1) errors.push(`F1: expected exactly one recommended set, found ${rec.length}`);
  for (const s of index.sets || []) {
    const m = manifests[s.id];
    if (!m) { errors.push(`F2: set "${s.id}": manifest ${s.manifest} missing`); continue; }
    if (m.set !== s.id) errors.push(`F2: set "${s.id}": manifest says set "${m.set}"`);
    for (const n of verseNumbers) {
      const e = (m.verses || {})[String(n)];
      if (!e) { errors.push(`F3: set "${s.id}": verse ${n} missing`); continue; }
      if (!e.key) errors.push(`F4: set "${s.id}" verse ${n}: no key`);
      if (!/^[0-9a-f]{64}$/.test(e.sha256 || '')) errors.push(`F4: set "${s.id}" verse ${n}: sha256 not 64 hex`);
      if (!(e.bytes > 0)) errors.push(`F4: set "${s.id}" verse ${n}: bytes missing`);
      if (!(e.duration > 0)) errors.push(`F4: set "${s.id}" verse ${n}: duration missing`);
    }
  }
  return errors;
}

// self-check: a broken set must be caught for every named failure
const broken = validateSets(
  { sets: [{ id: 'a', recommended: true, manifest: 'x' }, { id: 'b', recommended: true, manifest: 'y' }, { id: 'c', manifest: 'z' }] },
  { a: { set: 'a', verses: { 1: { key: 'v.mp3', sha256: 'zz', bytes: 0 } } }, b: { set: 'wrong', verses: {} } }, [1, 2]);
for (const f of ['F1', 'F2', 'F3', 'F4']) {
  if (!broken.some((e) => e.startsWith(f))) { console.error(`self-check FAILED: ${f} not detected`); process.exit(1); }
}

const errors = [];
const index = readJson('audio/sets/index.json');
const manifests = {};
for (const s of index.sets) if (existsSync(join(root, s.manifest))) manifests[s.id] = readJson(s.manifest);
const nums = readJson('data/verses.json').verses.map((v) => v.number);
errors.push(...validateSets(index, manifests, nums));

// F5: no audio tracked by git anywhere in the repo (rnd/** is covered by .gitignore + the release assets, #48)
const tracked = execFileSync('git', ['-C', root, 'ls-files'], { encoding: 'utf8' }).split('\n');
for (const f of tracked) if (/\.(mp3|wav|m4a|ogg|opus|flac)$/i.test(f) && existsSync(join(root, f))) errors.push(`F5: audio file tracked in git: ${f}`);

// F6: no clip host or file name baked into js/
for (const f of readdirSync(join(root, 'js')).filter((x) => x.endsWith('.js'))) {
  const src = readFileSync(join(root, 'js', f), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');  // code only, not comments
  if (/https?:\/\/[^'"\s]*\.(mp3|wav)\b/i.test(src) || /verse\d\d\.mp3/.test(src) || /r2\.dev|r2\.cloudflarestorage|pages\.dev/.test(src)) errors.push(`F6: js/${f} hard-codes an audio URL or host`);
}

if (errors.length) { console.error(`audio-sets: FAILED (${errors.length})`); errors.forEach((e) => console.error('  - ' + e)); process.exit(1); }
console.log(`audio-sets: OK (${index.sets.length} sets x ${nums.length} verses, one recommended, no audio in git, no hard-coded host)`);
