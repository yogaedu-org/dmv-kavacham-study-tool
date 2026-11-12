// compare.js: align a recorded take to the reference clip and give a per-akshara difference (dmv #57, stage 1).
// Pure functions on Float32Array PCM at 16 kHz mono: no DOM, no model, no download. Runs in the browser and in node.
//
// Method (every threshold is a HYPOTHESIS, not fitted to human judgements; see README "what this can and cannot tell you"):
//   1. features: 12 MFCCs per 10 ms frame, mean/variance normalised per clip (removes mic and room colour), plus frame level (dB).
//   2. alignment: DTW of the reference excerpt against the take, open at both ends of the take (leading/trailing silence is free).
//   3. per akshara (reference spans from the #55 forced alignment): timing ratio (take duration / reference duration, relative to
//      the whole-take tempo), spectral mismatch (mean DTW frame distance, as a robust z against the take's other aksharas),
//      level change (dB), and pitch deviation (cents, median voiced F0, relative to the whole-take offset so a different voice
//      or key is not penalised).
//   4. each measure carries a 0-1 confidence from how much evidence it rests on (span length, voiced frames, match quality).

export const SR = 16000;
const HOP = 160, WIN = 400, NFFT = 512, NMEL = 26, NCEP = 12;

// ---- FFT (radix 2) ----
function fft(re, im) {
  const n = re.length;
  for (let i = 1, j = 0; i < n; i++) {
    let bit = n >> 1;
    for (; j & bit; bit >>= 1) j ^= bit;
    j ^= bit;
    if (i < j) { [re[i], re[j]] = [re[j], re[i]]; [im[i], im[j]] = [im[j], im[i]]; }
  }
  for (let len = 2; len <= n; len <<= 1) {
    const ang = -2 * Math.PI / len, wr = Math.cos(ang), wi = Math.sin(ang);
    for (let i = 0; i < n; i += len) {
      let cr = 1, ci = 0;
      for (let k = 0; k < len / 2; k++) {
        const a = i + k, b = a + len / 2;
        const tr = re[b] * cr - im[b] * ci, ti = re[b] * ci + im[b] * cr;
        re[b] = re[a] - tr; im[b] = im[a] - ti; re[a] += tr; im[a] += ti;
        const nr = cr * wr - ci * wi; ci = cr * wi + ci * wr; cr = nr;
      }
    }
  }
}

const hz2mel = (f) => 2595 * Math.log10(1 + f / 700), mel2hz = (m) => 700 * (10 ** (m / 2595) - 1);
let _bank = null;
function melBank() {
  if (_bank) return _bank;
  const lo = hz2mel(80), hi = hz2mel(7600), pts = [];
  for (let i = 0; i < NMEL + 2; i++) pts.push(Math.floor((NFFT + 1) * mel2hz(lo + (hi - lo) * i / (NMEL + 1)) / SR));
  _bank = [];
  for (let m = 1; m <= NMEL; m++) {
    const f = new Float32Array(NFFT / 2 + 1);
    for (let k = pts[m - 1]; k < pts[m]; k++) f[k] = (k - pts[m - 1]) / Math.max(1, pts[m] - pts[m - 1]);
    for (let k = pts[m]; k < pts[m + 1]; k++) f[k] = (pts[m + 1] - k) / Math.max(1, pts[m + 1] - pts[m]);
    _bank.push(f);
  }
  return _bank;
}
let _dct = null;
function dctMat() {
  if (_dct) return _dct;
  _dct = [];
  for (let c = 1; c <= NCEP; c++) { const r = new Float32Array(NMEL); for (let m = 0; m < NMEL; m++) r[m] = Math.cos(Math.PI * c * (m + 0.5) / NMEL); _dct.push(r); }
  return _dct;
}

