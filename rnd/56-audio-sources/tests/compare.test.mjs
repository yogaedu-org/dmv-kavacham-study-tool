// Tests for the importable compare() result shape, run with: node --test rnd/56-audio-sources/tests/compare.test.mjs
// Synthetic signals only (no audio files): they check the SHAPE and the score/confidence rules, not chanting quality.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { compare, SR } from "../compare.js";

const here = dirname(fileURLToPath(import.meta.url));
const pageData = JSON.parse(readFileSync(join(here, "..", "page-data.json"), "utf8"));
const verse = (n) => pageData.verses.find((v) => v.id === n);

// a deterministic "voiced" signal: a gliding harmonic tone, with slow amplitude pulses at akshara-ish intervals
function tone(seconds, f0 = 140, seed = 1) {
  const out = new Float32Array(Math.floor(seconds * SR));
  let ph = 0;
  for (let i = 0; i < out.length; i++) {
    const t = i / SR, f = f0 * (1 + 0.05 * Math.sin(2 * Math.PI * 0.3 * t + seed));
    ph += 2 * Math.PI * f / SR;
    out[i] = 0.3 * (Math.sin(ph) + 0.5 * Math.sin(2 * ph) + 0.25 * Math.sin(3 * ph)) * (0.6 + 0.4 * Math.sin(2 * Math.PI * 2.5 * t));
  }
  return out;
}
function noise(seconds, seed = 7) {
  let x = seed; const out = new Float32Array(Math.floor(seconds * SR));
  for (let i = 0; i < out.length; i++) { x = (x * 1664525 + 1013904223) >>> 0; out[i] = 0.2 * (x / 2 ** 32 - 0.5); }
  return out;
}
const dur = (v) => v.analysis_span[1] + 0.5;

test("compare() returns a score AND a confidence at every level: akshara, line, verse, overall", () => {
  const v = verse(1), ref = tone(dur(v));
  const r = compare(ref, ref, v);
  assert.ok(r.aksharas.length === v.syl_t.length && r.aksharas.every((a) => Number.isFinite(a.confidence) && "timingRatio" in a && "pitchCents" in a && "cost" in a));
  assert.equal(r.lines.length, 2);                                                  // verse 1 has two lines
  for (const l of r.lines) { assert.ok(Number.isFinite(l.score) && Number.isFinite(l.confidence), "line score and confidence"); assert.ok(l.of > 0 && l.to >= l.from); }
  assert.ok(Number.isFinite(r.verse.score) && Number.isFinite(r.verse.confidence), "verse score and confidence");
  assert.ok(Number.isFinite(r.overall.score) && Number.isFinite(r.overall.confidence), "overall score and confidence");
  assert.equal(r.lines.reduce((s, l) => s + l.of, 0), r.aksharas.length);           // every akshara belongs to exactly one line
});

test("every confidence in the result is on the same 0-100 integer scale, including the per-akshara parts", () => {
  const v = verse(1), ref = tone(dur(v)), r = compare(ref, ref, v);
  const all = [r.overall.confidence, r.verse.confidence, ...r.lines.map((l) => l.confidence), ...r.aksharas.flatMap((a) => [a.confidence, ...Object.values(a.confidenceParts)])];
  assert.ok(all.every((c) => Number.isInteger(c) && c >= 0 && c <= 100), JSON.stringify(all.filter((c) => !(Number.isInteger(c) && c >= 0 && c <= 100))));
  assert.ok(Math.max(...r.aksharas.flatMap((a) => Object.values(a.confidenceParts))) > 1, "parts are not left on a 0-1 scale");
});

test("verse 14 compares line 1 only, so it returns exactly one line (its closing line repeats a variable number of times)", () => {
  const v = verse(14), ref = tone(dur(v));
  assert.equal(compare(ref, ref, v).lines.length, 1);
});

test("a take identical to the reference scores high with every akshara unflagged", () => {
  const v = verse(1), ref = tone(dur(v));
  const r = compare(ref, ref, v);
  assert.ok(r.overall.score >= 95 && r.verse.flagged === 0, JSON.stringify(r.verse));
  assert.ok(r.lines.every((l) => l.score === 100));
});

test("noise against the reference scores low, and the confidence is reported separately (a low score is not a low confidence by construction)", () => {
  const v = verse(1), ref = tone(dur(v)), r = compare(noise(dur(v)), ref, v);
  assert.ok(r.overall.score < 60, "noise is far from the reference: " + r.overall.score);
  assert.ok(r.verse.flagged > 0 && r.lines.some((l) => l.flagged > 0));
  assert.ok(r.overall.confidence >= 0 && r.overall.confidence <= 95);
});
