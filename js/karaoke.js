'use strict';

import { CONFIG } from './state.js';

/* ==========================================================================
   FOLLOW-ALONG ("KARAOKE") HIGHLIGHTING (#61)
   While a verse's recitation plays, the Devanagari and the transliteration light up in time with the voice: the current
   WORD softly, the current AKSHARA (syllable) strongly. The times come from a timings.json per recitation set:
     verses[n].aksharas = [{i, deva, iast, word, line, start, end, pass?}]   seconds from the start of the clip
   (one entry per sounded akshara in time order; `i` is the akshara's place in the DISPLAYED text, so a line sung several
   times, verse 14's closing line, appears once per pass with the same `i`). Where it is looked for: the manifest's
   `timings` path, then the copy bundled with the app (audio/sets/<set>/timings.json). A set with neither plays with no
   highlight and no error.
   How it works (ported from the Sundarkand viewer's player, which lights whole lines): a requestAnimationFrame loop reads
   audio.currentTime while the audio plays, binary-searches the timings, and moves two classes; a seek is simply the next
   frame. Nothing is rewritten in the page while it is not playing: the verse's text nodes are wrapped in spans when
   playback starts and the saved markup is put back when it stops. Aksharas are wrapped WHOLE (a conjunct is never split).
   ========================================================================== */

const KEY_ON = 'dmv-follow', KEY_UNIT = 'dmv-follow-unit';
const HOLD_S = 0.6;          // an akshara stays lit until the next one starts, but at most this long after its own end (silence is not lit)
const DURATION_TOLERANCE_S = 0.3;

let timings = null;          // {verses:{n:{...}}} for the current set, or null
let audio = null, getVerse = function() { return null; };
let on = readFlag(KEY_ON, true), unit = readText(KEY_UNIT, 'syllable');
let deco = null;             // the decorated verse: {n, article, layers:[{el, saved, a:[], w:[]}], vt, k, userScrolled}
let raf = 0;

function readFlag(key, dflt) { try { const v = localStorage.getItem(key); return v === null ? dflt : v === '1'; } catch (e) { return dflt; } }
function readText(key, dflt) { try { return localStorage.getItem(key) || dflt; } catch (e) { return dflt; } }
function save(key, v) { try { localStorage.setItem(key, v); } catch (e) { /* private mode */ } }

/* ---------- pure: time -> akshara (no DOM; the node tests drive this) ---------- */

/** Index (into vt.aksharas) of the akshara lit at time t, or -1 for before the first / a silence. */
export function activeAt(vt, t, hold) {
    const a = vt.aksharas, h = hold == null ? HOLD_S : hold;
    let lo = 0, hi = a.length - 1, k = -1;
    while (lo <= hi) { const mid = (lo + hi) >> 1; if (a[mid].start <= t) { k = mid; lo = mid + 1; } else { hi = mid - 1; } }
    if (k < 0) return -1;
    const next = k + 1 < a.length ? a[k + 1].start : Infinity;
    return t < Math.min(next, a[k].end + h) ? k : -1;
}

/* ---------- loading ---------- */

/** timings.json for a set: the manifest's `timings` path, else the bundled copy, else null. */
export async function loadTimings(manifestUrl, manifest, setId) {
    const urls = [];
    if (manifest && manifest.timings) urls.push(new URL(manifest.timings, manifestUrl).href);
    urls.push(new URL('audio/sets/' + encodeURIComponent(setId) + '/timings.json', document.baseURI).href);
    for (const url of urls) {
        try {
            const r = await fetch(url);
            if (!r.ok) continue;
            const doc = await r.json();
            if (doc && doc.schema === 1 && doc.verses) return doc;
        } catch (e) { /* try the next place */ }
    }
    return null;
}

export function setTimings(doc) { stop(); timings = doc || null; }
export function hasTimings() { return !!timings; }

/* ---------- the DOM: wrap whole aksharas, remember the original markup ---------- */

const SEPARATOR = /[\s |।॥0-9०-९]/;

