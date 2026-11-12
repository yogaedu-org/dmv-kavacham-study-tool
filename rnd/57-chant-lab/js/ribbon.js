// ribbon.js: THE AKSHARA RIBBON. One component, used by every chapter and lab (see ../DESIGN.md).
// A verse's syllables laid along time, one row per line. Under each row: an energy band with the pitch drawn over it.
// Under that: marks for differences. Cell widths follow the time between onsets with a floor so each syllable stays readable.
//
//   const rb = createRibbon(el, { verse });          // verse = an entry of chant.json "verses"
//   rb.setAudio(audioEl);                            // playhead + current cell follow audio.currentTime (reference clip only)
//   rb.setMarks([{ i, kind: 'slip'|'timing'|'heard', label, title }])
//   rb.setEnergy(db)                                 // 10 ms frame levels in dB
//   rb.setPitch([{ cls: 'ref'|'take', t: [...secs in reference time], c: [...cents, NaN = unvoiced] }], { range: 400 })
//   rb.summary()                                     // plain-words description of what is drawn
import { onTheme } from './lib.js';

const FLOOR = 30, BAND_H = 76, TAIL = 0.25;
const NS = 'http://www.w3.org/2000/svg';
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

function layoutLine(sy, st, upto, pps) {          // sy: syllables, st: [on, off] per syllable, same indices
  const cells = [];
  let x = 0, prevEnd = null;
  for (const i of upto) {
    const on = st[i][0], nextOn = st[i + 1] ? st[i + 1][0] : Infinity;
    const end = Math.min(nextOn, st[i][1] + TAIL);
    if (prevEnd !== null && on > prevEnd) x += (on - prevEnd) * pps;       // a pause shows as empty space, in proportion
    const w = Math.max(FLOOR, (end - on) * pps);
    cells.push({ i, on, end, x, w });
    x += w; prevEnd = end;
  }
  return { cells, width: x };
}

