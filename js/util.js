'use strict';

/* ==========================================================================
   UTILITY FUNCTIONS
   Helper functions for common operations
   ========================================================================== */

/**
 * Safely get element by ID with error handling
 * @param {string} id - Element ID
 * @returns {HTMLElement|null} - Element or null if not found
 */
export function getElementById(id) {
    const element = document.getElementById(id);
    if (!element) {
        console.warn(`Element with ID '${id}' not found`);
    }
    return element;
}

/**
 * Debounce function to limit rapid function calls
 * @param {Function} func - Function to debounce
 * @param {number} wait - Wait time in milliseconds
 * @returns {Function} - Debounced function
 */
export function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

/**
 * Escape HTML to prevent XSS attacks
 * @param {string} text - Text to escape
 * @returns {string} - Escaped text
 */
export function escapeHtml(text) {
    const map = {
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#039;'
    };
    return text.replace(/[&<>"']/g, function(m) { return map[m]; });
}

/* ==========================================================================
   CORRECTION-FORM PREFILL (#41)
   A GitHub issue *form* prefills a field from a query parameter named after
   that field's `id` in .github/ISSUE_TEMPLATE/translation-correction.yml. A
   dropdown only takes the value when it matches one of its `options` EXACTLY —
   an unmatched value is dropped silently, with no error anywhere. So these
   strings are a contract with the .yml, guarded by tests/feedback-prefill.mjs.
   Kept pure and import-free so that test can exercise it without a DOM.
   ========================================================================== */

/** Locale code -> the exact `language` dropdown option string. */
export const FEEDBACK_LANGUAGE_OPTIONS = {
    en: 'English',
    ne: 'Nepali (नेपाली)',
    es: 'Spanish (Español)'
};

/** The `verse` dropdown option used when no verse is resolvable. */
export const FEEDBACK_VERSE_FALLBACK = 'General / other';

/**
 * Build the correction-form URL from live UI state (#41).
 * A wrong prefill is worse than none: an unmappable locale returns the bare
 * template URL rather than guessing, and an unresolved verse falls back to the
 * template's own "General / other" option.
 * @param {string} baseUrl - CONFIG.app.feedbackUrl (the bare template link)
 * @param {string} locale - active I18N locale code
 * @param {number|null} verseNumber - verse in view, or null/undefined for none
 * @returns {string} - prefilled URL, or baseUrl when state cannot be resolved
 */
export function buildFeedbackUrl(baseUrl, locale, verseNumber) {
    if (!baseUrl) return '';
    const language = FEEDBACK_LANGUAGE_OPTIONS[locale];
    if (!language) return baseUrl;
    let url;
    try {
        url = new URL(baseUrl);
    } catch (e) {
        return baseUrl;
    }
    const n = Number(verseNumber);
    const verse = Number.isInteger(n) && n > 0 ? 'Verse ' + n : FEEDBACK_VERSE_FALLBACK;
    url.searchParams.set('language', language);
    url.searchParams.set('verse', verse);
    url.searchParams.set('title', '[i18n] Correction: ' + language + ' — ' + verse);
    return url.toString();
}

/* ---- Const lookup maps ---- */

export const LOCALE_NAMES = { en: 'English', ne: 'नेपाली', es: 'Español' };

export const DIR_ANGLES = { North: -90, Northeast: -45, East: 0, Southeast: 45, South: 90, Southwest: 135, West: 180, Northwest: -135 };

export const BODY_ZONES = [['crown', 10], ['head', 17], ['throat', 24], ['chest', 31], ['core', 39], ['legs', 47], ['feet', 53]];
