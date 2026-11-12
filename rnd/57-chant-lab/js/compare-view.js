// compare-view.js: run the #56 aligner (compareTake) for the chapters and labs, and turn its result into ribbon marks.
import { getClip, work, analyseClip, verseOf } from './lib.js';

/** Compare a PCM take against the reference clip of a verse. usrKey names the take for the pitch cache. */
export async function compareToReference(chant, verseId, usrPcm, usrKey, refSet = chant.reference_set) {
  const verse = verseOf(chant, verseId), ref = await getClip(refSet, verseId);
  const res = await work('compare', { ref: ref.pcm, usr: usrPcm, verse });
  const [refAn, usrAn] = await Promise.all([analyseClip(`${refSet}:${verseId}`, ref.pcm), analyseClip(usrKey, usrPcm)]);
  return { res, ref, refAn, usrAn, verse };
}
export async function compareSets(chant, verseId, refSet, otherSet) {
  const other = await getClip(otherSet, verseId);
  const r = await compareToReference(chant, verseId, other.pcm, `${otherSet}:${verseId}`, refSet);
  return { ...r, other };
}

const SHORT = { 'does not match the reference sound': ['differs', 'slip'], 'much quieter than the reference': ['quieter', 'slip'], 'held longer': ['held longer', 'timing'], 'shorter': ['shorter', 'timing'], 'pitch higher': ['pitch higher', 'pitch'], 'pitch lower': ['pitch lower', 'pitch'] };
/** Ribbon marks from a compareTake result. only: array of kinds ('slip','timing','pitch') to keep, or null for all. */
export function marksFrom(res, only = null) {
  const out = [];
  for (const a of res.aksharas) {
    const f = a.flags.map((x) => SHORT[x]).filter((x) => x && (!only || only.includes(x[1])));
    if (f.length) out.push({ i: a.i, kind: f[0][1], label: f[0][0], title: f.map((x) => x[0]).join(', ') });
  }
  return out;
}

const clamp01 = (x) => Math.min(1, Math.max(0, x));
export const band = (c) => (c >= 70 ? 'high' : c >= 40 ? 'medium' : 'low');

/** A score and a confidence (0-100) at every level: akshara, line, verse. Same formulas as compareTake's overall, applied per part.
 *  score = 100 * (1 - bad), bad = max(0.5 if flagged, z/8 clamped); confidence = mean of the three evidence measures, scaled by how well the alignment fit, capped at 95.
 *  These roll-ups are this book's stand-in, not fitted to human judgements. */
export function levels(res, verse) {
  const ok = clamp01(1 - Math.max(0, res.alignCost - 0.6) / 0.6);
  const ak = res.aksharas.map((a) => {
    const bad = Math.min(1, Math.max(a.flagged ? 0.5 : 0, clamp01(a.z / 8)));
    return { i: a.i, line: verse.syllables[a.i].line, score: Math.round(100 * (1 - bad)), conf: Math.min(95, Math.round(100 * ((a.conf.timing + a.conf.pitch + a.conf.match) / 3) * ok)) };
  });
  const mean = (xs) => (xs.length ? Math.round(xs.reduce((s, x) => s + x, 0) / xs.length) : null);
  const lines = [...new Set(ak.map((a) => a.line))].sort((a, b) => a - b).map((ln) => {
    const m = ak.filter((a) => a.line === ln);
    return { line: ln, score: mean(m.map((a) => a.score)), conf: Math.min(95, mean(m.map((a) => a.conf))), n: m.length, flagged: m.filter((a) => res.aksharas[a.i].flagged).length };
  });
  return { ak, lines, verse: { score: res.overall.score, conf: res.overall.confidence }, flagged: res.aksharas.filter((a) => a.flagged).length };
}