export function createRibbon(root, { verse, label = '' }) {
  const sy = verse.syllables, st = verse.syl_t;
  const lines = [...new Set(sy.map((s) => s.line))].sort((a, b) => a - b);
  const byLine = lines.map((ln) => sy.filter((s) => s.line === ln).map((s) => s.i));
  let marks = [], audio = null, raf = 0, energy = null, series = [], range = 400, pitchNote = '';
  let layout = [], pps = 90, now = -1;
  root.classList.add('ribbon');
  root.setAttribute('role', 'group');
  root.setAttribute('aria-label', label || `Akshara ribbon: ${sy.length} syllables in ${lines.length} line${lines.length > 1 ? 's' : ''}`);

  function choosePps(avail) {
    const widthAt = (p) => Math.max(...byLine.map((ids) => layoutLine(sy, st, ids, p).width));
    let best = 60;
    for (let p = 220; p >= 40; p -= 10) { if (widthAt(p) <= avail) { best = p; break; } }
    return best;
  }

  function xOf(L, t) {                              // piecewise-linear time -> x within a line
    const c = L.cells;
    if (t <= c[0].on) return c[0].x;
    for (let k = 0; k < c.length; k++) {
      if (t <= c[k].end) return c[k].x + (c[k].w * (t - c[k].on)) / Math.max(1e-6, c[k].end - c[k].on);
      const nx = c[k + 1];
      if (nx && t < nx.on) return c[k].x + c[k].w + ((nx.x - c[k].x - c[k].w) * (t - c[k].end)) / Math.max(1e-6, nx.on - c[k].end);
    }
    const l = c[c.length - 1];
    return l.x + l.w;
  }

  function render() {
    const avail = Math.max(280, (root.clientWidth || 640) - (window.innerWidth > 560 ? 62 : 0));
    pps = choosePps(avail);
    layout = byLine.map((ids) => layoutLine(sy, st, ids, pps));
    const W = Math.max(...layout.map((l) => l.width));
    root.innerHTML = '';
    lines.forEach((ln, r) => {
      const L = layout[r];
      const row = document.createElement('div'); row.className = 'rb-row';
      row.innerHTML = `<div class="rb-label">${lines.length > 1 ? `Line ${r + 1}` : ''}</div><div class="rb-scroll" tabindex="-1"><div class="rb-line" style="width:${Math.ceil(Math.max(L.width, Math.min(W, avail)))}px" data-line="${r}">
        <div class="rb-cells">${L.cells.map((c) => {
          const s = sy[c.i];
          return `<button type="button" class="rb-cell" data-i="${c.i}" tabindex="${c.i === byLine[0][0] ? 0 : -1}" style="left:${c.x.toFixed(1)}px;width:${c.w.toFixed(1)}px" lang="sa"
            aria-label="Syllable ${c.i + 1} of ${sy.length}: ${esc(s.iast)}, starts at ${c.on.toFixed(1)} seconds. Press to play from here."><span class="d">${esc(s.deva)}</span><span class="r">${esc(s.iast)}</span></button>`;
        }).join('')}</div>
        <div class="rb-band"><svg viewBox="0 0 ${Math.ceil(L.width)} ${BAND_H}" preserveAspectRatio="none" aria-hidden="true"></svg></div>
        <div class="rb-marks"></div><div class="rb-head"></div></div></div>`;
      root.appendChild(row);
    });
    drawBands(); drawMarks(); paintNow(true);
  }

  function svgEl(tag, attrs) { const e = document.createElementNS(NS, tag); for (const k in attrs) e.setAttribute(k, attrs[k]); return e; }
  function drawBands() {
    root.querySelectorAll('.rb-line').forEach((lineEl) => {
      const r = Number(lineEl.dataset.line), L = layout[r], svg = lineEl.querySelector('svg');
      svg.innerHTML = '';
      svg.setAttribute('viewBox', `0 0 ${Math.ceil(lineEl.clientWidth || L.width)} ${BAND_H}`);
      const VW = Math.ceil(lineEl.clientWidth || L.width);
      for (const c of L.cells) svg.appendChild(svgEl('line', { x1: c.x, x2: c.x, y1: 0, y2: BAND_H, class: 'rb-grid' }));
      svg.appendChild(svgEl('line', { x1: 0, x2: VW, y1: BAND_H / 2, y2: BAND_H / 2, class: 'rb-axis' }));
      const t0 = L.cells[0].on, t1 = L.cells[L.cells.length - 1].end;
      if (energy) {
        const mx = Math.max(...energy), lo = mx - 45, f0 = Math.max(0, Math.floor(t0 * 100)), f1 = Math.min(energy.length - 1, Math.ceil(t1 * 100));
        let d = `M${xOf(L, f0 / 100).toFixed(1)},${BAND_H}`;
        for (let f = f0; f <= f1; f += 2) d += ` L${xOf(L, f / 100).toFixed(1)},${(BAND_H - 4 - Math.max(0, Math.min(1, (energy[f] - lo) / 45)) * (BAND_H * 0.55)).toFixed(1)}`;
        d += ` L${xOf(L, f1 / 100).toFixed(1)},${BAND_H} Z`;
        svg.appendChild(svgEl('path', { d, class: 'rb-energy' }));
      }
      for (const s of series) {
        let d = '', pen = false;
        for (let k = 0; k < s.t.length; k++) {
          const t = s.t[k], c = s.c[k];
          if (t < t0 || t > t1) { pen = false; continue; }
          if (!Number.isFinite(c)) { pen = false; continue; }
          const y = BAND_H / 2 - (Math.max(-range, Math.min(range, c)) / range) * (BAND_H / 2 - 6);
          d += `${pen ? 'L' : 'M'}${xOf(L, t).toFixed(1)},${y.toFixed(1)} `; pen = true;
        }
        if (d) svg.appendChild(svgEl('path', { d, class: s.cls === 'take' ? 'rb-pitch-take' : 'rb-pitch-ref', 'vector-effect': 'non-scaling-stroke' }));
      }
    });
  }
  function drawMarks() {
    root.querySelectorAll('.rb-line').forEach((lineEl) => {
      const L = layout[Number(lineEl.dataset.line)], box = lineEl.querySelector('.rb-marks');
      box.innerHTML = ''; box.style.height = marks.length ? '' : '0';
      for (const m of marks) {
        const c = L.cells.find((q) => q.i === m.i); if (!c) continue;
        const d = document.createElement('div');
        d.className = 'rb-mark ' + (m.kind || 'slip'); d.style.left = c.x + 'px'; d.style.width = c.w + 'px';
        d.textContent = m.label || ''; d.title = m.title || m.label || '';
        box.appendChild(d);
        const btn = lineEl.querySelector(`.rb-cell[data-i="${m.i}"]`);
        if (btn && m.title) btn.setAttribute('aria-label', btn.getAttribute('aria-label') + ' ' + m.title + '.');
      }
    });
  }

  // ---- playback sync ----
  function cellAt(t) {
    let found = -1;
    for (let r = 0; r < layout.length; r++) for (const c of layout[r].cells) if (c.on <= t) found = c.i;
    return found;
  }
  function lineOf(i) { return byLine.findIndex((ids) => ids.includes(i)); }
  function paintNow(force) {
    const t = audio ? audio.currentTime : 0, active = audio && (!audio.paused || t > 0) ? cellAt(t) : -1;
    if (active === now && !force) { moveHead(t, active); return; }
    now = active;
    root.querySelectorAll('.rb-cell').forEach((b) => { const i = Number(b.dataset.i); b.classList.toggle('now', i === active); b.classList.toggle('played', active >= 0 && i < active); if (i === active) b.setAttribute('aria-current', 'true'); else b.removeAttribute('aria-current'); });
    root.dataset.now = String(active);
    moveHead(t, active);
  }
  function moveHead(t, active) {
    const r = active >= 0 ? lineOf(active) : -1;
    root.querySelectorAll('.rb-line').forEach((lineEl) => {
      const on = Number(lineEl.dataset.line) === r;
      lineEl.classList.toggle('playing', on && audio && !audio.paused);
      if (on) {
        const x = xOf(layout[r], t);
        lineEl.querySelector('.rb-head').style.left = x + 'px';
        const sc = lineEl.parentElement;
        if (audio && !audio.paused && (x < sc.scrollLeft + 24 || x > sc.scrollLeft + sc.clientWidth - 24)) sc.scrollLeft = Math.max(0, x - sc.clientWidth / 3);
      }
    });
  }
  function loop() { paintNow(false); if (audio && !audio.paused) raf = requestAnimationFrame(loop); }
  function setAudio(el) {
    if (audio) ['play', 'pause', 'seeked', 'ended', 'timeupdate'].forEach((ev) => audio.removeEventListener(ev, onEv));
    audio = el;
    if (audio) ['play', 'pause', 'seeked', 'ended', 'timeupdate'].forEach((ev) => audio.addEventListener(ev, onEv));
    paintNow(true);
  }
  function onEv(e) { if (e.type === 'play') { cancelAnimationFrame(raf); raf = requestAnimationFrame(loop); } else paintNow(false); if (e.type === 'ended') { now = -2; paintNow(true); } }

  root.addEventListener('click', (e) => {
    const b = e.target.closest('.rb-cell'); if (!b || !audio) return;
    audio.currentTime = st[Number(b.dataset.i)][0];
    audio.play().catch(() => {});
  });
  root.addEventListener('keydown', (e) => {                      // arrow keys move between cells; one tab stop per ribbon
    if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(e.key)) return;
    const cells = [...root.querySelectorAll('.rb-cell')], cur = cells.indexOf(document.activeElement); if (cur < 0) return;
    const nx = e.key === 'Home' ? 0 : e.key === 'End' ? cells.length - 1 : clamp(cur + (e.key === 'ArrowRight' ? 1 : -1), 0, cells.length - 1);
    cells.forEach((c) => c.setAttribute('tabindex', '-1')); cells[nx].setAttribute('tabindex', '0'); cells[nx].focus(); e.preventDefault();
  });
  const clamp = (x, a, b) => Math.min(b, Math.max(a, x));

  let rt = 0;
  const ro = new ResizeObserver(() => { clearTimeout(rt); rt = setTimeout(() => { const w = root.clientWidth; if (Math.abs(w - (render.lastW || 0)) > 4) { render.lastW = w; render(); } }, 120); });
  ro.observe(root);
  onTheme(drawBands);
  render.lastW = root.clientWidth; render();


  return {
    setAudio,
    setMarks(m) { marks = m || []; drawMarks(); },
    setEnergy(db) { energy = db; drawBands(); },
    setPitch(s, o = {}) { series = s || []; range = o.range || 400; pitchNote = o.note || ''; drawBands(); },
    redraw: render,
    cells: () => layout.flatMap((l) => l.cells),
    flagged: () => marks.map((m) => m.i),
    summary() {
      const n = sy.length, T = (verse.analysis_span[1] - verse.analysis_span[0]).toFixed(1);
      const m = marks.length ? ` ${marks.length} syllable${marks.length > 1 ? 's are' : ' is'} marked: ${marks.map((q) => `${sy[q.i].iast} (${q.label || q.kind})`).join(', ')}.` : '';
      const p = series.length ? ` Pitch is drawn as ${series.map((s) => (s.cls === 'take' ? 'a gold line for your take' : 'an indigo line for the reference')).join(' and ')}, within plus or minus ${range} cents of each take's own median.` : '';
      return `${n} syllables over about ${T} seconds, in ${lines.length} line${lines.length > 1 ? 's' : ''}. Each cell sits at the moment the syllable starts; very short syllables are widened so they stay readable.${p}${m}${pitchNote ? ' ' + pitchNote : ''}`;
    },
    get nowIndex() { return now; },
  };
}