/** @returns {{n:number, mfcc:Float32Array, db:Float32Array}} frame count, normalised MFCC (n*NCEP), frame level in dB. */
export function features(pcm) {
  const n = Math.max(0, Math.floor((pcm.length - WIN) / HOP) + 1);
  const mfcc = new Float32Array(n * NCEP), db = new Float32Array(n);
  const win = new Float32Array(WIN).map((_, i) => 0.5 - 0.5 * Math.cos(2 * Math.PI * i / (WIN - 1)));
  const re = new Float64Array(NFFT), im = new Float64Array(NFFT), bank = melBank(), dct = dctMat(), lm = new Float32Array(NMEL);
  for (let t = 0; t < n; t++) {
    re.fill(0); im.fill(0);
    let e = 0;
    for (let i = 0; i < WIN; i++) { const x = pcm[t * HOP + i] * win[i]; re[i] = x; e += x * x; }
    db[t] = 10 * Math.log10(e / WIN + 1e-10);
    fft(re, im);
    for (let m = 0; m < NMEL; m++) {
      let s = 0; const f = bank[m];
      for (let k = 0; k <= NFFT / 2; k++) if (f[k]) s += f[k] * (re[k] * re[k] + im[k] * im[k]);
      lm[m] = Math.log(s + 1e-6);
    }
    for (let c = 0; c < NCEP; c++) { let s = 0; const r = dct[c]; for (let m = 0; m < NMEL; m++) s += r[m] * lm[m]; mfcc[t * NCEP + c] = s; }
  }
  for (let c = 0; c < NCEP; c++) {                       // per-clip mean/variance normalisation
    let mu = 0, v = 0;
    for (let t = 0; t < n; t++) mu += mfcc[t * NCEP + c];
    mu /= Math.max(1, n);
    for (let t = 0; t < n; t++) v += (mfcc[t * NCEP + c] - mu) ** 2;
    const sd = Math.sqrt(v / Math.max(1, n)) || 1;
    for (let t = 0; t < n; t++) mfcc[t * NCEP + c] = (mfcc[t * NCEP + c] - mu) / sd;
  }
  return { n, mfcc, db };
}

/** F0 per frame in Hz (0 = unvoiced), normalised autocorrelation, 70-400 Hz. */
export function f0Track(pcm, db) {
  const n = db.length, out = new Float32Array(n), W = 640, lagMin = 40, lagMax = 228;
  const maxDb = db.reduce((a, b) => Math.max(a, b), -100);
  for (let t = 0; t < n; t++) {
    if (db[t] < maxDb - 35) continue;                    // too quiet to hold a pitch
    const s = t * HOP + WIN / 2 - W / 2;
    if (s < 0 || s + W + lagMax > pcm.length) continue;
    let e0 = 0; for (let i = 0; i < W; i++) e0 += pcm[s + i] ** 2;
    if (e0 < 1e-9) continue;
    const nc = new Float32Array(lagMax + 2);
    for (let lag = lagMin - 1; lag <= lagMax + 1; lag++) {
      let c = 0, e1 = 0;
      for (let i = 0; i < W; i++) { c += pcm[s + i] * pcm[s + i + lag]; e1 += pcm[s + i + lag] ** 2; }
      nc[lag] = c / Math.sqrt(e0 * e1 + 1e-12);
    }
    let top = 0;
    for (let lag = lagMin; lag <= lagMax; lag++) if (nc[lag] > top) top = nc[lag];
    let best = 0, bestLag = 0;
    for (let lag = lagMin; lag <= lagMax; lag++) {       // shortest lag whose peak is within 10% of the best (avoids octave-down picks)
      if (nc[lag] > nc[lag - 1] && nc[lag] >= nc[lag + 1] && nc[lag] >= 0.9 * top) { best = nc[lag]; bestLag = lag; break; }
    }
    if (best >= 0.5 && bestLag) {
      const a = nc[bestLag - 1], b = nc[bestLag], c = nc[bestLag + 1], d = a - 2 * b + c;
      out[t] = SR / (bestLag + (d ? 0.5 * (a - c) / d : 0));
    }
  }
  return out;
}

