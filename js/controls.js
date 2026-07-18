'use strict';

import { AppState, DOMElements } from './state.js';
import { debounce } from './util.js';
import { t } from './i18n.js';

/**
 * Reader font-size stepper (#23) — multiplies the fluid type scale; persisted.
 */
export function initFontScale() {
    const KEY = 'dmv-font-scale';
    const MIN = 0.8, MAX = 2.5, STEP = 0.15;  // generous ceiling; the reader is the point (#23)
    let scale = parseFloat(localStorage.getItem(KEY));
    if (!scale || isNaN(scale)) scale = 1;
    const apply = function() {
        scale = Math.min(MAX, Math.max(MIN, scale));
        document.documentElement.style.setProperty('--user-scale', scale.toFixed(2));
        try { localStorage.setItem(KEY, scale); } catch (e) { /* private mode */ }
    };
    apply();
    const smaller = document.getElementById('fontSmaller');
    const larger = document.getElementById('fontLarger');
    if (smaller) smaller.addEventListener('click', function() { scale -= STEP; apply(); });
    if (larger) larger.addEventListener('click', function() { scale += STEP; apply(); });
}

/* ==========================================================================
   COMPACT MODE FUNCTIONALITY
   Sticky controls with auto-collapse on scroll
   ========================================================================== */

/**
 * Toggle compact mode manually
 */
export function toggleCompactMode() {
    AppState.isCompact = !AppState.isCompact;
    updateCompactMode();
    console.log(`Compact mode: ${AppState.isCompact ? 'ON' : 'OFF'}`);
}

/**
 * Toggle pin state for manual control
 */
export function togglePinMode() {
    AppState.isPinned = !AppState.isPinned;
    // Pinning means "keep the bar handy but out of my way" (#23), so it implies the
    // slim bar. Previously pinning froze the controls EXPANDED, which ate the screen.
    if (AppState.isPinned && !AppState.isCompact) {
        AppState.isCompact = true;
        updateCompactMode();
    } else if (!AppState.isPinned && AppState.isCompact &&
               (window.scrollY || window.pageYOffset) === 0) {
        // Unpinning at the top restores the full controls right away — otherwise
        // nothing fires until the next scroll and it looks stuck.
        AppState.isCompact = false;
        updateCompactMode();
    }
    updatePinButton();
    console.log(`Pin mode: ${AppState.isPinned ? 'PINNED (slim)' : 'UNPINNED'}`);
}

/**
 * Update the visual state of compact mode
 */
export function updateCompactMode() {
    if (!DOMElements.controlsContainer) return;
    
    if (AppState.isCompact) {
        DOMElements.controlsContainer.classList.add('compact');
    } else {
        DOMElements.controlsContainer.classList.remove('compact');
    }
}

/**
 * Update the visual state of the pin button
 */
export function updatePinButton() {
    if (!DOMElements.pinToggle) return;
    
    // Localized (#25) and reworded for the new pin meaning (#23).
    if (AppState.isPinned) {
        DOMElements.pinToggle.classList.add('pinned');
        DOMElements.pinToggle.title = t('controls.pin.on');
    } else {
        DOMElements.pinToggle.classList.remove('pinned');
        DOMElements.pinToggle.title = t('controls.pin.off');
    }
}

/**
 * Handle scroll events with debouncing for compact mode
 */
export const handleScroll = debounce(function() {
    // Pinned = stay slim (#23). Pinning keeps the bar reachable without covering the
    // verses; the gear is the deliberate way to expand it.
    if (AppState.isPinned) {
        if (!AppState.isCompact) {
            AppState.isCompact = true;
            updateCompactMode();
        }
        return;
    }

    const scrollPosition = window.scrollY || window.pageYOffset;
    
    if (scrollPosition === 0) {
        // At the top - expand
        if (AppState.isCompact) {
            AppState.isCompact = false;
            updateCompactMode();
        }
    } else {
        // Scrolled down - collapse
        if (!AppState.isCompact) {
            AppState.isCompact = true;
            updateCompactMode();
        }
    }
}, 100);

/* ==========================================================================
   DISPLAY FUNCTIONS
   Functions to handle text visibility toggles
   ========================================================================== */

/**
 * Toggle Sanskrit text visibility
 */
export function toggleSanskrit() {
    AppState.showSanskrit = DOMElements.sanskritToggle.checked;
    updateDisplayClasses();
}

/**
 * Toggle transliteration text visibility
 */
export function toggleTransliteration() {
    AppState.showTransliteration = DOMElements.transliterationToggle.checked;
    updateDisplayClasses();
}

/**
 * Update CSS classes on body element to control text visibility
 */
export function updateDisplayClasses() {
    const body = document.body;
    
    // Sanskrit display control
    if (AppState.showSanskrit) {
        body.classList.add('show-sanskrit');
    } else {
        body.classList.remove('show-sanskrit');
    }
    
    // Transliteration display control
    if (AppState.showTransliteration) {
        body.classList.add('show-transliteration');
    } else {
        body.classList.remove('show-transliteration');
    }
}
