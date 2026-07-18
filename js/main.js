/**
 * DAŚAMAHĀVIDYĀ KAVACAM - INTERACTIVE STUDY TOOL
 * Enterprise-Standard JavaScript Application with Full Filtering
 * 
 * This file contains the complete functionality for the Sanskrit study tool
 * including dropdown filters, visual tags, autocomplete, and advanced highlighting.
 * Restored all original features while maintaining clean, enterprise architecture.
 * 
 * @version 2.1.0
 * @author YogaEdu.org
 * @license MIT
 */

'use strict';

import { DOMElements, AppState, VERSE_DATA, CONFIG, loadVerseData } from './state.js';
import { getElementById, debounce, escapeHtml } from './util.js';
import { loadConfig, applyConfig, initThemeToggle } from './config.js';
import { loadI18n, resolveLocale, applyI18n, initLanguageSwitcher, populateAllDropdowns } from './i18n.js';
import { initFontScale, toggleCompactMode, togglePinMode, updateCompactMode, updatePinButton, handleScroll, toggleSanskrit, toggleTransliteration, updateDisplayClasses } from './controls.js';
import { toggleDropdown, closeAllDropdowns, addFilterTag, removeFilterTag, handleSearch, hideAutocomplete, applyFiltersAndHighlights, clearAllFilters } from './filters.js';
import { renderVerses } from './render.js';

/* ==========================================================================
   EVENT HANDLERS
   Set up event listeners for user interactions
   ========================================================================== */

/**
 * Initialize event listeners
 */
function initializeEventListeners() {
    // Text toggle controls
    if (DOMElements.sanskritToggle) {
        DOMElements.sanskritToggle.addEventListener('change', toggleSanskrit);
    }
    
    if (DOMElements.transliterationToggle) {
        DOMElements.transliterationToggle.addEventListener('change', toggleTransliteration);
    }
    
    // Search functionality
    if (DOMElements.searchInput) {
        DOMElements.searchInput.addEventListener('input', handleSearch);
        
        DOMElements.searchInput.addEventListener('keydown', function(e) {
            if (e.key === 'Escape') {
                DOMElements.searchInput.value = '';
                AppState.searchTerm = '';
                hideAutocomplete();
                applyFiltersAndHighlights();
            }
        });
    }
    
    // Clear filters button
    if (DOMElements.clearFiltersBtn) {
        DOMElements.clearFiltersBtn.addEventListener('click', clearAllFilters);
    }
    
    // Dropdown button listeners
    if (DOMElements.deitiesDropdownBtn) {
        DOMElements.deitiesDropdownBtn.addEventListener('click', function(e) {
            e.stopPropagation();
            toggleDropdown('deities');
        });
    }
    
    if (DOMElements.directionsDropdownBtn) {
        DOMElements.directionsDropdownBtn.addEventListener('click', function(e) {
            e.stopPropagation();
            toggleDropdown('directions');
        });
    }
    
    if (DOMElements.bodyDropdownBtn) {
        DOMElements.bodyDropdownBtn.addEventListener('click', function(e) {
            e.stopPropagation();
            toggleDropdown('body');
        });
    }
    
    // Close dropdowns when clicking outside
    document.addEventListener('click', function(e) {
        closeAllDropdowns();
    });
    
    // Keyboard navigation
    document.addEventListener('keydown', function(e) {
        if (e.key === 'Escape') {
            closeAllDropdowns();
        }
    });
    
    // Compact mode controls
    if (DOMElements.compactToggle) {
        DOMElements.compactToggle.addEventListener('click', function(e) {
            e.stopPropagation();
            toggleCompactMode();
        });
    }
    
    if (DOMElements.pinToggle) {
        DOMElements.pinToggle.addEventListener('click', function(e) {
            e.stopPropagation();
            togglePinMode();
        });
    }
    
    // Scroll detection for auto-compact
    window.addEventListener('scroll', handleScroll);
}

/* ==========================================================================
   INITIALIZATION
   Application startup and DOM ready handling
   ========================================================================== */

/**
 * Cache DOM element references
 */
