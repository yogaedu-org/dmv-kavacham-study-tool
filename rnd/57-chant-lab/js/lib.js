// lib.js: shared helpers for every page. Chant-specific data comes only from chant.json.
// Audio resolution, decoding and the aligner are the #56 modules (../56-audio-sources/), mounted unchanged.
import { createAudioSource } from '../../56-audio-sources/audio-source.js';
import { decodeToPcm } from '../../56-audio-sources/record.js';
import { SR } from '../../56-audio-sources/compare.js';

export { decodeToPcm, SR };
const $root = new URL('../', import.meta.url);

// ---- config ----
let _chant = null;
export async function loadChant() {
  if (!_chant) {
    _chant = fetch(new URL('chant.json', $root)).then((r) => { if (!r.ok) throw new Error(`chant.json: HTTP ${r.status}`); return r.json(); });
  }
  return _chant;
}
export const nn = (n) => String(n).padStart(2, '0');
export const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
export const clamp = (x, lo, hi) => Math.min(hi, Math.max(lo, x));
export const median = (a) => { const s = a.filter((x) => Number.isFinite(x)).sort((x, y) => x - y); if (!s.length) return NaN; const m = s.length >> 1; return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2; };
export const fmt = (x, d = 1) => (Number.isFinite(x) ? x.toFixed(d) : 'n/a');

// ---- audio source (the #56 module) ----
const sources = new Map();
function sourceFor(chant, setId) {
  const key = setId;
  if (sources.has(key)) return sources.get(key);
  const c = chant.clips, srcs = [{ kind: 'custom', label: 'your own files' }];
  srcs.push({ kind: 'offline', base: c.base, label: `the offline folder (${c.base})` });
  if (c.cloud_base) srcs.push({ kind: 'cloud', base: c.cloud_base, label: 'the cloud copy' });
  const file = (v) => c.path.replace('{set}', setId).replace('{nn}', nn(v.id));
  const cfg = {
    version: 1, set: { id: setId, label: setId },
    sources: srcs, order: ['custom', 'offline', 'cloud'],
    verses: chant.verses.map((v) => ({ id: v.id, file: { offline: file(v), cloud: file(v) }, duration: v.duration_s, set: setId })),
  };
  const s = createAudioSource(cfg, { baseHref: location.href });
  sources.set(key, s);
  return s;
}
export async function audioSource(setId) { return sourceFor(await loadChant(), setId); }
export function setLabel(chant, id) { const s = chant.sets.find((x) => x.id === id); return s ? s.label : id; }

/** Find a clip: { url, source, label } or throws an Error that names every source tried and says what to do. */
export async function findClip(setId, verseId, { kinds = ['offline', 'cloud'] } = {}) {
  const chant = await loadChant();
  const src = sourceFor(chant, setId);
  const r = await src.resolve(verseId, { kinds });
  if (r.missing) {
    const t = r.tried.map((x) => `${x.label}${x.url ? ` at ${x.url.replace(location.origin, '')}` : ''}: ${x.reason}`).join('; ');
    throw new Error(`No audio found for ${setLabel(chant, setId)} verse ${verseId}. Tried ${t}. To fix it, run python rnd/57-chant-lab/tools/copy-clips.py, or choose your own file.`);
  }
  return r;
}
const pcmCache = new Map();
export async function getClip(setId, verseId, opts) {
  const key = `${setId}:${verseId}`;
  if (pcmCache.has(key)) return pcmCache.get(key);
  const r = await findClip(setId, verseId, opts);
  let resp;
  try { resp = await fetch(r.url); } catch (e) { throw new Error(`The clip at ${r.url} could not be read (${e.message}). Check that the page is served over http://localhost, not opened as a file.`); }
  if (!resp.ok) throw new Error(`The clip at ${r.url} answered HTTP ${resp.status}. Check the offline folder.`);
  const out = { pcm: await decodeToPcm(await resp.arrayBuffer()), url: r.url, source: r.source, label: r.label };
  pcmCache.set(key, out);
  return out;
}

// ---- worker ----
let worker, seq = 0;
const pend = new Map();
function ensureWorker() {
  if (worker !== undefined) return worker;
  try {
    worker = new Worker(new URL('./worker.js', import.meta.url), { type: 'module' });
    worker.onmessage = (e) => { const { id, ok, res, err } = e.data; const p = pend.get(id); pend.delete(id); if (p) (ok ? p.resolve(res) : p.reject(new Error(err))); };
    worker.onerror = (e) => { worker = null; for (const p of pend.values()) p.reject(Object.assign(new Error('worker failed: ' + (e.message || 'could not start')), { workerFailed: true })); pend.clear(); };
  } catch { worker = null; }
  return worker;
}
export async function work(cmd, args) {
  const w = ensureWorker();
  if (w) {
    try { return await new Promise((resolve, reject) => { const id = ++seq; pend.set(id, { resolve, reject }); w.postMessage({ id, cmd, args }); }); }
    catch (e) { if (!e.workerFailed) throw e; }
  }
  return (await import('./tasks.js'))[cmd](args);
}
const analysisCache = new Map();
export async function analyseClip(key, pcm) {
  if (!analysisCache.has(key)) analysisCache.set(key, work('analyse', { pcm }));
  return analysisCache.get(key);
}