/** Plan the wrapping of one element's text nodes; null when the pieces do not match the text exactly (then nothing is touched). */
function plan(el, pieces, field) {
    const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT), nodes = [];
    let p = 0, n;
    while ((n = walker.nextNode())) nodes.push(n);
    const out = [];
    for (const node of nodes) {
        const s = node.nodeValue, parts = [];
        let pos = 0, buf = '';
        while (pos < s.length) {
            const piece = p < pieces.length ? pieces[p][field] : null;
            if (piece && s.startsWith(piece, pos)) {
                if (buf) { parts.push({ text: buf }); buf = ''; }
                parts.push({ piece: p }); pos += piece.length; p++;
            } else if (SEPARATOR.test(s[pos])) { buf += s[pos]; pos++; }
            else return null;
        }
        if (buf) parts.push({ text: buf });
        out.push({ node, parts });
    }
    return p === pieces.length ? out : null;
}

function decorateLayer(el, pieces, field) {
    if (!el || pieces.some(function(x) { return !x[field]; })) return null;
    const steps = plan(el, pieces, field);
    if (!steps) return null;
    const layer = { el, saved: el.innerHTML, a: [], w: [] };
    for (const { node, parts } of steps) {
        const frag = document.createDocumentFragment();
        let wordEl = null, wordId = -1;
        for (const part of parts) {
            if (part.text !== undefined) { wordEl = null; wordId = -1; frag.appendChild(document.createTextNode(part.text)); continue; }
            const piece = pieces[part.piece];
            if (!wordEl || piece.word !== wordId) {
                wordEl = document.createElement('span'); wordEl.className = 'kw'; wordEl.dataset.w = piece.word; wordId = piece.word;
                frag.appendChild(wordEl); layer.w[piece.word] = wordEl;
            }
            const ak = document.createElement('span');
            ak.className = 'ka'; ak.dataset.i = piece.i; ak.textContent = piece[field];
            wordEl.appendChild(ak); layer.a[piece.i] = ak;
        }
        node.parentNode.replaceChild(frag, node);
    }
    return layer;
}

/** Wrap the aksharas of one verse card for follow-along. Returns the decoration, or null (text untouched) when it does not fit. */
export function decorateVerse(article, vt) {
    const seen = {}, pieces = [];
    vt.aksharas.forEach(function(x) { if (!seen[x.i]) { seen[x.i] = 1; pieces.push(x); } });
    pieces.sort(function(x, y) { return x.i - y.i; });
    const layers = [decorateLayer(article.querySelector('.sanskrit'), pieces, 'deva'),
                    decorateLayer(article.querySelector('.transliteration'), pieces, 'iast')].filter(Boolean);
    return layers.length ? { article, layers, vt, k: -2, userScrolled: false } : null;
}

/** Put the verse card's original markup back (exactly what render.js produced). */
export function undecorateVerse(d) {
    if (!d) return;
    d.layers.forEach(function(l) { if (l.el.isConnected) l.el.innerHTML = l.saved; });
}

/* ---------- painting ---------- */

function paint(k) {
    if (!deco || k === deco.k) return;
    deco.k = k;
    const e = k >= 0 ? deco.vt.aksharas[k] : null, byAkshara = unit === 'syllable';
    deco.layers.forEach(function(l) {
        l.el.querySelectorAll('.is-word, .is-akshara').forEach(function(x) { x.classList.remove('is-word', 'is-akshara'); });
        if (!e) return;
        if (l.w[e.word]) l.w[e.word].classList.add('is-word');
        if (byAkshara && l.a[e.i]) l.a[e.i].classList.add('is-akshara');
    });
    if (e) keepInView(e.i);
}