/** DTW of ref frames (all rows used) against take frames (open begin/end). Returns the take frame matched to each ref frame and the frame cost. */
export function dtwAlign(ref, usr, { pen = 0.25 } = {}) {
  const N = ref.n, M = usr.n;
  const D = new Float32Array(N * M), from = new Int8Array(N * M), cost = new Float32Array(N * M);
  const dist = (i, j) => { let s = 0; for (let c = 0; c < NCEP; c++) { const d = ref.mfcc[i * NCEP + c] - usr.mfcc[j * NCEP + c]; s += d * d; } return Math.sqrt(s / NCEP); };
  for (let j = 0; j < M; j++) { cost[j] = dist(0, j); D[j] = cost[j]; }
  for (let i = 1; i < N; i++) {
    for (let j = 0; j < M; j++) {
      const c = dist(i, j); cost[i * M + j] = c;
      let best = Infinity, f = 0;
      for (let k = 0; k < 3; k++) {                      // take advances 0, 1 or 2 frames per reference frame
        if (j - k < 0) break;
        const v = D[(i - 1) * M + j - k] + (k === 1 ? 0 : pen);
        if (v < best) { best = v; f = k; }
      }
      D[i * M + j] = best + c; from[i * M + j] = f;
    }
  }
  let j = 0, bestEnd = Infinity;
  for (let q = 0; q < M; q++) if (D[(N - 1) * M + q] < bestEnd) { bestEnd = D[(N - 1) * M + q]; j = q; }
  const map = new Int32Array(N), lc = new Float32Array(N);
  for (let i = N - 1; i >= 0; i--) { map[i] = j; lc[i] = cost[i * M + j]; if (i > 0) j -= from[i * M + j]; }
  return { map, lc, total: bestEnd / N };
}

const median = (a) => { if (!a.length) return NaN; const s = [...a].sort((x, y) => x - y), m = s.length >> 1; return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2; };
const mad = (a, med) => median(a.map((x) => Math.abs(x - med))) * 1.4826;
const clamp = (x, lo, hi) => Math.min(hi, Math.max(lo, x));

export const THRESH = { z: 3.0, mismatch: 0.35, ratio: 1.6, cents: 150, levelDb: -12 };   // hypotheses

/**
 * @param refPcm  decoded reference clip (16 kHz mono)
 * @param usrPcm  decoded take (16 kHz mono)
 * @param verse   {syllables:[{deva,iast,line}], syl_t:[[t0,t1]...], analysis_span:[t0,t1]} from page-data.json
 */
