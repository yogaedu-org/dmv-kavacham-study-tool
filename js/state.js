'use strict';

/* Shared module state: mutated-in-place objects + reassigned live bindings. */

/* ==========================================================================
   VERSE DATA
   Core content for the 14 verses of the Daśamahāvidyā Kavacam
   ========================================================================== */

/**
 * Verse data — the single source of truth is data/verses.json.
 * Populated by loadVerseData(); the app must be served over HTTP(S).
 */
export let VERSE_DATA = [];

/** Setter for the live VERSE_DATA binding (importers cannot reassign it). */
export function setVerseData(v) { VERSE_DATA = v; }

/**
 * Load verse data from data/verses.json (single source of truth).
 * Throws on failure; initializeApp() renders the error state.
 * @returns {Promise<void>}
 */
export async function loadVerseData() {
    const response = await fetch('data/verses.json');
    if (!response.ok) {
        throw new Error(`Could not load data/verses.json (HTTP ${response.status}). The app must be served over HTTP(S); opening index.html directly via file:// will not work.`);
    }
    const data = await response.json();
    VERSE_DATA = data.verses;
    console.log(`Loaded ${VERSE_DATA.length} verses from data/verses.json`);
}

/* ==========================================================================
   CONFIGURATION (#12)
   Single source for app metadata, feature flags, breakpoints, and the
   category registry (consumed by the category refactor, #8).
   ========================================================================== */

export const DEFAULT_CONFIG = {
    app: {
        title: 'श्रीदशमहाविद्याकवचम्',
        subtitle: 'The Armor of the Ten Great Wisdom Goddesses',
        author: 'YogaEdu.org',
        version: '2.1.0',
        locales: ['en', 'ne', 'es'],
        defaultLocale: 'en',
        feedbackUrl: 'https://github.com/yogaedu-org/dmv-kavacham-study-tool/issues/new?template=translation-correction.yml',
        links: { org: 'https://github.com/yogaedu-org' }
    },
    features: {
        showSanskritDefault: true,
        showTransliterationDefault: true,
        enableSearch: true,
        enableFilters: true,
        enableCompactMode: true
    },
    display: { breakpoints: { tablet: 768, mobile: 480 } },
    categories: [
        { key: 'deities',    dataField: 'deities',    stateKey: 'selectedDeities',    allKey: 'allDeities',    domKey: 'deities',    cssVar: 'deity',     label: 'Deities',    color: '#d9615a', colorLight: '#b23a34' },
        { key: 'directions', dataField: 'directions', stateKey: 'selectedDirections', allKey: 'allDirections', domKey: 'directions', cssVar: 'direction', label: 'Directions', color: '#7d9bd0', colorLight: '#4a5f8a' },
        { key: 'bodyParts',  dataField: 'bodyParts',  stateKey: 'selectedBodyParts',  allKey: 'allBodyParts',  domKey: 'body',       cssVar: 'body',      label: 'Body',       color: '#c9a886', colorLight: '#8a6d4f' }
    ]
};

export let CONFIG = DEFAULT_CONFIG;

/** Setter for the live CONFIG binding (importers cannot reassign it). */
export function setConfig(v) { CONFIG = v; }

/* ==========================================================================
   APPLICATION STATE
   Enhanced state management for filters, search, and display options
   ========================================================================== */

/**
 * Application state object
 * Tracks all user preferences, active filters, and search state
 */
export const AppState = {
    // Display preferences
    showSanskrit: true,
    showTransliteration: true,
    
    // Search state
    searchTerm: '',
    
    // Filter selections
    selectedDeities: [],
    selectedDirections: [],
    selectedBodyParts: [],
    
    // Compact mode state
    isCompact: false,
    isPinned: false,
    scrollTimeout: null,
    
    // Cached data
    allDeities: [],
    allDirections: [],
    allBodyParts: [],
    searchableItems: [],
    
    /**
     * Initialize the application state with unique values from verse data
     */
    init: function() {
        // Extract unique values from all verses
        this.allDeities = this.extractUniqueValues('deities');
        this.allDirections = this.extractUniqueValues('directions');
        this.allBodyParts = this.extractUniqueValues('bodyParts');
        
        // Build searchable items index for autocomplete
        this.buildSearchableItems();
        
        console.log('AppState initialized:', {
            deities: this.allDeities.length,
            directions: this.allDirections.length,
            bodyParts: this.allBodyParts.length,
            searchableItems: this.searchableItems.length
        });
    },
    
    /**
     * Extract unique values from a specific property across all verses
     * @param {string} property - Property name to extract from
     * @returns {Array} - Sorted array of unique values
     */
    extractUniqueValues: function(property) {
        const allValues = VERSE_DATA.reduce(function(acc, verse) {
            return acc.concat(verse[property]);
        }, []);
        
        // Remove duplicates and sort alphabetically
        return Array.from(new Set(allValues)).sort();
    },
    
    /**
     * Build searchable items index for autocomplete functionality
     */
    buildSearchableItems: function() {
        this.searchableItems = [];
        
        // Add deities
        this.allDeities.forEach(function(deity) {
            this.searchableItems.push({
                text: deity,
                type: 'deities',
                category: 'Deity'
            });
        }.bind(this));
        
        // Add directions
        this.allDirections.forEach(function(direction) {
            this.searchableItems.push({
                text: direction,
                type: 'directions',
                category: 'Direction'
            });
        }.bind(this));
        
        // Add body parts
        this.allBodyParts.forEach(function(bodyPart) {
            this.searchableItems.push({
                text: bodyPart,
                type: 'body',
                category: 'Body'
            });
        }.bind(this));
    },
    
    /**
     * Clear all active filters and search
     */
    clearAllFilters: function() {
        this.selectedDeities = [];
        this.selectedDirections = [];
        this.selectedBodyParts = [];
        this.searchTerm = '';
    }
};

/* ==========================================================================
   DOM ELEMENTS
   Cached references to frequently accessed DOM elements
   ========================================================================== */

/**
 * DOM element references
 * Cached for performance and cleaner code
 */
export const DOMElements = {
    // Text toggles
    sanskritToggle: null,
    transliterationToggle: null,
    
    // Search elements
    searchInput: null,
    autocompleteDropdown: null,
    
    // Filter controls
    clearFiltersBtn: null,
    activeFilters: null,
    
    // Dropdown elements
    deitiesDropdownBtn: null,
    deitiesDropdownContent: null,
    deitiesSelectedText: null,
    
    directionsDropdownBtn: null,
    directionsDropdownContent: null,
    directionsSelectedText: null,
    
    bodyDropdownBtn: null,
    bodyDropdownContent: null,
    bodySelectedText: null,
    
    // Content areas
    versesContainer: null,
    loadingIndicator: null,
    
    // Compact mode controls
    compactToggle: null,
    pinToggle: null,
    controlsContainer: null
};

/* ---- Internationalization state (#25) ---- */

export const I18N = {
    locale: 'en',
    strings: {},
    terms: {},
    fallback: { ui: {}, terms: {} }
};
