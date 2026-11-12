// charts.js: small canvas charts that follow the page theme (colours are read from CSS variables on every draw).
// Every chart is registered so a theme switch or a resize redraws it. Each caller also writes a text summary next to it.
import { css, setupCanvas, onTheme } from './lib.js';

const registry = new Map();
export function chart(cv, H, draw) {
  const run = () => { const c = setupCanvas(cv, H); draw({ ...c, col: { ink: css('--ink'), muted: css('--muted'), line: css('--line'), gold: css('--gold'), ref: css('--indigo'), flag: css('--kumkum'), surface: css('--surface-2') } }); };
  registry.set(cv, run); run();
  return run;
}
onTheme(() => registry.forEach((f) => f()));
let rt = 0;
window.addEventListener('resize', () => { clearTimeout(rt); rt = setTimeout(() => registry.forEach((f) => f()), 150); });

const text = (g, s, x, y, o = {}) => { g.font = `${o.size || 12}px system-ui, sans-serif`; g.fillStyle = o.color; g.textAlign = o.align || 'left'; g.textBaseline = o.base || 'alphabetic'; g.fillText(s, x, y); };

/** Horizontal bars: items = [{label, value, hi, note}] on a 0-100 scale. */
export function drawBars({ g, W, H, col }, items, { max = 100 } = {}) {
  const left = 120, right = 56, rowH = H / items.length;
  items.forEach((it, k) => {
    const y = k * rowH + rowH * 0.2, h = rowH * 0.6, w = (W - left - right) * (it.value / max);
    g.fillStyle = it.hi ? col.ref : col.line; g.fillRect(left, y, w, h);
    text(g, it.label, left - 8, y + h / 2, { color: col.ink, align: 'right', base: 'middle', size: 13 });
    text(g, it.value.toFixed(1), left + w + 6, y + h / 2, { color: col.ink, base: 'middle', size: 13 });
  });
}

/** Waveform (top) and frame level with the pause threshold (bottom). */
export function drawWave({ g, W, H, col }, { pcm, sr, db, threshold, pauses, dur }) {
  const top = H * 0.5 - 8, padL = 4, w = W - padL - 4;
  g.strokeStyle = col.line; g.lineWidth = 1; g.beginPath(); g.moveTo(padL, top / 2); g.lineTo(padL + w, top / 2); g.stroke();
  const per = Math.max(1, Math.floor(pcm.length / w));
  g.fillStyle = col.ref;
  for (let x = 0; x < w; x++) {
    let mn = 1, mx = -1; const s = x * per;
    for (let i = s; i < Math.min(pcm.length, s + per); i += 4) { const v = pcm[i]; if (v < mn) mn = v; if (v > mx) mx = v; }
    if (mx >= mn) g.fillRect(padL + x, top / 2 - mx * (top / 2 - 2), 1, Math.max(1, (mx - mn) * (top / 2 - 2)));
  }
  const y0 = H * 0.5 + 4, y1 = H - 18, xOf = (t) => padL + (t / dur) * w;
  for (const p of pauses) { g.fillStyle = col.flag + '33'; g.fillRect(xOf(p.t0), 0, xOf(p.t1) - xOf(p.t0), H - 18); }
  const mx = Math.max(...db), lo = mx - 70, yy = (v) => y1 - Math.max(0, Math.min(1, (v - lo) / 70)) * (y1 - y0);
  g.strokeStyle = col.gold; g.lineWidth = 1.5; g.beginPath();
  for (let f = 0; f < db.length; f += 2) { const x = xOf(f / 100 + 0.0125), y = yy(db[f]); f ? g.lineTo(x, y) : g.moveTo(x, y); }
  g.stroke();
  g.strokeStyle = col.flag; g.setLineDash([4, 4]); g.beginPath(); g.moveTo(padL, yy(threshold)); g.lineTo(padL + w, yy(threshold)); g.stroke(); g.setLineDash([]);
  text(g, 'pause threshold', padL + 4, yy(threshold) - 4, { color: col.flag, size: 11 });
  text(g, 'sound', padL + 4, 12, { color: col.muted, size: 11 }); text(g, 'loudness', padL + w - 4, y0 + 12, { color: col.gold, size: 11, align: 'right' });
  for (let t = 0; t <= dur; t += 2) text(g, t + ' s', xOf(t), H - 4, { color: col.muted, size: 11, align: t === 0 ? 'left' : 'center' });
}

