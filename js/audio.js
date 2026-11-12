'use strict';

import { CONFIG } from './state.js';
import { escapeHtml } from './util.js';
import { t } from './i18n.js';
import { createAudioSource } from './audio-source.js';

/* ==========================================================================
   VERSE AUDIO (#56)
   One shared <audio id="verseAudio">, one play/stop button per verse, and a
   "recitation set" switcher. WHERE the audio lives is data, never code. The host (a Cloudflare Pages
   project) serves, next to the clips:
     <cloudBase>sets/index.json                 which sets exist; one is "recommended"
     <cloudBase>sets/<set>/manifest.json        verse -> file key, sha256, bytes, duration (relative `base`)
   and config.json holds the one value that points at it: audio.cloudBase (optional audio.offlineBase: a
   same-origin folder with the same layout). The player only calls createAudioSource().resolve(verse).
   Another reciter or day = upload clips + a manifest + an index entry on the host; nothing here changes.
   Both bases empty = feature off (no buttons, no switcher), so the app is unchanged.
   ========================================================================== */

const SET_KEY = 'dmv-audio-set';
let sets = [];            // every set offered (from the index, plus any audio.extraIndexes)
let chosen = null;        // the set the reader selected (may not be loaded yet if the host is down)
let current = null;       // the set whose manifest is loaded into `source`
let manifest = null;      // its manifest
let source = null;        // audio-source.js instance
let loadError = null;     // last failure to reach the host (null = fine)
let playingVerse = null;
let isPlaying = false;

const audioEl = function() { return document.getElementById('verseAudio'); };

/** True when a cloud or offline base is configured. */
export function audioEnabled() {
    const a = CONFIG.audio || {};
    return !!(a.cloudBase || a.offlineBase);
}

/** Markup for one verse's play button + status line (inside the verse card). Rendered whenever audio is configured, even if the host is down. */
export function audioButtonHTML(verseNumber) {
    if (!audioEnabled()) return '';
    return '<button type="button" class="verse-play" data-verse="' + verseNumber + '" aria-pressed="false" ' +
        'aria-label="' + labelFor('audio.play.aria', verseNumber) + '" title="' + labelFor('audio.play.aria', verseNumber) + '">' +
        '<span aria-hidden="true">&#9654;</span></button>' +
        '<div class="verse-audio-status" id="audioStatus-' + verseNumber + '" role="status" aria-live="polite"></div>';
}

function labelFor(key, n) { return escapeHtml(t(key).replace('{n}', n)); }

async function getJson(url) {
    const r = await fetch(url);
    if (!r.ok) throw new Error(url + ': HTTP ' + r.status);
    return r.json();
}

const absRoot = function(base) { return new URL(base.charAt(base.length - 1) === '/' ? base : base + '/', document.baseURI).href; };
let indexUrl = null, indexRoot = null;

/** Host named in the "could not be loaded" message. */
function hostLabel() {
    const base = (CONFIG.audio || {}).cloudBase || (CONFIG.audio || {}).offlineBase || '';
    try { return new URL(absRoot(base)).host; } catch (e) { return base; }
}

/** Translate a manifest into the config audio-source.js is driven by. The only place that knows both formats.
 *  Layout rule: set directory = manifest URL + manifest.base, expressed relative to the root that served the index, so the
 *  offline root (if configured) mirrors the cloud layout. A set from an extra index is used where its manifest says. */
function sourceConfig(set, m, manifestUrl) {
    const a = CONFIG.audio, dir = new URL(m.base || './', manifestUrl).href, sources = [], order = [];
    const rel = !set._indexUrl && dir.indexOf(indexRoot) === 0 ? dir.slice(indexRoot.length) : null;   // null: the manifest points elsewhere
    if (a.offlineBase && rel !== null) { sources.push({ kind: 'offline', base: new URL(rel, absRoot(a.offlineBase)).href, label: 'offline' }); order.push('offline'); }
    if (a.cloudBase || set._indexUrl) { sources.push({ kind: 'cloud', base: rel !== null ? new URL(rel, absRoot(a.cloudBase)).href : dir, label: 'cloud' }); order.push('cloud'); }
    return {
        version: 1, set: { id: set.id, label: m.label || set.label }, sources, order,
        verses: Object.keys(m.verses || {}).map(function(n) {
            const v = m.verses[n];
            return { id: Number(n), file: v.key, sha256: v.sha256 || null, duration: v.duration || null, codec: v.codec || null, set: m.label || set.label };
        })
    };
}

