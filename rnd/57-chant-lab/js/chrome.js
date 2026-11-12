// chrome.js: what every page shares: the where-am-I bar, previous/next, the footer, the contents list, glossary links with
// popovers, and the Keep / Improve / Drop feedback lines. Import it first on every page. Nothing here names a chant.
import { loadChant, store, storeSet, esc } from './lib.js';
import { GLOSSARY } from './glossary.js';

export const BOOK = [
  { id: 'index', href: 'index.html', title: 'Contents', promise: '' },
  { id: 'ch1', href: 'ch1.html', n: 1, title: 'What "correct" can mean for a chant', promise: 'Three things a listener can check, and what a machine can and cannot hear.' },
  { id: 'ch2', href: 'ch2.html', n: 2, title: 'Hearing the verse as data', promise: 'Watch the syllables light up in time with the sound, and see the pauses the machine sees.' },
  { id: 'ch3', href: 'ch3.html', n: 3, title: 'Lining up two takes', promise: 'How two takes at different speeds are matched, shown on two real takes.' },
  { id: 'ch4', href: 'ch4.html', n: 4, title: 'Pitch', promise: 'How pitch is tracked and compared after the takes are lined up.' },
  { id: 'ch5', href: 'ch5.html', n: 5, title: 'How apps score pronunciation', promise: 'The idea behind the apps, and what they publish.' },
  { id: 'ch6', href: 'ch6.html', n: 6, title: 'A sound model for Sanskrit', promise: 'The deeper check: what it needs, what it hears, and where it runs.' },
  { id: 'ch7', href: 'ch7.html', n: 7, title: 'How well it works so far', promise: 'The planted-slip test and its results, verse by verse.' },
  { id: 'ch8', href: 'ch8.html', n: 8, title: 'What we do not know yet', promise: 'Every limit we know of, and the test that is still missing.' },
  { id: 'ch9', href: 'ch9.html', n: 9, title: 'Where the audio lives', promise: 'Your own files, a copy on the device, or the cloud, in plain words.' },
  { id: 'lab1', href: 'lab1.html', lab: 1, title: 'Lab 1: record and play back', promise: 'Record a take, or load a file, and hear it back.' },
  { id: 'lab2', href: 'lab2.html', lab: 2, title: 'Lab 2: compare your take with the reference', promise: 'A difference for every syllable, and how sure the tool is.' },
  { id: 'lab3', href: 'lab3.html', lab: 3, title: 'Lab 3: calibration', promise: 'Plant a known slip and see whether it is caught, with a running tally.' },
  { id: 'sources', href: 'sources.html', title: 'Sources', back: 'Sources', promise: '' },
  { id: 'glossary', href: 'glossary.html', title: 'Glossary', back: 'Glossary', promise: '' },
];
const SEQ = BOOK.map((b) => b.id);
const here = document.body.dataset.page || 'index';
const FB_KEY = 'feedback:v1';

