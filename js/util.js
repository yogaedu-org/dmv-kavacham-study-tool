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

/**
 * Next active index for a keyboard walk through a listbox (#32).
 * `-1` means "nothing active yet": ArrowDown enters at the first item, ArrowUp at
 * the last. Both directions wrap, and a stale index (the list shrank under us) is
 * pulled back into range rather than escaping it. Any other key leaves the cursor
 * where it is. Kept pure and import-free so tests/autocomplete-keyboard.mjs can
 * exercise it without a DOM.
 * @param {number} current - Current active index, or -1 for none
 * @param {number} count - Number of items in the list
 * @param {string} key - KeyboardEvent.key
 * @returns {number} - New active index, or -1 when the list is empty
 */
export function nextActiveIndex(current, count, key) {
    if (count <= 0) return -1;
    if (key === 'ArrowDown') return current >= count - 1 ? 0 : current + 1;
    if (key === 'ArrowUp') return current <= 0 || current > count - 1 ? count - 1 : current - 1;
    return current;
}

/* ---- Const lookup maps ---- */

export const LOCALE_NAMES = { en: 'English', ne: 'नेपाली', es: 'Español' };

export const DIR_ANGLES = { North: -90, Northeast: -45, East: 0, Southeast: 45, South: 90, Southwest: 135, West: 180, Northwest: -135 };

export const BODY_ZONES = [['crown', 10], ['head', 17], ['throat', 24], ['chest', 31], ['core', 39], ['legs', 47], ['feet', 53]];
