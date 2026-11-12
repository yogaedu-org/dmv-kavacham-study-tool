// calibration.js: a smoke test of the #57 difference view, run in the page (dmv #57).
// Takes the Day 2 reference clip of each verse, damages ONE akshara-length region in a copy, feeds the copy to
// compareTake as if it were the user's take, and checks whether the right akshara is flagged:
//   silence  = the region is set to zero
//   replace  = the region is overwritten with the same-length audio of a different akshara of the same clip
// Controls: the unmodified clip (expect no flags) and, when available, the Day 5 take of the same verse (a different real take:
// there is no ground truth for it, so only the share of flagged aksharas is reported, as a false-alarm hint).
// Synthetic edits of the reference itself are an easy case (same voice, mic and room): N of M here is NOT a recall rate on real mistakes.
import { compareTake, SR } from "./compare.js";

const tick = () => new Promise((r) => setTimeout(r, 0));

function region(verse, k) {
  const st = verse.syl_t, n = st.length;
  const a = st[k][0], b = Math.min(k + 1 < n ? st[k + 1][0] : Infinity, st[k][1] + 0.25, verse.analysis_span[1]);
  return [Math.floor(a * SR), Math.floor(b * SR)];
}

export function damage(pcm, verse, k, kind) {
  const out = Float32Array.from(pcm), [s, e] = region(verse, k);
  if (kind === "silence") { out.fill(0, s, e); return out; }
  const n = verse.syl_t.length;
  let j = (k + 11) % n; while (verse.syllables[j].iast === verse.syllables[k].iast || region(verse, j)[0] + (e - s) > pcm.length) j = (j + 1) % n;
  const from = region(verse, j)[0], x = Math.floor(0.005 * SR);
  for (let i = 0; i < e - s; i++) {
    const w = Math.min(1, i / x, (e - s - i) / x);                // 5 ms crossfade at both edges
    out[s + i] = pcm[from + i] * w + pcm[s + i] * (1 - w);
  }
  return out;
}

export async function runCalibration({ pageData, loadRef, loadOther, onProgress = () => {}, verses = null }) {
  const list = pageData.verses.filter((v) => !verses || verses.includes(v.id));
  const trials = [], controls = [], others = [];
  for (const v of list) {
    onProgress(`verse ${v.id}: loading the reference...`);
    const ref = await loadRef(v.id), n = v.syl_t.length;
    const k = 2 + ((7 * v.id + 3) % (n - 5));                      // deterministic, away from the first and last aksharas
    for (const kind of ["silence", "replace"]) {
      onProgress(`verse ${v.id}: ${kind} akshara ${k + 1}...`);
      await tick();
      const r = compareTake(ref, damage(ref, v, k, kind), v);
      const flagged = r.aksharas.filter((a) => a.flagged).map((a) => a.i);
      const top = r.aksharas.reduce((b, a) => (a.z > b.z ? a : b)).i;
      trials.push({ verse: v.id, kind, k, flagged, top, hit: flagged.includes(k), topHit: top === k, extra: flagged.filter((i) => i !== k).length, refFrames: r.aksharas[k].refFrames });
    }
    await tick();
    const c = compareTake(ref, ref, v);
    controls.push({ verse: v.id, flagged: c.aksharas.filter((a) => a.flagged).length, score: c.overall.score });
    if (loadOther) {
      const o = await loadOther(v.id);
      if (o) { const r = compareTake(ref, o, v); others.push({ verse: v.id, flagged: r.aksharas.filter((a) => a.flagged).length, of: r.aksharas.length, score: r.overall.score, confidence: r.overall.confidence }); }
    }
  }
  const sum = (kind) => { const t = trials.filter((x) => x.kind === kind); return { m: t.length, hit: t.filter((x) => x.hit).length, topHit: t.filter((x) => x.topHit).length, extra: t.reduce((s, x) => s + x.extra, 0) }; };
  const out = { silence: sum("silence"), replace: sum("replace"), controls, others, trials };
  const ctlFlags = controls.reduce((s, c) => s + c.flagged, 0);
  const oFl = others.reduce((s, o) => s + o.flagged, 0), oOf = others.reduce((s, o) => s + o.of, 0);
  out.text = [
    `Calibration (synthetic edits of the Day 2 clips; an easy case, not a recall rate on real mistakes)`,
    `silenced akshara:  flagged the right akshara ${out.silence.hit} of ${out.silence.m}; it was the single worst akshara ${out.silence.topHit} of ${out.silence.m}; other aksharas flagged: ${out.silence.extra}`,
    `replaced akshara:  flagged the right akshara ${out.replace.hit} of ${out.replace.m}; it was the single worst akshara ${out.replace.topHit} of ${out.replace.m}; other aksharas flagged: ${out.replace.extra}`,
    `unmodified clip vs itself: ${ctlFlags} aksharas flagged over ${controls.length} verses (expect 0)`,
    others.length ? `Day 5 take of the same verse vs Day 2 (no ground truth): ${oFl} of ${oOf} aksharas flagged over ${others.length} verses (a false-alarm hint, since real chanting differs a little between takes)` : `Day 5 take: not available from this source, not run`,
    `Trial positions (verse:akshara): ` + trials.filter((t) => t.kind === "silence").map((t) => `${t.verse}:${t.k + 1}`).join(" "),
  ].join("\n");
  return out;
}
