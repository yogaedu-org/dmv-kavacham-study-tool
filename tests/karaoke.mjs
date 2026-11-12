#!/usr/bin/env node
/**
 * Follow-along data + lookup guard (#61). No browser.  Run:  node tests/karaoke.mjs
 *
 * Named failures:
 *   K1  The lit akshara at a time t inside akshara k is not k (first, middle and last aksharas of verse 1), or its word is wrong:
 *       the highlight would run ahead of or behind the voice.
 *   K2  Something is lit before the first akshara, in a long silence, or after the last one: the highlight sticks.
 *   K3  A line sung several times (verse 14's closing line, 3 passes) lights the wrong akshara on the second or third pass.
 *   K4  audio/sets/day2/timings.json is malformed: start going backwards, a time outside the clip, an akshara missing, or the
 *       aksharas no longer reproduce the verse's Devanagari / transliteration in data/verses.json (the DOM wrapping would then
 *       refuse the verse and play without highlight).
 *   K5  (self-check) the validator accepts a deliberately broken file: a guard that cannot fail proves nothing.
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { activeAt } from '../js/karaoke.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const readJson = (rel) => JSON.parse(readFileSync(join(root, rel), 'utf8'));
const doc = readJson('audio/sets/day2/timings.json');
const verses = readJson('data/verses.json').verses;
let failed = 0;
const fail = (id, msg) => { failed++; console.error(`FAIL ${id}: ${msg}`); };
const strip = (s) => s.normalize('NFC').replace(/[\s |।॥0-9०-९]/g, '');

export function validate(d, vs) {
    const errs = [];
    for (const v of vs) {
        const t = d.verses[String(v.number)];
        if (!t) { errs.push(`verse ${v.number}: no timings`); continue; }
        let prev = -1;
        for (const a of t.aksharas) {
            if (a.start < prev) errs.push(`verse ${v.number}: start goes backwards at i=${a.i}`);
            if (!(a.start >= 0 && a.start <= a.end && a.end <= t.duration + 0.05)) errs.push(`verse ${v.number}: i=${a.i} [${a.start}, ${a.end}] outside the ${t.duration} s clip`);
            prev = a.start;
        }
        const first = new Map();
        t.aksharas.forEach((a) => { if (!first.has(a.i)) first.set(a.i, a); });
        const ordered = [...first.values()].sort((x, y) => x.i - y.i);
        if (ordered.some((a, k) => a.i !== k)) errs.push(`verse ${v.number}: an akshara index is missing`);
        if (ordered.map((a) => a.deva).join('') !== strip(v.sanskrit)) errs.push(`verse ${v.number}: aksharas do not reproduce the Devanagari`);
        if (ordered.every((a) => a.iast) && ordered.map((a) => a.iast).join('') !== strip(v.transliteration)) errs.push(`verse ${v.number}: aksharas do not reproduce the transliteration`);
    }
    return errs;
}

// K5 self-check first
{
    const bad = JSON.parse(JSON.stringify(doc));
    bad.verses['1'].aksharas[5].start = 0;                 // goes backwards
    bad.verses['2'].aksharas[3].deva = 'X';                // text no longer reproduced
    const errs = validate(bad, verses);
    if (errs.length < 2) fail('K5', `validator found only ${errs.length} of 2 planted faults`);
}

// K4
validate(doc, verses).forEach((e) => fail('K4', e));

const v1 = doc.verses['1'];
// K1: five times, each in the middle of the akshara (first, two middle ones, the last, and one more)
for (const k of [0, 7, 15, 25, v1.aksharas.length - 1]) {
    const a = v1.aksharas[k], t = a.start + Math.min(0.04, (a.end - a.start) / 2);
    const got = activeAt(v1, t);
    if (got !== k) fail('K1', `verse 1 t=${t.toFixed(3)} s inside akshara ${k} lit ${got}`);
    else if (v1.aksharas[got].word !== a.word) fail('K1', `verse 1 akshara ${k}: wrong word`);
}
// held after its own end until the next one starts (a sustained vowel)
{
    const a = v1.aksharas[2], n = v1.aksharas[3], t = Math.min(a.end + 0.05, (a.end + n.start) / 2);
    if (activeAt(v1, t) !== 2 && n.start - a.end > 0.05) fail('K1', 'the akshara is dropped in the short gap before the next one');
}
// K2
if (activeAt(v1, v1.aksharas[0].start - 0.01) !== -1) fail('K2', 'lit before the first akshara');
{
    const last = v1.aksharas[v1.aksharas.length - 1];
    if (activeAt(v1, last.end + 0.7) !== -1) fail('K2', 'still lit 0.7 s after the last akshara');
    if (activeAt(v1, v1.duration + 5) !== -1) fail('K2', 'lit after the end of the clip');
    // a long silence inside the verse (verse 1 has 1.04 s of quiet after akshara 16)
    const q = v1.aksharas[16];
    if (v1.aksharas[17].start - q.end > 1.0 && activeAt(v1, q.end + 0.9) !== -1) fail('K2', 'lit through a 0.9 s silence');
}
// K3
{
    const v14 = doc.verses['14'];
    if (v14.repeats !== 3) fail('K3', 'verse 14 should carry 3 passes of its closing line');
    for (const pass of [1, 2, 3]) {
        const idx = v14.aksharas.findIndex((a) => a.i === 20 && a.pass === pass);
        const a = v14.aksharas[idx], t = a.start + Math.min(0.04, (a.end - a.start) / 2);
        const got = activeAt(v14, t);
        if (got !== idx || v14.aksharas[got].i !== 20) fail('K3', `verse 14 pass ${pass}: akshara 20 at ${t.toFixed(3)} s lit entry ${got}`);
    }
}

if (failed) { console.error(`karaoke: ${failed} failure(s)`); process.exit(1); }
console.log(`karaoke: OK (${verses.length} verses validated against data/verses.json; lookup K1-K3 hold; the validator fails on planted faults)`);