/** Bring the lit akshara into view only when it is off-screen; never pull a reader back who has scrolled away. */
function keepInView(i) {
    if (deco.userScrolled) return;
    const layer = deco.layers.filter(function(l) { return l.a[i] && l.a[i].getClientRects().length; })[0];
    if (!layer) return;
    const r = layer.a[i].getBoundingClientRect(), bar = document.querySelector('.controls');
    const top = (bar && getComputedStyle(bar).position !== 'static' ? Math.max(0, bar.getBoundingClientRect().bottom) : 0) + 8;
    const bottom = window.innerHeight - 8;
    if (r.top >= top && r.bottom <= bottom) return;
    const reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    window.scrollBy({ top: r.top - (top + (bottom - top) / 2 - r.height / 2), behavior: reduce ? 'instant' : 'smooth' });   // 'instant', not 'auto': the page's CSS sets scroll-behavior: smooth
}

function leadS() { return ((CONFIG.audio && Number(CONFIG.audio.followLeadMs)) || 0) / 1000; }
function update() { if (deco && audio) paint(activeAt(deco.vt, audio.currentTime + leadS())); }
function frame() { raf = 0; if (deco && audio && !audio.paused) { update(); raf = requestAnimationFrame(frame); } }

/* ---------- lifecycle ---------- */

function durationFits(vt) { return !isFinite(audio.duration) || Math.abs(audio.duration - vt.duration) <= DURATION_TOLERANCE_S; }

function begin() {
    const n = getVerse();
    if (!on || !timings || n == null || !audio) { return; }
    if (deco && deco.n === n && deco.article.isConnected) { if (!raf) raf = requestAnimationFrame(frame); update(); return; }
    stop();
    const vt = timings.verses[String(n)], article = document.getElementById('verse-' + n);
    if (!vt || !article) return;
    if (!durationFits(vt)) { console.warn('Follow-along off for verse ' + n + ': the clip lasts ' + audio.duration.toFixed(2) + ' s, the timings expect ' + vt.duration + ' s'); return; }
    const d = decorateVerse(article, vt);
    if (!d) { console.warn('Follow-along off for verse ' + n + ': the timings do not match the displayed text'); return; }
    d.n = n; deco = d;
    update();
    raf = requestAnimationFrame(frame);
}

/** Clear the highlight and restore the verse's markup (pause, stop, end, a switch off, a new recitation set). */
export function stop() {
    if (raf) { cancelAnimationFrame(raf); raf = 0; }
    undecorateVerse(deco);
    deco = null;
}

/** After the verse cards were re-rendered (language change) while a verse plays: decorate the fresh card. */
export function refreshFollow() { deco = null; if (audio && !audio.paused) begin(); }

/** Hook the shared <audio>. `verseGetter` returns the verse number now playing (or null). */
export function attachKaraoke(audioEl, verseGetter) {
    audio = audioEl; getVerse = verseGetter;
    audio.addEventListener('playing', begin);
    audio.addEventListener('seeked', update);
    audio.addEventListener('timeupdate', update);
    ['pause', 'ended', 'emptied', 'abort', 'error'].forEach(function(ev) { audio.addEventListener(ev, stop); });
    const held = function() { if (deco) deco.userScrolled = true; };
    window.addEventListener('wheel', held, { passive: true });
    window.addEventListener('touchmove', held, { passive: true });
    window.addEventListener('keydown', function(e) { if (/^(PageUp|PageDown|Home|End|ArrowUp|ArrowDown| )$/.test(e.key)) held(); });
}

/** Wire the "Follow along" checkbox + syllable/word select (shown only when audio is available). */
export function initFollowControls() {
    const group = document.getElementById('followGroup'), box = document.getElementById('followToggle'), sel = document.getElementById('followUnit');
    if (!group || !box || !sel) return;
    group.hidden = false;
    box.checked = on; sel.value = unit;
    sel.disabled = !on;
    box.addEventListener('change', function() {
        on = box.checked; save(KEY_ON, on ? '1' : '0'); sel.disabled = !on;
        if (on) begin(); else stop();
    });
    sel.addEventListener('change', function() {
        unit = sel.value === 'word' ? 'word' : 'syllable'; save(KEY_UNIT, unit);
        if (deco) { const k = deco.k; deco.k = -2; paint(k); }
    });
}
