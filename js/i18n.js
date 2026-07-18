'use strict';

import { CONFIG, I18N, AppState, DOMElements } from './state.js';
import { LOCALE_NAMES } from './util.js';
import { updatePinButton } from './controls.js';
import { populateDropdown, updateFilterTags, applyFiltersAndHighlights } from './filters.js';
import { renderVerses } from './render.js';

/* ==========================================================================
   INTERNATIONALIZATION (#25)
   i18n/<locale>.json carries UI strings ("ui") and category term maps ("terms").
   Anything missing falls back to the default locale, then to the raw value —
   so a partial/draft locale can never blank the interface.
   Sanskrit + transliteration are never localized (they are the source text).
   ========================================================================== */

/** Startup locale: saved choice > browser language > config default. */
export function resolveLocale() {
    const locales = CONFIG.app.locales || ['en'];
    let saved = null;
    try { saved = localStorage.getItem('dmv-locale'); } catch (e) {}
    if (saved && locales.indexOf(saved) !== -1) return saved;
    const nav = (navigator.language || '').slice(0, 2).toLowerCase();
    if (locales.indexOf(nav) !== -1) return nav;
    return CONFIG.app.defaultLocale || 'en';
}

async function fetchLocale(locale) {
    try {
        const response = await fetch('i18n/' + locale + '.json');
        if (!response.ok) throw new Error('HTTP ' + response.status);
        return await response.json();
    } catch (error) {
        console.warn('Locale "' + locale + '" not loaded:', error.message);
        return null;
    }
}

/** Load the default locale (as fallback) plus the active locale. */
export async function loadI18n(locale) {
    const def = CONFIG.app.defaultLocale || 'en';
    const base = await fetchLocale(def);
    if (base) I18N.fallback = { ui: base.ui || {}, terms: base.terms || {} };
    let active = base;
    if (locale !== def) active = (await fetchLocale(locale)) || base;
    I18N.locale = locale;
    I18N.strings = (active && active.ui) || {};
    I18N.terms = (active && active.terms) || {};
    console.log('i18n locale:', locale);
}

/** UI string by key, falling back to default locale then the key itself. */
export function t(key) {
    return I18N.strings[key] || I18N.fallback.ui[key] || key;
}

/** Look up a category registry entry by its DOM key ('deities'|'directions'|'body'). */
export function categoryByDomKey(domKey) {
    return CONFIG.categories.filter(function(c) { return c.domKey === domKey; })[0] || null;
}

/** Localized category term, falling back to the canonical value. */
export function term(field, value) {
    const active = I18N.terms[field];
    if (active && active[value]) return active[value];
    const base = I18N.fallback.terms[field];
    if (base && base[value]) return base[value];
    return value;
}

/** A verse's translation for the active locale, falling back to the default. */
export function verseTranslation(verse) {
    const tr = verse.translations || {};
    return tr[I18N.locale] || tr[CONFIG.app.defaultLocale || 'en'] || '';
}

/** Apply UI strings to elements marked data-i18n / data-i18n-attr. */
export function applyI18n() {
    document.documentElement.setAttribute('lang', I18N.locale);
    document.querySelectorAll('[data-i18n]').forEach(function(el) {
        el.textContent = t(el.getAttribute('data-i18n'));
    });
    // data-i18n-attr="placeholder:search.placeholder;title:search.title"
    document.querySelectorAll('[data-i18n-attr]').forEach(function(el) {
        el.getAttribute('data-i18n-attr').split(';').forEach(function(pair) {
            const bits = pair.split(':');
            if (bits.length === 2) el.setAttribute(bits[0].trim(), t(bits[1].trim()));
        });
    });
    // The pin tooltip is state-dependent, so it's set in JS rather than markup.
    if (DOMElements && DOMElements.pinToggle) updatePinButton();
}

/** Re-populate every category dropdown from the registry (locale-aware labels). */
export function populateAllDropdowns() {
    CONFIG.categories.forEach(function(cat) {
        populateDropdown(cat.domKey, AppState[cat.allKey]);
    });
}

/** Wire the language switcher: swap locale, re-render, persist. */
export function initLanguageSwitcher() {
    const select = document.getElementById('localeSelect');
    if (!select) return;
    select.innerHTML = '';
    (CONFIG.app.locales || ['en']).forEach(function(loc) {
        const opt = document.createElement('option');
        opt.value = loc;
        opt.textContent = LOCALE_NAMES[loc] || loc;
        if (loc === I18N.locale) opt.selected = true;
        select.appendChild(opt);
    });
    select.addEventListener('change', async function() {
        const loc = select.value;
        try { localStorage.setItem('dmv-locale', loc); } catch (e) {}
        await loadI18n(loc);
        applyI18n();
        populateAllDropdowns();
        updateFilterTags();
        renderVerses();
        applyFiltersAndHighlights();
    });
}