function bar() {
  const el = document.createElement('header'); el.className = 'bar';
  const chap = BOOK.filter((b) => b.n), labs = BOOK.filter((b) => b.lab), back = BOOK.filter((b) => b.back);
  const seen = new Set(store('visited', []));
  const link = (b, text, label, cls = '') => `<a href="${b.href}" ${b.id === here ? 'aria-current="page"' : ''} class="${cls} ${seen.has(b.id) && b.id !== here ? 'visited' : ''}" aria-label="${esc(label)}" title="${esc(b.title)}">${text}</a>`;
  el.innerHTML = `<a class="brand" href="index.html">Chant lab</a>
    <nav aria-label="Chapters, labs and reference pages">${chap.map((b) => link(b, b.n, `Chapter ${b.n}: ${b.title}`)).join('')}<span class="sep" aria-hidden="true"></span>${labs.map((b) => link(b, `L${b.lab}`, b.title)).join('')}<span class="sep" aria-hidden="true"></span>${back.map((b) => link(b, b.back, b.title, 'wide')).join('')}</nav>
    <span class="spacer"></span><button type="button" class="tbtn" id="theme" aria-label="Switch between dark and light" title="Switch between dark and light">&#9680;</button>`;
  document.body.prepend(el);
  el.querySelector('#theme').addEventListener('click', () => {
    const cur = document.documentElement.getAttribute('data-theme') || (matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark');
    const next = cur === 'dark' ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', next); storeSet('theme', next);
  });
  const s = new Set(store('visited', [])); s.add(here); storeSet('visited', [...s]);
}

function where() {
  const b = BOOK.find((x) => x.id === here); const h1 = document.querySelector('main h1'); if (!b || !h1) return;
  let t = '';
  if (b.n) t = `Chapter ${b.n} of ${BOOK.filter((x) => x.n).length}`; else if (b.lab) t = `Lab ${b.lab} of 3`; else if (b.back) t = `Back of the book: ${b.back}`; else return;
  const p = document.createElement('p'); p.className = 'where'; p.textContent = t; h1.before(p);
}

function pager() {
  const box = document.querySelector('[data-pager]'); if (!box) return;
  const i = SEQ.indexOf(here), prev = BOOK[i - 1], next = BOOK[i + 1];
  box.className = 'pager'; box.setAttribute('aria-label', 'Previous and next page');
  box.innerHTML = `${prev ? `<a href="${prev.href}" rel="prev">Previous: ${esc(prev.title)}</a>` : '<span></span>'}${next ? `<a href="${next.href}" rel="next">Next: ${esc(next.title)}</a>` : '<span></span>'}`;
}

function contents() {
  const ol = document.querySelector('[data-chapters]'); if (!ol) return;
  ol.innerHTML = BOOK.filter((b) => b.promise).map((b) => `<li><span class="n">${b.n || (b.lab ? 'Lab' : '')}</span><a href="${b.href}">${esc(b.title)}</a><p>${esc(b.promise)}</p></li>`).join('');
}

// ---- glossary terms: the first use of each term on a page links to its entry; hover, focus or a tap shows the definition ----
function linkTerms() {
  if (here === 'glossary') return;
  const roots = [...document.querySelectorAll('main .col')];
  if (!roots.length) return;
  const used = new Set();
  const skip = (n) => !n || n.closest('a, h1, h2, h3, summary, button, label, option, select, script, style, pre, code, .stage, .fb, .pager, .where, [data-noterm]');
  const entries = GLOSSARY.filter((g) => g.re).map((g) => ({ g, rx: new RegExp(g.re, 'i') }));
  for (const root of roots) {
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    const queue = []; for (let n = walker.nextNode(); n; n = walker.nextNode()) queue.push(n);
    while (queue.length) {
      const node = queue.shift();
      if (!node.nodeValue.trim() || skip(node.parentElement)) continue;
      // the earliest match in this text node among terms not yet linked
      let best = null;
      for (const e of entries) { if (used.has(e.g.id)) continue; const m = e.rx.exec(node.nodeValue); if (m && (!best || m.index < best.m.index)) best = { e, m }; }
      if (!best) continue;
      used.add(best.e.g.id);
      const rest = node.splitText(best.m.index), after = rest.splitText(best.m[0].length);
      const a = document.createElement('a'); a.className = 'term'; a.href = `glossary.html#${best.e.g.id}`; a.dataset.term = best.e.g.id; a.textContent = rest.nodeValue;
      rest.replaceWith(a);
      if (after.nodeValue) queue.unshift(after);
    }
  }
}
function termPopover() {
  const pop = document.createElement('div'); pop.id = 'termpop'; pop.setAttribute('role', 'tooltip'); pop.hidden = true; document.body.appendChild(pop);
  const defs = Object.fromEntries(GLOSSARY.map((g) => [g.id, g]));
  let cur = null;
  const show = (a) => {
    const g = defs[a.dataset.term]; if (!g) return;
    cur = a; pop.innerHTML = `<b>${esc(g.term)}.</b> ${esc(g.def)} <a href="${a.getAttribute('href')}">Open in the glossary</a>`; pop.hidden = false;
    a.setAttribute('aria-describedby', 'termpop');
    const r = a.getBoundingClientRect(), w = Math.min(320, window.innerWidth - 16);
    pop.style.width = w + 'px'; pop.style.left = Math.max(8, Math.min(window.innerWidth - w - 8, r.left + window.scrollX)) + 'px'; pop.style.top = (r.bottom + window.scrollY + 6) + 'px';
  };
  const hide = () => { pop.hidden = true; if (cur) cur.removeAttribute('aria-describedby'); cur = null; };
  document.addEventListener('mouseover', (e) => { const a = e.target.closest && e.target.closest('a.term'); if (a) show(a); });
  document.addEventListener('mouseout', (e) => { const a = e.target.closest && e.target.closest('a.term'); if (a) setTimeout(() => { if (!pop.matches(':hover') && !(cur && cur.matches(':focus'))) hide(); }, 250); });
  document.addEventListener('focusin', (e) => { const a = e.target.closest && e.target.closest('a.term'); if (a) show(a); });
  document.addEventListener('focusout', (e) => { if (e.target.closest && e.target.closest('a.term') && !pop.contains(e.relatedTarget)) hide(); });
  document.addEventListener('click', (e) => {
    const a = e.target.closest && e.target.closest('a.term');
    if (a) { e.preventDefault(); if (cur === a && !pop.hidden) hide(); else show(a); return; }
    if (!pop.contains(e.target)) hide();
  });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') hide(); });
}
function glossaryPage() {
  const dl = document.querySelector('[data-glossary]'); if (!dl) return;
  dl.innerHTML = GLOSSARY.map((g) => `<dt id="${g.id}"><b>${esc(g.term)}</b></dt><dd>${esc(g.def)}</dd>`).join('');
  if (location.hash) { const t = document.getElementById(location.hash.slice(1)); if (t) t.scrollIntoView(); }
}

// ---- feedback: Keep / Improve / Drop + a note per element, in localStorage, exportable as JSON ----
const all = () => store(FB_KEY, {});
export function fbLine(el) {
  const id = el.dataset.fb, label = el.dataset.label || id, cur = all()[id] || {};
  el.classList.add('fb');
  el.innerHTML = `<span id="${id}-l">Your call on ${esc(label)}:</span>
    <span class="opts" role="radiogroup" aria-labelledby="${id}-l">${['Keep', 'Improve', 'Drop'].map((v) => `<label><input type="radio" name="fb-${id}" value="${v.toLowerCase()}" ${cur.verdict === v.toLowerCase() ? 'checked' : ''}>${v}</label>`).join('')}</span>
    <input type="text" aria-label="Note on ${esc(label)}" placeholder="Note (optional)" value="${esc(cur.note || '')}"><span class="saved" role="status"></span>`;
  const note = el.querySelector('input[type="text"]'), saved = el.querySelector('.saved');
  const save = () => {
    const v = el.querySelector('input[type="radio"]:checked');
    const db = all(); db[id] = { id, label, page: here, verdict: v ? v.value : null, note: note.value, saved: new Date().toISOString() };
    saved.textContent = storeSet(FB_KEY, db) ? 'Saved' : 'Could not save (storage is blocked)';
    refreshCount();
  };
  el.addEventListener('change', save); note.addEventListener('input', save);
}
function refreshCount() { const n = Object.values(all()).filter((x) => x.verdict || x.note).length; document.querySelectorAll('[data-fbcount]').forEach((e) => { e.textContent = String(n); }); }
export function exportFeedback(chant) {
  return { chant: chant && chant.chant ? chant.chant.id : null, book: 'chant-lab (dmv #57)', exported: new Date().toISOString(), items: Object.values(all()).filter((x) => x.verdict || x.note) };
}
function footer(chant) {
  const f = document.createElement('footer'); f.className = 'site';
  f.innerHTML = `<div class="fbexport"><span><span data-fbcount>0</span> feedback items saved on this device.</span>
    <button type="button" id="fbexp">Export feedback as JSON</button><button type="button" id="fbclr">Clear feedback</button><span id="fbmsg" role="status"></span></div>
    <p>This is a test page for the record-and-compare feature (dmv #57). The live study tool does not link to it. <a href="index.html">Contents</a> &middot; <a href="sources.html">Sources</a> &middot; <a href="glossary.html">Glossary</a></p>`;
  document.querySelector('main').after(f);
  f.querySelector('#fbexp').addEventListener('click', () => {
    const data = exportFeedback(chant), blob = new Blob([JSON.stringify(data, null, 1)], { type: 'application/json' });
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'chant-lab-feedback.json'; document.body.appendChild(a); a.click(); a.remove();
    document.getElementById('fbmsg').textContent = `Exported ${data.items.length} items.`;
  });
  f.querySelector('#fbclr').addEventListener('click', () => {
    if (!confirm('Clear all saved feedback on this device? Export first if you want to keep it.')) return;
    storeSet(FB_KEY, {}); document.querySelectorAll('[data-fb]').forEach(fbLine); refreshCount(); document.getElementById('fbmsg').textContent = 'Cleared.';
  });
}

let chantRef = null;
export const ready = (async () => {
  bar(); where(); pager(); contents(); glossaryPage();
  try { chantRef = await loadChant(); } catch (e) { const m = document.querySelector('main'); if (m) m.insertAdjacentHTML('afterbegin', `<p class="status err" role="alert">chant.json could not be loaded (${esc(e.message)}). Serve this folder over http://localhost; opening the file directly does not work.</p>`); }
  footer(chantRef); linkTerms(); termPopover();
  document.querySelectorAll('[data-fb]').forEach(fbLine); refreshCount();
  window.__chantlab = Object.assign(window.__chantlab || {}, { feedback: () => all(), exportFeedback: () => exportFeedback(chantRef) });
  return chantRef;
})();