export function compareTake(refPcm, usrPcm, verse) {
  const [s0, s1] = verse.analysis_span;
  const a0 = Math.max(0, s0 - 0.15), a1 = Math.min(refPcm.length / SR, s1 + 0.15);
  const refEx = refPcm.subarray(Math.floor(a0 * SR), Math.floor(a1 * SR));
  const refF = features(refEx), usrF = features(usrPcm);
  if (refF.n < 20 || usrF.n < 20) throw new Error("the take is too short to compare");
  const al = dtwAlign(refF, usrF);
  const refF0 = f0Track(refEx, refF.db), usrF0 = f0Track(usrPcm, usrF.db);
  const toFrame = (t) => clamp(Math.round((t - a0) * 100), 0, refF.n - 1);
  const mapAt = (fr) => al.map[clamp(fr, 0, refF.n - 1)];

  const ak = [];
  const st = verse.syl_t, N = st.length;
  for (let i = 0; i < N; i++) {
    const t0 = st[i][0], nextOnset = i + 1 < N ? st[i + 1][0] : Infinity;
    const t1 = Math.min(nextOnset, st[i][1] + 0.25, s1);
    const f0 = toFrame(t0), f1 = Math.max(f0 + 1, toFrame(t1));
    const u0 = mapAt(f0), u1 = Math.max(u0 + 1, mapAt(f1));
    let cs = 0; for (let f = f0; f < f1; f++) cs += al.lc[f];
    const mismatch = cs / (f1 - f0);
    let rl = 0, ul = 0; for (let f = f0; f < f1; f++) rl += refF.db[f]; for (let u = u0; u < u1; u++) ul += usrF.db[u];
    const levelDelta = ul / (u1 - u0) - rl / (f1 - f0);
    const rv = [], uv = []; for (let f = f0; f < f1; f++) if (refF0[f] > 0) rv.push(Math.log2(refF0[f])); for (let u = u0; u < u1; u++) if (usrF0[u] > 0) uv.push(Math.log2(usrF0[u]));
    ak.push({ i, deva: verse.syllables[i].deva, iast: verse.syllables[i].iast, refSpan: [t0, t1], f0, f1, u0, u1, refFrames: f1 - f0, mismatch, levelDelta, rv, uv });
  }
  // whole-take references
  const tempo = Math.max(1, mapAt(toFrame(s1)) - mapAt(toFrame(s0))) / Math.max(1, toFrame(s1) - toFrame(s0));
  const mm = ak.map((a) => a.mismatch), mmMed = median(mm), mmSd = Math.max(mad(mm, mmMed), 0.05);
  const offs = ak.filter((a) => a.rv.length >= 3 && a.uv.length >= 3).map((a) => median(a.uv) - median(a.rv));
  const keyOffset = offs.length ? median(offs) : 0;                      // octaves: a different voice or key is not an error
  for (const a of ak) {
    a.z = (a.mismatch - mmMed) / mmSd;
    a.ratio = ((a.u1 - a.u0) / a.refFrames) / tempo;
    const dOct = a.rv.length >= 3 && a.uv.length >= 3 ? median(a.uv) - median(a.rv) - keyOffset : NaN;
    a.cents = Number.isNaN(dOct) ? null : (((1200 * dOct + 600) % 1200) + 1200) % 1200 - 600;
    const match = clamp(1 - Math.max(0, a.mismatch - 0.5) / 0.8, 0, 1);  // a bad spectral match makes timing and pitch untrustworthy
    a.conf = {
      timing: +(clamp((a.refFrames - 6) / 25, 0, 1) * match).toFixed(2),
      pitch: a.cents === null ? 0 : +(Math.min(a.rv.length, a.uv.length) / Math.max(1, a.refFrames) * clamp(Math.min(a.rv.length, a.uv.length) / 8, 0, 1) * match).toFixed(2),
      match: +clamp(a.refFrames / 12, 0, 1).toFixed(2),
    };
    const flags = [];
    if (a.z >= THRESH.z && a.mismatch >= THRESH.mismatch + mmMed - 0.2) flags.push("does not match the reference sound");
    if (a.levelDelta <= THRESH.levelDb) flags.push("much quieter than the reference");
    if (a.conf.timing >= 0.4 && (a.ratio >= THRESH.ratio || a.ratio <= 1 / THRESH.ratio)) flags.push(a.ratio > 1 ? "held longer" : "shorter");
    if (a.conf.pitch >= 0.4 && Math.abs(a.cents) >= THRESH.cents) flags.push(a.cents > 0 ? "pitch higher" : "pitch lower");
    a.flags = flags; a.flagged = flags.length > 0;
    delete a.rv; delete a.uv;
  }
  const dur = (usrPcm.length / SR) / ((s1 - s0) || 1);
  const bad = ak.map((a) => Math.min(1, Math.max(a.flagged ? 0.5 : 0, clamp(a.z / 8, 0, 1))));
  const matchedShare = 1 - bad.filter((b) => b >= 0.5).length / ak.length;
  const alignmentOk = clamp(1 - Math.max(0, al.total - 0.6) / 0.6, 0, 1);
  // Flags are relative to the take's own median, so a take that is uniformly wrong (noise, silence, another verse) would flag
  // little and score high. The absolute spectral distance fixes that: ordinary takes of the verse sit near 0.6-0.7 (Day 5 and
  // Day 1 against Day 2), noise and other verses at 0.9 or more. The score is scaled down from 0.75 (no change) to 1.0 (x0.15).
  // Hypothesis: the 0.75 / 1.0 cut-offs come from a handful of clips, not from human ratings.
  const medianCost = median(ak.map((a) => a.mismatch)), fit = clamp(1 - (medianCost - 0.75) / 0.25, 0, 1), fitFactor = 0.15 + 0.85 * fit;
  const meanConf = ak.reduce((s, a) => s + (a.conf.timing + a.conf.pitch + a.conf.match) / 3, 0) / ak.length;
  return {
    aksharas: ak, medianCost: +medianCost.toFixed(3), fitFactor: +fitFactor.toFixed(2), tempo, keyOffsetCents: Math.round(1200 * keyOffset), alignCost: +al.total.toFixed(3),
    overall: { score: Math.round(fitFactor * 100 * (0.5 * matchedShare + 0.5 * (1 - bad.reduce((s, b) => s + b, 0) / ak.length))), confidence: Math.min(95, Math.round(100 * meanConf * alignmentOk)),
               note: "similarity to the reference, an estimate; confidence = how much evidence the numbers rest on" },
    refExcerpt: { t0: a0, t1: a1, frames: refF.n }, usrFrames: usrF.n, usrMap: al.map, durRatio: +dur.toFixed(2),
    refDb: refF.db, usrDb: usrF.db,
  };
}