async function useSet(set) {
    const manifestUrl = new URL(set.manifest, set._indexUrl || indexUrl).href;
    const m = await getJson(manifestUrl);
    manifest = m;
    current = set;
    const cfg = sourceConfig(set, m, manifestUrl);
    if (source) source.setConfig(cfg); else source = createAudioSource(cfg);
}

function savedSetId() { try { return localStorage.getItem(SET_KEY); } catch (e) { return null; } }
function saveSetId(id) { try { localStorage.setItem(SET_KEY, id); } catch (e) { /* private mode */ } }

async function loadIndex() {
    const roots = [CONFIG.audio.cloudBase, CONFIG.audio.offlineBase].filter(Boolean).map(absRoot);
    let index = null, lastError = null;
    for (const root of roots) {                                       // cloud first, then the offline mirror
        try { indexUrl = new URL(CONFIG.audio.setsIndex, root).href; indexRoot = root; index = await getJson(indexUrl); break; }
        catch (e) { lastError = e; }
    }
    if (!index) throw lastError || new Error('no audio base configured');
    const list = (index.sets || []).filter(function(s) { return s && s.id && s.manifest; });
    if (!list.length) throw new Error('no sets in ' + indexUrl);
    // Preview/test hook: extra index files (empty in the committed config) add sets, for example a local fixture set.
    for (const url of (CONFIG.audio.extraIndexes || [])) {
        const full = new URL(url, document.baseURI).href;
        try {
            const extra = await getJson(full);
            (extra.sets || []).forEach(function(s) {
                if (s && s.id && s.manifest && !list.some(function(x) { return x.id === s.id; })) list.push(Object.assign({}, s, { _indexUrl: full, recommended: false }));
            });
        } catch (e) { console.warn('Extra audio index not loaded:', full, e.message); }
    }
    sets = list;
}

function pickDefault() {
    const saved = savedSetId();
    return sets.filter(function(s) { return s.id === saved; })[0] || sets.filter(function(s) { return s.recommended; })[0] || sets[0];
}

/** Make sure the index and the CHOSEN set's manifest are loaded; throws if the host cannot be reached. */
async function ensureLoaded() {
    if (!sets.length) await loadIndex();
    if (!chosen) chosen = pickDefault();
    if (!current || current.id !== chosen.id || !source) await useSet(chosen);
    loadError = null;
}

/** Load the index and the chosen set (saved choice > recommended > first). Call before renderVerses(). Never throws. */
export async function initAudio() {
    if (!audioEnabled()) return;
    try { await ensureLoaded(); } catch (error) { loadError = error; console.warn('Verse audio unavailable:', error.message); }
}

function setLabel(s) { return s.label + (s.recommended ? ' ★ ' + t('audio.recommended') : ''); }

function fillSetSelect() {
    const group = document.getElementById('audioSetGroup'), select = document.getElementById('audioSetSelect');
    if (!group || !select) return;
    group.hidden = !sets.length;
    if (!sets.length) return;
    select.innerHTML = '';
    sets.forEach(function(s) {
        const opt = document.createElement('option');
        opt.value = s.id; opt.textContent = setLabel(s);
        if (chosen && s.id === chosen.id) opt.selected = true;       // the reader's choice stays selected even if its manifest could not load
        select.appendChild(opt);
    });
}

/** The one visible "audio host unreachable" message, near the controls, with a Retry button. */
function renderNotice() {
    const box = document.getElementById('audioNotice'), text = document.getElementById('audioNoticeText');
    if (!box || !text) return;
    box.hidden = !loadError;
    if (loadError) text.textContent = t('audio.hostDown').replace('{host}', hostLabel());
}

/** Retry loading (Retry button, the browser coming back online). Resolves true on success. */
export async function retryAudio() {
    if (!audioEnabled()) return false;
    try { await ensureLoaded(); } catch (error) { loadError = error; console.warn('Verse audio unavailable:', error.message); }
    fillSetSelect(); renderNotice();
    return !loadError;
}

function statusEl(n) { return document.getElementById('audioStatus-' + n); }

function setStatus(n, text, isError) {
    const el = statusEl(n);
    if (!el) return;
    el.textContent = text || '';
    el.classList.toggle('verse-audio-status--error', !!isError);
}

function paintPlayingStatus() {
    if (playingVerse == null || !isPlaying) return;
    setStatus(playingVerse, t('audio.playing').replace('{n}', playingVerse).replace('{set}', (manifest && manifest.label) || (current && current.label) || ''), false);
}

