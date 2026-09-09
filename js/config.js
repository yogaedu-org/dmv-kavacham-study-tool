'use strict';

import { CONFIG, setConfig, DEFAULT_CONFIG, AppState, DOMElements, I18N } from './state.js';
import { buildFeedbackUrl } from './util.js';

/**
 * Load config.json, shallow-merging over the built-in defaults so a missing
 * or partial file never breaks the app.
 * @returns {Promise<void>}
 */
export async function loadConfig() {
    try {
        const response = await fetch('config.json');
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const c = await response.json();
        setConfig({
            app:      Object.assign({}, DEFAULT_CONFIG.app, c.app),
            features: Object.assign({}, DEFAULT_CONFIG.features, c.features),
            display:  Object.assign({}, DEFAULT_CONFIG.display, c.display),
            categories: Array.isArray(c.categories) && c.categories.length ? c.categories : DEFAULT_CONFIG.categories
        });
        console.log('Loaded config.json');
    } catch (error) {
        console.warn('config.json not loaded; using built-in defaults:', error.message);
        setConfig(DEFAULT_CONFIG);
    }
}

/**
 * Apply configuration to the DOM and initial state. Call AFTER cacheDOMElements().
 */
export function applyConfig() {
    // Metadata → document title + header
    document.title = CONFIG.app.title + ' - Interactive Study Tool';
    const titleEl = document.querySelector('.title');
    if (titleEl) titleEl.textContent = CONFIG.app.title;
    const subtitleEl = document.querySelector('.subtitle');
    if (subtitleEl && CONFIG.app.subtitle) subtitleEl.textContent = CONFIG.app.subtitle;

    // Feature defaults → display toggles
    AppState.showSanskrit = CONFIG.features.showSanskritDefault !== false;
    AppState.showTransliteration = CONFIG.features.showTransliterationDefault !== false;
    if (DOMElements.sanskritToggle) DOMElements.sanskritToggle.checked = AppState.showSanskrit;
    if (DOMElements.transliterationToggle) DOMElements.transliterationToggle.checked = AppState.showTransliteration;

    // Category colors (#8/#17) — from the registry, for the active theme
    applyCategoryColors();

    // Feedback link (#25) — shown only when a form/URL is configured
    var feedbackLink = document.getElementById('feedbackLink');
    if (feedbackLink) {
        if (CONFIG.app.feedbackUrl) {
            feedbackLink.href = CONFIG.app.feedbackUrl;
            feedbackLink.hidden = false;
            initFeedbackPrefill(feedbackLink);
        } else {
            feedbackLink.hidden = true;
        }
    }

    // Version (#9) — keep the debug export in sync with the authoritative value
    if (window.DMVKavacham) window.DMVKavacham.version = CONFIG.app.version;
}

/* ==========================================================================
   CORRECTION-FORM PREFILL (#41)
   The form asks which language and which verse — both of which the page already
   knows. Resolved at CLICK time, not at load: the reader picks a language and
   scrolls to a verse long after applyConfig() has run, so a href built once at
   startup would carry stale state.
   ========================================================================== */

/**
 * The verse card nearest the top of the viewport, by number.
 * Cards hidden by a filter have a zero-size rect and are skipped, as are cards
 * scrolled fully out of view — so "nothing on screen" honestly returns null.
 * @returns {number|null} verse number, or null when none is in view
 */
function verseNumberInView() {
    const cards = document.querySelectorAll('.verse[id^="verse-"]');
    const viewportHeight = window.innerHeight || 0;
    let best = null, bestDistance = Infinity;
    cards.forEach(function(card) {
        const rect = card.getBoundingClientRect();
        if (rect.height === 0 || rect.bottom <= 0 || rect.top >= viewportHeight) return;
        const distance = Math.abs(rect.top);
        if (distance < bestDistance) { bestDistance = distance; best = card; }
    });
    if (!best) return null;
    const number = parseInt(best.id.slice('verse-'.length), 10);
    return Number.isInteger(number) ? number : null;
}

/**
 * Rebuild the feedback href from live state whenever the link is about to be
 * used. `pointerdown` also covers middle-click and right-click "copy link".
 * Any failure leaves the bare template URL already on the element — the link
 * must never break, and a wrong prefill is worse than none.
 * @param {HTMLAnchorElement} link
 */
function initFeedbackPrefill(link) {
    function refresh() {
        try {
            link.href = buildFeedbackUrl(CONFIG.app.feedbackUrl, I18N.locale, verseNumberInView()) ||
                        CONFIG.app.feedbackUrl;
        } catch (error) {
            console.warn('Correction-form prefill skipped:', error.message);
            link.href = CONFIG.app.feedbackUrl;
        }
    }
    link.addEventListener('pointerdown', refresh);
    link.addEventListener('click', refresh);
}

/**
 * Resolve the active theme: an explicit data-theme wins, else the OS preference (#17).
 * @returns {string} 'light' or 'dark'
 */
function currentTheme() {
    const explicit = document.documentElement.getAttribute('data-theme');
    if (explicit) return explicit;
    return window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
}

/**
 * Set category CSS colors from the registry for the active theme (#8/#17).
 */
function applyCategoryColors() {
    const light = currentTheme() === 'light';
    CONFIG.categories.forEach(function(cat) {
        if (!cat.cssVar) return;
        const col = (light && cat.colorLight) ? cat.colorLight : cat.color;
        if (col) document.documentElement.style.setProperty('--color-' + cat.cssVar, col);
    });
}

/**
 * Wire the sun/moon theme toggle: icon shows the target, tooltip matches (#17).
 */
export function initThemeToggle() {
    const btn = document.getElementById('themeToggle');
    if (!btn) return;
    const icon = btn.querySelector('.theme-icon');
    const SUN = '<circle cx="12" cy="12" r="4.6" fill="currentColor"/>' +
        Array.from({ length: 8 }, function(_, i) {
            const a = i * Math.PI / 4, c = Math.cos(a), s = Math.sin(a);
            return '<line x1="' + (12 + c * 7).toFixed(1) + '" y1="' + (12 + s * 7).toFixed(1) +
                   '" x2="' + (12 + c * 9.6).toFixed(1) + '" y2="' + (12 + s * 9.6).toFixed(1) +
                   '" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/>';
        }).join('');
    const MOON = '<path d="M20 14.7A8 8 0 0 1 9.3 4 8 8 0 1 0 20 14.7z" fill="currentColor"/>';
    function set(theme) {
        document.documentElement.setAttribute('data-theme', theme);
        const toLight = (theme === 'dark');
        if (icon) icon.innerHTML = toLight ? SUN : MOON;
        btn.title = toLight ? 'Light' : 'Dark';
        btn.setAttribute('aria-label', 'Switch to ' + (toLight ? 'light' : 'dark') + ' theme');
        applyCategoryColors();
    }
    set(currentTheme());
    btn.addEventListener('click', function() {
        set(document.documentElement.getAttribute('data-theme') === 'dark' ? 'light' : 'dark');
    });
}