/** Warp path drawn as lag: how much later (s) the other take is at the same point of the verse. Flat = same speed. */
export function drawWarp({ g, W, H, col }, { path, tx, ticks, bad }) {
  const lag = path.map(([a, b]) => b - a), lo = Math.min(0, ...lag) - 0.1, hi = Math.max(0, ...lag) + 0.1;
  const L = 48, B = 26, w = W - L - 8, h = H - B - 8, X = (t) => L + ((t - tx[0]) / (tx[1] - tx[0])) * w, Y = (v) => 8 + h - ((v - lo) / (hi - lo)) * h;
  g.strokeStyle = col.line; g.lineWidth = 1; g.strokeRect(L, 8, w, h);
  g.setLineDash([4, 4]); g.beginPath(); g.moveTo(L, Y(0)); g.lineTo(L + w, Y(0)); g.stroke(); g.setLineDash([]);
  text(g, 'same time', L + 4, Y(0) - 4, { color: col.muted, size: 11 });
  for (const t of ticks) { g.beginPath(); g.moveTo(X(t), 8 + h); g.lineTo(X(t), 8 + h + 5); g.stroke(); }
  g.lineWidth = 2; g.strokeStyle = col.gold; g.beginPath();
  path.forEach(([a], k) => { const x = X(a), y = Y(lag[k]); k ? g.lineTo(x, y) : g.moveTo(x, y); }); g.stroke();
  g.strokeStyle = col.flag; g.lineWidth = 4;
  for (const [a0, a1] of bad) { g.beginPath(); let pen = false; path.forEach(([a], k) => { if (a >= a0 && a <= a1) { const x = X(a), y = Y(lag[k]); pen ? g.lineTo(x, y) : g.moveTo(x, y); pen = true; } }); g.stroke(); }
  text(g, 'reference time (s)', L + w / 2, H - 3, { color: col.muted, align: 'center', size: 11 });
  g.save(); g.translate(12, 8 + h / 2); g.rotate(-Math.PI / 2); text(g, 'other take is later by (s)', 0, 0, { color: col.muted, align: 'center', size: 11 }); g.restore();
  for (const v of [lo + 0.1, 0, hi - 0.1]) text(g, v.toFixed(1), L - 5, Y(v), { color: col.muted, size: 10, align: 'right', base: 'middle' });
  for (let t = Math.ceil(tx[0]); t <= tx[1]; t += 2) text(g, String(t), X(t), H - 14, { color: col.muted, size: 10, align: 'center' });
}

/** Per-take timing error: a segment from the median to the p90 for each take. */
export function drawStrip({ g, W, H, col }, { takes, med, p90 }) {
  const L = 8, R = 8, B = 20, w = W - L - R, max = 40, X = (v) => L + (Math.min(v, max) / max) * w;
  const rows = [...takes].sort((a, b) => a.median_ms - b.median_ms), step = (H - B - 6) / rows.length;
  rows.forEach((t, k) => { const y = 4 + k * step + step / 2; g.strokeStyle = col.line; g.lineWidth = 1; g.beginPath(); g.moveTo(X(t.median_ms), y); g.lineTo(X(t.p90_ms), y); g.stroke(); g.fillStyle = col.gold; g.fillRect(X(t.median_ms) - 1.5, y - 1.5, 3, 3); g.fillStyle = col.muted; g.fillRect(X(t.p90_ms) - 1, y - 1, 2, 2); });
  for (const [v, s, c] of [[med, `median ${med} ms`, col.gold], [p90, `90th percentile ${p90} ms`, col.ink]]) { g.strokeStyle = c; g.setLineDash([4, 4]); g.beginPath(); g.moveTo(X(v), 0); g.lineTo(X(v), H - B); g.stroke(); g.setLineDash([]); text(g, s, X(v) + 4, 12, { color: c, size: 11 }); }
  for (let v = 0; v <= max; v += 10) text(g, v + ' ms', X(v), H - 5, { color: col.muted, size: 11, align: v === 0 ? 'left' : v === max ? 'right' : 'center' });
}