/** Re-apply the playing state after the verse cards were re-rendered (language change). */
export function syncAudioButtons() {
    document.querySelectorAll('.verse-play').forEach(function(b) { paintButton(b, Number(b.dataset.verse) === playingVerse); });
    paintPlayingStatus();
}

function paintButton(btn, on) {
    const n = btn.dataset.verse;
    btn.setAttribute('aria-pressed', on ? 'true' : 'false');
    const label = t(on ? 'audio.stop.aria' : 'audio.play.aria').replace('{n}', n);
    btn.setAttribute('aria-label', label); btn.title = label;
    btn.firstElementChild.innerHTML = on ? '&#9632;' : '&#9654;';
}

export function stopAudio() {
    const a = audioEl();
    if (a) { a.pause(); a.removeAttribute('src'); delete a.dataset.sourceUrl; a.load(); }
    if (playingVerse != null && isPlaying) setStatus(playingVerse, '');   // "Playing verse N" is cleared on stop (errors stay)
    playingVerse = null; isPlaying = false;
    syncAudioButtons();
}

async function playVerse(n) {
    if (playingVerse === n) { stopAudio(); return; }
    stopAudio();
    document.querySelectorAll('.verse-audio-status').forEach(function(el) { el.textContent = ''; });
    playingVerse = n;
    syncAudioButtons();
    try { await ensureLoaded(); renderNotice(); fillSetSelect(); } catch (error) {
        loadError = error; console.warn('Verse audio unavailable:', error.message);
        if (playingVerse === n) { playingVerse = null; syncAudioButtons(); setStatus(n, t('audio.unavailable'), true); }
        renderNotice(); fillSetSelect();
        return;
    }
    const setAtStart = current.id;
    const r = await source.resolve(n);
    if (playingVerse !== n || current.id !== setAtStart) return;     // the reader moved on meanwhile
    if (r.missing) {
        playingVerse = null; syncAudioButtons();
        const why = r.tried.map(function(x) { return x.kind + ': ' + x.reason; }).join('; ');
        console.warn('No audio for verse ' + n + ' in set ' + current.id + ' (' + why + ')');
        setStatus(n, t('audio.missing').replace('{n}', n).replace('{set}', (manifest && manifest.label) || current.label) + ' (' + why + ')', true);
        return;
    }
    const a = audioEl();
    a.src = r.url;
    a.dataset.sourceUrl = r.sourceUrl || r.url;                       // the network URL behind a blob: URL (for tests and debugging)
    try { await a.play(); isPlaying = true; paintPlayingStatus(); } catch (error) {
        playingVerse = null; syncAudioButtons();
        setStatus(n, t('audio.playFailed').replace('{n}', n), true);
        console.warn('Audio play failed:', error.message);
    }
}

/** Wire the shared <audio>, the per-verse buttons (delegated, so re-renders keep working), the set switcher and the retry paths. */
export function initAudioControls() {
    if (!audioEnabled()) return;
    fillSetSelect(); renderNotice();
    const a = audioEl();
    if (a) {
        a.addEventListener('ended', function() { if (playingVerse != null) setStatus(playingVerse, ''); playingVerse = null; isPlaying = false; syncAudioButtons(); });
        a.addEventListener('error', function() {
            if (playingVerse == null || !a.getAttribute('src')) return;
            const n = playingVerse; playingVerse = null; isPlaying = false; syncAudioButtons();
            setStatus(n, t('audio.playFailed').replace('{n}', n), true);
        });
    }
    const container = document.getElementById('versesContainer');
    if (container) container.addEventListener('click', function(e) {
        const btn = e.target.closest('.verse-play');
        if (!btn) return;
        playVerse(Number(btn.dataset.verse));
    });
    const select = document.getElementById('audioSetSelect');
    if (select) select.addEventListener('change', async function() {
        const set = sets.filter(function(s) { return s.id === select.value; })[0];
        if (!set) return;
        chosen = set; saveSetId(set.id);                              // the reader's choice stands whether or not the host answers
        stopAudio();
        document.querySelectorAll('.verse-audio-status').forEach(function(el) { el.textContent = ''; });
        try { await ensureLoaded(); } catch (error) { loadError = error; console.warn('Could not load set ' + set.id + ':', error.message); }
        renderNotice();
    });
    const retry = document.getElementById('audioRetry');
    if (retry) retry.addEventListener('click', function() { retryAudio(); });
    window.addEventListener('online', function() { if (loadError) retryAudio(); });
}

/** Re-label the switcher and the notice after a language change. */
export function refreshAudioControls() { if (audioEnabled()) { fillSetSelect(); renderNotice(); } }