function cacheDOMElements() {
    // Text toggles
    DOMElements.sanskritToggle = getElementById('sanskritToggle');
    DOMElements.transliterationToggle = getElementById('transliterationToggle');
    
    // Search elements
    DOMElements.searchInput = getElementById('searchInput');
    DOMElements.autocompleteDropdown = getElementById('autocompleteDropdown');
    
    // Filter controls
    DOMElements.clearFiltersBtn = getElementById('clearFilters');
    DOMElements.activeFilters = getElementById('activeFilters');
    
    // Dropdown elements
    DOMElements.deitiesDropdownBtn = getElementById('deitiesDropdownBtn');
    DOMElements.deitiesDropdownContent = getElementById('deitiesDropdownContent');
    DOMElements.deitiesSelectedText = getElementById('deitiesSelectedText');
    
    DOMElements.directionsDropdownBtn = getElementById('directionsDropdownBtn');
    DOMElements.directionsDropdownContent = getElementById('directionsDropdownContent');
    DOMElements.directionsSelectedText = getElementById('directionsSelectedText');
    
    DOMElements.bodyDropdownBtn = getElementById('bodyDropdownBtn');
    DOMElements.bodyDropdownContent = getElementById('bodyDropdownContent');
    DOMElements.bodySelectedText = getElementById('bodySelectedText');
    
    // Content areas
    DOMElements.versesContainer = getElementById('versesContainer');
    DOMElements.loadingIndicator = getElementById('loadingIndicator');
    
    // Compact mode controls
    DOMElements.compactToggle = getElementById('compactToggle');
    DOMElements.pinToggle = getElementById('pinToggle');
    DOMElements.controlsContainer = document.querySelector('.controls');
}

/**
 * Initialize the application
 */
async function initializeApp() {
    console.log('Initializing Daśamahāvidyā Kavacam Study Tool…');

    try {
        // Load configuration (metadata, feature flags, category registry)
        await loadConfig();

        // Load the active locale + its fallback (#25)
        await loadI18n(resolveLocale());

        // Load verse data (single source of truth)
        await loadVerseData();

        // Initialize application state with loaded data
        AppState.init();

        // Cache DOM references
        cacheDOMElements();

        // Apply configuration now that config, state, and DOM are ready
        applyConfig();

        // Apply UI strings + wire the language switcher (#25)
        applyI18n();
        initLanguageSwitcher();
        console.log('Version ' + CONFIG.app.version);

        // Populate dropdowns from the category registry (#8), locale-aware labels
        populateAllDropdowns();
        
        // Set up event listeners
        initializeEventListeners();

        // Wire the theme toggle (#17)
        initThemeToggle();

        // Wire the reader font-size stepper (#23)
        initFontScale();

        // Set initial display state
        updateDisplayClasses();
        
        // Render verses
        renderVerses();
        
        console.log('Application initialized successfully');
    } catch (error) {
        console.error('Failed to initialize application:', error);
        // Show error message to user
        const container = document.getElementById('versesContainer');
        if (container) {
            container.innerHTML = `
                <div style="text-align: center; color: #ff6b6b; padding: 2rem;">
                    <h3>Error Loading Application</h3>
                    <p>Failed to load verse data. Please refresh the page or check your connection.</p>
                    <p style="font-size: 0.9rem; opacity: 0.8;">Error: ${error.message}</p>
                </div>
            `;
        }
    }
}

/* ==========================================================================
   APPLICATION STARTUP
   Wait for DOM to be ready, then initialize
   ========================================================================== */

/**
 * Start the application when DOM is ready
 */
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initializeApp);
} else {
    initializeApp();
}

/* ==========================================================================
   GLOBAL EXPORTS
   Make functions available globally for debugging and external access
   ========================================================================== */

// Export functions for debugging and external access
window.DMVKavacham = {
    // Data
    VERSE_DATA: VERSE_DATA,
    AppState: AppState,
    
    // Core functions
    toggleDropdown: toggleDropdown,
    clearAllFilters: clearAllFilters,
    addFilterTag: addFilterTag,
    removeFilterTag: removeFilterTag,
    applyFiltersAndHighlights: applyFiltersAndHighlights,
    
    // Compact mode functions
    toggleCompactMode: toggleCompactMode,
    togglePinMode: togglePinMode,
    updateCompactMode: updateCompactMode,
    updatePinButton: updatePinButton,
    
    // Utility functions
    debounce: debounce,
    escapeHtml: escapeHtml,
    
    // Version info (authoritative source: config.json → CONFIG.app.version)
    version: CONFIG.app.version
};

console.log('DMV Kavacham Study Tool loaded. Access via window.DMVKavacham');

/* ==========================================================================
   SERVICE WORKER (#15)
   Registers the offline app-shell cache. No-ops on file:// (needs HTTP/HTTPS).
   ========================================================================== */
if ('serviceWorker' in navigator) {
    window.addEventListener('load', function() {
        navigator.serviceWorker.register('sw.js').then(function(reg) {
            console.log('Service worker registered:', reg.scope);
        }).catch(function(err) {
            console.warn('Service worker registration failed:', err.message);
        });
    });
}
