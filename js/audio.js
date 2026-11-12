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
let sets = [];           // from the index
let current = null;      // the selected set (index entry)
let manifest = null;     // its manifest
let source = null;       // audio-source.js instance
let playingVerse = null;
let ready = false;

const audioEl = function() { return document.getElementById('verseAudio'); };

/** True when a cloud or offline base is configured. */
export function audioEnabled() {
    const a = CONFIG.audio || {};
    return !!(a.cloudBase || a.offlineBase);
}

/** Markup for one verse's play button + status line (inside the verse card). */
export function audioButtonHTML(verseNumber) {
    if (!ready) return '';
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

/** Translate a manifest into the config audio-source.js is driven by. The only place that knows both formats.
 *  Layout rule: set directory = manifest URL + manifest.base, expressed relative to the root that served the index, so the
 *  offline root (if configured) mirrors the cloud layout. */
function sourceConfig(set, m, manifestUrl) {
    const a = CONFIG.audio, dir = new URL(m.base || './', manifestUrl).href, sources = [], order = [];
    const rel = dir.indexOf(indexRoot) === 0 ? dir.slice(indexRoot.length) : null;     // null: the manifest points elsewhere
    if (a.offlineBase && rel !== null) { sources.push({ kind: 'offline', base: new URL(rel, absRoot(a.offlineBase)).href, label: 'offline' }); order.push('offline'); }
    if (a.cloudBase)   { sources.push({ kind: 'cloud', base: rel !== null ? new URL(rel, absRoot(a.cloudBase)).href : dir, label: 'cloud' }); order.push('cloud'); }
    return {
        version: 1, set: { id: set.id, label: m.label || set.label }, sources, order,
        verses: Object.keys(m.verses || {}).map(function(n) {
            const v = m.verses[n];
            return { id: Number(n), file: v.key, sha256: v.sha256 || null, duration: v.duration || null, set: m.label || set.label };
        })
    };
}

async function useSet(set) {
    const manifestUrl = new URL(set.manifest, indexUrl).href;
    manifest = await getJson(manifestUrl);
    current = set;
    const cfg = sourceConfig(set, manifest, manifestUrl);
    if (source) source.setConfig(cfg); else source = createAudioSource(cfg);
}

function savedSetId() { try { return localStorage.getItem(SET_KEY); } catch (e) { return null; } }
function saveSetId(id) { try { localStorage.setItem(SET_KEY, id); } catch (e) { /* private mode */ } }

/** Load the index and the chosen set (saved choice > recommended > first). Call before renderVerses(). */
export async function initAudio() {
    if (!audioEnabled()) return;
    try {
        const roots = [CONFIG.audio.cloudBase, CONFIG.audio.offlineBase].filter(Boolean).map(absRoot);
        let index = null, lastError = null;
        for (const root of roots) {                                       // cloud first, then the offline mirror
            try { indexUrl = new URL(CONFIG.audio.setsIndex, root).href; indexRoot = root; index = await getJson(indexUrl); break; }
            catch (e) { lastError = e; }
        }
        if (!index) throw lastError || new Error('no audio base configured');
        sets = (index.sets || []).filter(function(s) { return s && s.id && s.manifest; });
        if (!sets.length) throw new Error('no sets in ' + indexUrl);
        const saved = savedSetId();
        const pick = sets.filter(function(s) { return s.id === saved; })[0] ||
                     sets.filter(function(s) { return s.recommended; })[0] || sets[0];
        await useSet(pick);
        ready = true;
    } catch (error) {
        console.warn('Verse audio unavailable:', error.message);   // the app works without it
    }
}

function setLabel(s) { return s.label + (s.recommended ? ' ★ ' + t('audio.recommended') : ''); }

function fillSetSelect() {
    const group = document.getElementById('audioSetGroup'), select = document.getElementById('audioSetSelect');
    if (!group || !select) return;
    group.hidden = !ready;
    if (!ready) return;
    select.innerHTML = '';
    sets.forEach(function(s) {
        const opt = document.createElement('option');
        opt.value = s.id; opt.textContent = setLabel(s);
        if (current && s.id === current.id) opt.selected = true;
        select.appendChild(opt);
    });
}

function statusEl(n) { return document.getElementById('audioStatus-' + n); }

function setStatus(n, text, isError) {
    const el = statusEl(n);
    if (!el) return;
    el.textContent = text || '';
    el.classList.toggle('verse-audio-status--error', !!isError);
}

/** Re-apply the playing state after the verse cards were re-rendered (language change). */
export function syncAudioButtons() {
    document.querySelectorAll('.verse-play').forEach(function(b) { paintButton(b, Number(b.dataset.verse) === playingVerse); });
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
    if (a) { a.pause(); a.removeAttribute('src'); a.load(); }
    playingVerse = null;
    syncAudioButtons();
}

async function playVerse(n) {
    if (playingVerse === n) { stopAudio(); return; }
    stopAudio();
    document.querySelectorAll('.verse-audio-status').forEach(function(el) { el.textContent = ''; });
    playingVerse = n;
    syncAudioButtons();
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
    try { await a.play(); } catch (error) {
        playingVerse = null; syncAudioButtons();
        setStatus(n, t('audio.playFailed').replace('{n}', n), true);
        console.warn('Audio play failed:', error.message);
    }
}

/** Wire the shared <audio>, the per-verse buttons (delegated, so re-renders keep working) and the set switcher. */
export function initAudioControls() {
    if (!ready) return;
    fillSetSelect();
    const a = audioEl();
    if (a) {
        a.addEventListener('ended', function() { playingVerse = null; syncAudioButtons(); });
        a.addEventListener('error', function() {
            if (playingVerse == null || !a.getAttribute('src')) return;
            const n = playingVerse; playingVerse = null; syncAudioButtons();
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
        stopAudio();
        document.querySelectorAll('.verse-audio-status').forEach(function(el) { el.textContent = ''; });
        try { await useSet(set); saveSetId(set.id); } catch (error) {
            console.warn('Could not load set ' + set.id + ':', error.message);
            select.value = current.id;                                // stay on the working set
        }
    });
}

/** Re-label the switcher after a language change (the "recommended" word is localized). */
export function refreshAudioControls() { if (ready) fillSetSelect(); }
