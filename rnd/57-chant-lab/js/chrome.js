// chrome.js: what every page shares: the where-am-I bar, previous/next, the footer, the contents list and the
// Keep / Improve / Drop feedback lines. Import it first on every page. Nothing here names a chant.
import { loadChant, store, storeSet, esc } from './lib.js';

export const BOOK = [
  { id: 'index', href: 'index.html', title: 'Contents', promise: '' },
  { id: 'ch1', href: 'ch1.html', n: 1, title: 'What "correct" can mean for a chant', promise: 'Three things a listener can check, what a machine can and cannot hear, and the evidence we start from.' },
  { id: 'ch2', href: 'ch2.html', n: 2, title: 'Hearing the verse as data', promise: 'Watch the syllables light up in time with the sound, and see the pauses the machine sees.' },
  { id: 'ch3', href: 'ch3.html', n: 3, title: 'Lining up two takes', promise: 'How two takes at different speeds are matched, shown on two real takes, and how accurate that is.' },
  { id: 'ch4', href: 'ch4.html', n: 4, title: 'Pitch', promise: 'How pitch is tracked and compared after the takes are lined up.' },
  { id: 'ch5', href: 'ch5.html', n: 5, title: 'How apps score pronunciation', promise: 'The state of the art, what it costs, and what it gets wrong on Sanskrit.' },
  { id: 'ch6', href: 'ch6.html', n: 6, title: 'How well it works so far', promise: 'The planted-slip test, every limitation, and the test that is still missing.' },
  { id: 'ch7', href: 'ch7.html', n: 7, title: 'Where the audio lives', promise: 'Your own files, a copy on the device, or the cloud, in plain words.' },
  { id: 'lab1', href: 'lab1.html', lab: 1, title: 'Lab 1: record and play back', promise: 'Record a take, or load a file, and hear it back.' },
  { id: 'lab2', href: 'lab2.html', lab: 2, title: 'Lab 2: compare your take with the reference', promise: 'A difference for every syllable, with a confidence at every level.' },
  { id: 'lab3', href: 'lab3.html', lab: 3, title: 'Lab 3: calibration', promise: 'Plant a known slip and see whether it is caught, with a running tally.' },
  { id: 'sources', href: 'sources.html', title: 'Sources', promise: '' },
  { id: 'glossary', href: 'glossary.html', title: 'Glossary', promise: '' },
];
const SEQ = BOOK.map((b) => b.id);
const here = document.body.dataset.page || 'index';
const FB_KEY = 'feedback:v1';

function bar() {
  const el = document.createElement('header'); el.className = 'bar';
  const chap = BOOK.filter((b) => b.n), labs = BOOK.filter((b) => b.lab);
  const seen = new Set(store('visited', []));
  const link = (b, text, label) => `<a href="${b.href}" ${b.id === here ? 'aria-current="page"' : ''} class="${seen.has(b.id) && b.id !== here ? 'visited' : ''}" aria-label="${esc(label)}" title="${esc(b.title)}">${text}</a>`;
  el.innerHTML = `<a class="brand" href="index.html">Chant lab</a>
    <nav aria-label="Chapters and labs">${chap.map((b) => link(b, b.n, `Chapter ${b.n}: ${b.title}`)).join('')}<span class="sep" aria-hidden="true"></span>${labs.map((b) => link(b, `L${b.lab}`, b.title)).join('')}</nav>
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
  if (b.n) t = `Chapter ${b.n} of 7`; else if (b.lab) t = `Lab ${b.lab} of 3`; else return;
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
  bar(); where(); pager(); contents();
  try { chantRef = await loadChant(); } catch (e) { const m = document.querySelector('main'); if (m) m.insertAdjacentHTML('afterbegin', `<p class="status err" role="alert">chant.json could not be loaded (${esc(e.message)}). Serve this folder over http://localhost; opening the file directly does not work.</p>`); }
  footer(chantRef);
  document.querySelectorAll('[data-fb]').forEach(fbLine); refreshCount();
  window.__chantlab = Object.assign(window.__chantlab || {}, { feedback: () => all(), exportFeedback: () => exportFeedback(chantRef) });
  return chantRef;
})();