/** Two contours (cents) over reference time. */
export function drawContours({ g, W, H, col }, { ref, take, t0, t1, range = 400 }) {
  const L = 46, B = 20, w = W - L - 8, h = H - B - 8, X = (t) => L + ((t - t0) / (t1 - t0)) * w, Y = (c) => 8 + h / 2 - (Math.max(-range, Math.min(range, c)) / range) * (h / 2);
  g.strokeStyle = col.line; g.lineWidth = 1; g.strokeRect(L, 8, w, h);
  g.setLineDash([3, 4]); for (const c of [-range / 2, 0, range / 2]) { g.beginPath(); g.moveTo(L, Y(c)); g.lineTo(L + w, Y(c)); g.stroke(); } g.setLineDash([]);
  for (const c of [-range, 0, range]) text(g, (c > 0 ? '+' : '') + c, L - 6, Y(c), { color: col.muted, size: 11, align: 'right', base: 'middle' });
  const line = (s, color) => { g.strokeStyle = color; g.lineWidth = 2; g.beginPath(); let pen = false; for (let k = 0; k < s.t.length; k++) { const t = s.t[k], c = s.c[k]; if (t < t0 || t > t1 || !Number.isFinite(c)) { pen = false; continue; } pen ? g.lineTo(X(t), Y(c)) : g.moveTo(X(t), Y(c)); pen = true; } g.stroke(); };
  line(ref, col.ref); line(take, col.gold);
  text(g, 'cents', 4, 8 + h / 2, { color: col.muted, size: 11, base: 'middle' });
  for (let t = Math.ceil(t0); t <= t1; t += 2) text(g, t + ' s', X(t), H - 5, { color: col.muted, size: 11, align: 'center' });
}

/** Planted-slip scores per verse: clean take (hollow), omission and substitution (filled). Lines mark chosen thresholds. */
export function drawSplice({ g, W, H, col }, { rows, key, lines, max }) {
  const L = 34, B = 22, w = W - L - 8, h = H - B - 8, X = (v) => L + ((v - 0.5) / rows.length) * w, Y = (s) => 8 + h - (Math.min(s, max) / max) * h;
  g.strokeStyle = col.line; g.lineWidth = 1; g.strokeRect(L, 8, w, h);
  for (const [v, label, c] of lines) { g.strokeStyle = c; g.setLineDash([5, 4]); g.beginPath(); g.moveTo(L, Y(v)); g.lineTo(L + w, Y(v)); g.stroke(); g.setLineDash([]); text(g, label, L + w - 4, Y(v) - 4, { color: c, size: 11, align: 'right' }); }
  rows.forEach((r, k) => {
    const x = X(k + 1);
    g.strokeStyle = col.ink; g.lineWidth = 1.5; g.beginPath(); g.arc(x - 7, Y(r.control[key]), 3.5, 0, 7); g.stroke();
    g.fillStyle = col.flag; g.beginPath(); g.arc(x, Y(r.omission[key]), 4, 0, 7); g.fill();
    g.beginPath(); g.moveTo(x + 7, Y(r.substitution[key]) - 5); g.lineTo(x + 12, Y(r.substitution[key])); g.lineTo(x + 7, Y(r.substitution[key]) + 5); g.lineTo(x + 2, Y(r.substitution[key])); g.closePath(); g.fill();
    text(g, String(r.verse), x + 2, H - 6, { color: col.muted, size: 11, align: 'center' });
  });
  for (let v = 0; v <= max; v += 2) text(g, String(v), L - 6, Y(v), { color: col.muted, size: 11, align: 'right', base: 'middle' });
}