// ---- signal helpers ----
export function percentile(a, p) { const s = Float32Array.from(a).sort(); return s[Math.min(s.length - 1, Math.floor(p * s.length))]; }
/** Pauses by the #55 energy rule: frames 28 dB below the clip's 95th-percentile level, runs of 0.30 s or longer; leading and trailing silence excluded. 10 ms frames here (the #55 run used 20 ms). */
export function findPauses(db, { minS = 0.30, below = 28 } = {}) {
  const thr = percentile(db, 0.95) - below, out = [], n = db.length;
  let s = -1;
  for (let i = 0; i <= n; i++) {
    const quiet = i < n && db[i] < thr;
    if (quiet && s < 0) s = i;
    if (!quiet && s >= 0) { if ((i - s) / 100 >= minS && s > 0 && i < n) out.push({ t0: s / 100, t1: i / 100 }); s = -1; }
  }
  return { pauses: out, threshold: thr };
}
export function medianHz(f0) { return median(Array.from(f0).filter((x) => x > 0)); }
/** Cents above the clip's own median pitch, folded into [-600, 600): a different key or voice is not an error. NaN = unvoiced. */
export function cents(hz, med) { if (!(hz > 0) || !(med > 0)) return NaN; return (((1200 * Math.log2(hz / med) + 600) % 1200) + 1200) % 1200 - 600; }

export function wavBlob(f32, rate = SR) {
  const n = f32.length, buf = new ArrayBuffer(44 + n * 2), v = new DataView(buf);
  const w = (o, s) => { for (let i = 0; i < s.length; i++) v.setUint8(o + i, s.charCodeAt(i)); };
  w(0, 'RIFF'); v.setUint32(4, 36 + n * 2, true); w(8, 'WAVEfmt '); v.setUint32(16, 16, true); v.setUint16(20, 1, true); v.setUint16(22, 1, true);
  v.setUint32(24, rate, true); v.setUint32(28, rate * 2, true); v.setUint16(32, 2, true); v.setUint16(34, 16, true); w(36, 'data'); v.setUint32(40, n * 2, true);
  for (let i = 0; i < n; i++) v.setInt16(44 + i * 2, Math.max(-1, Math.min(1, f32[i])) * 32767, true);
  return new Blob([buf], { type: 'audio/wav' });
}

// ---- theme-aware drawing ----
export const css = (name) => getComputedStyle(document.documentElement).getPropertyValue(name).trim();
const themeListeners = new Set();
export function onTheme(fn) { themeListeners.add(fn); }
function fireTheme() { themeListeners.forEach((f) => { try { f(); } catch (e) { console.error(e); } }); }
new MutationObserver(fireTheme).observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', fireTheme);

/** Size a canvas for the device pixel ratio; returns {g, W, H}. */
export function setupCanvas(cv, H) {
  const dpr = window.devicePixelRatio || 1, W = cv.clientWidth || 600;
  cv.style.height = H + 'px'; cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr);
  const g = cv.getContext('2d'); g.setTransform(dpr, 0, 0, dpr, 0, 0); g.clearRect(0, 0, W, H);
  return { g, W, H };
}

// ---- small IndexedDB store: the last recorded take survives a page change (the labs are separate pages) ----
function idb() {
  return new Promise((res, rej) => { const r = indexedDB.open('chantlab57', 1); r.onupgradeneeded = () => r.result.createObjectStore('kv'); r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); });
}
export async function kvPut(key, val) { const db = await idb(); return new Promise((res, rej) => { const t = db.transaction('kv', 'readwrite'); t.objectStore('kv').put(val, key); t.oncomplete = () => res(); t.onerror = () => rej(t.error); }); }
export async function kvGet(key) { const db = await idb(); return new Promise((res, rej) => { const q = db.transaction('kv').objectStore('kv').get(key); q.onsuccess = () => res(q.result); q.onerror = () => rej(q.error); }); }

export function store(key, fallback) { try { const v = localStorage.getItem('chantlab57:' + key); return v == null ? fallback : JSON.parse(v); } catch { return fallback; } }
export function storeSet(key, val) { try { localStorage.setItem('chantlab57:' + key, JSON.stringify(val)); return true; } catch { return false; } }

/** Fill a verse <select> from chant.json. */
export function fillVerseSelect(sel, chant, { value = 1 } = {}) {
  sel.innerHTML = chant.verses.map((v) => `<option value="${v.id}">${chant.chant.unit} ${v.id}</option>`).join('');
  sel.value = String(value);
}
export function verseOf(chant, id) { return chant.verses.find((v) => v.id === Number(id)); }
export function urlParam(name) { return new URLSearchParams(location.search).get(name); }