/**
 * The importable entry point (the textbook lab and the side page both call this).
 * @param take       {pcm: Float32Array 16 kHz mono} or a bare Float32Array: the user's recording
 * @param reference  {pcm} or a bare Float32Array: the reference clip (Day 2)
 * @param verse      {syllables:[{deva,iast,line}], syl_t:[[t0,t1]], analysis_span:[t0,t1]} (one entry of page-data.json)
 * @returns {{
 *   aksharas: {i, deva, iast, line, timingRatio, pitchCents|null, cost, matchZ, levelDb, flags:string[], flagged:boolean, confidence:number,
 *              confidenceParts:{timing,pitch,match}}[],
 *   lines:    {line, from, to, of, score, confidence, flagged}[]   (score = share of the line's aksharas not flagged),
 *   verse:    {score, confidence, flagged, of},
 *   overall:  {score, confidence, note}, tempo, keyOffsetCents, durRatio, details }}
 * Every level carries a 0-100 `confidence`: an estimate of how much evidence the numbers rest on, not a probability.
 */
export function compare(take, reference, verse) {
  const r = compareTake(reference.pcm || reference, take.pcm || take, verse);
  const aksharas = r.aksharas.map((a) => ({
    i: a.i, deva: a.deva, iast: a.iast, line: verse.syllables[a.i].line,
    timingRatio: +a.ratio.toFixed(3), pitchCents: a.cents === null ? null : Math.round(a.cents), cost: +a.mismatch.toFixed(3),
    matchZ: +a.z.toFixed(2), levelDb: +a.levelDelta.toFixed(1), flags: a.flags, flagged: a.flagged,
    confidence: Math.round(100 * (a.conf.timing + a.conf.pitch + a.conf.match) / 3),
    confidenceParts: { timing: Math.round(100 * a.conf.timing), pitch: Math.round(100 * a.conf.pitch), match: Math.round(100 * a.conf.match) },   // 0-100 like every other confidence
  }));
  const lines = [...new Set(aksharas.map((a) => a.line))].map((line) => {
    const g = aksharas.filter((a) => a.line === line), bad = g.filter((a) => a.flagged).length;
    return { line, from: g[0].i, to: g[g.length - 1].i, of: g.length, score: Math.round(r.fitFactor * 100 * (1 - bad / g.length)), confidence: Math.round(g.reduce((s, a) => s + a.confidence, 0) / g.length), flagged: bad };
  });
  const flagged = aksharas.filter((a) => a.flagged).length;
  return { aksharas, lines, verse: { score: r.overall.score, confidence: r.overall.confidence, flagged, of: aksharas.length },
           overall: r.overall, tempo: r.tempo, keyOffsetCents: r.keyOffsetCents, durRatio: r.durRatio, details: r };
}
