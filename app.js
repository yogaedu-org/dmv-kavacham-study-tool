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

/* ==========================================================================
   VERSE DATA
   Core content for the 14 verses of the Daśamahāvidyā Kavacam
   ========================================================================== */

/**
 * Verse data — the single source of truth is data/verses.json.
 * Populated by loadVerseData(); the app must be served over HTTP(S).
 */
let VERSE_DATA = [];

/**
 * Load verse data from data/verses.json (single source of truth).
 * Throws on failure; initializeApp() renders the error state.
 * @returns {Promise<void>}
 */
async function loadVerseData() {
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

const DEFAULT_CONFIG = {
    app: {
        title: 'श्रीदशमहाविद्याकवचम्',
        subtitle: 'The Armor of the Ten Great Wisdom Goddesses',
        author: 'YogaEdu.org',
        version: '2.1.0',
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
        { key: 'deities',    dataField: 'deities',    stateKey: 'selectedDeities',    allKey: 'allDeities',    domKey: 'deities',    cssVar: 'deity',     label: 'Deities',    color: '#ff6b6b' },
        { key: 'directions', dataField: 'directions', stateKey: 'selectedDirections', allKey: 'allDirections', domKey: 'directions', cssVar: 'direction', label: 'Directions', color: '#4ecdc4' },
        { key: 'bodyParts',  dataField: 'bodyParts',  stateKey: 'selectedBodyParts',  allKey: 'allBodyParts',  domKey: 'body',       cssVar: 'body',      label: 'Body',       color: '#fb8500' }
    ]
};

let CONFIG = DEFAULT_CONFIG;

/**
 * Load config.json, shallow-merging over the built-in defaults so a missing
 * or partial file never breaks the app.
 * @returns {Promise<void>}
 */
async function loadConfig() {
    try {
        const response = await fetch('config.json');
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const c = await response.json();
        CONFIG = {
            app:      Object.assign({}, DEFAULT_CONFIG.app, c.app),
            features: Object.assign({}, DEFAULT_CONFIG.features, c.features),
            display:  Object.assign({}, DEFAULT_CONFIG.display, c.display),
            categories: Array.isArray(c.categories) && c.categories.length ? c.categories : DEFAULT_CONFIG.categories
        };
        console.log('Loaded config.json');
    } catch (error) {
        console.warn('config.json not loaded; using built-in defaults:', error.message);
        CONFIG = DEFAULT_CONFIG;
    }
}

/**
 * Apply configuration to the DOM and initial state. Call AFTER cacheDOMElements().
 */
function applyConfig() {
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

    // Category colors (#8) — drive the CSS custom properties from the registry
    CONFIG.categories.forEach(function(cat) {
        if (cat.cssVar && cat.color) {
            document.documentElement.style.setProperty('--color-' + cat.cssVar, cat.color);
        }
    });

    // Version (#9) — keep the debug export in sync with the authoritative value
    if (window.DMVKavacham) window.DMVKavacham.version = CONFIG.app.version;
}

/* ==========================================================================
   APPLICATION STATE
   Enhanced state management for filters, search, and display options
   ========================================================================== */

/**
 * Application state object
 * Tracks all user preferences, active filters, and search state
 */
const AppState = {
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
const DOMElements = {
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

/* ==========================================================================
   UTILITY FUNCTIONS
   Helper functions for common operations
   ========================================================================== */

/**
 * Safely get element by ID with error handling
 * @param {string} id - Element ID
 * @returns {HTMLElement|null} - Element or null if not found
 */
function getElementById(id) {
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
function debounce(func, wait) {
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
function escapeHtml(text) {
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
   COMPACT MODE FUNCTIONALITY
   Sticky controls with auto-collapse on scroll
   ========================================================================== */

/**
 * Toggle compact mode manually
 */
function toggleCompactMode() {
    AppState.isCompact = !AppState.isCompact;
    updateCompactMode();
    console.log(`Compact mode: ${AppState.isCompact ? 'ON' : 'OFF'}`);
}

/**
 * Toggle pin state for manual control
 */
function togglePinMode() {
    AppState.isPinned = !AppState.isPinned;
    updatePinButton();
    console.log(`Pin mode: ${AppState.isPinned ? 'PINNED' : 'UNPINNED'}`);
}

/**
 * Update the visual state of compact mode
 */
function updateCompactMode() {
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
function updatePinButton() {
    if (!DOMElements.pinToggle) return;
    
    if (AppState.isPinned) {
        DOMElements.pinToggle.classList.add('pinned');
        DOMElements.pinToggle.title = 'Unpin controls (allow auto-collapse)';
    } else {
        DOMElements.pinToggle.classList.remove('pinned');
        DOMElements.pinToggle.title = 'Pin controls (prevent auto-collapse on scroll)';
    }
}

/**
 * Handle scroll events with debouncing for compact mode
 */
const handleScroll = debounce(function() {
    // Don't auto-change if pinned
    if (AppState.isPinned) return;
    
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
   DROPDOWN FUNCTIONALITY
   Custom dropdown creation and management
   ========================================================================== */

/**
 * Populate a dropdown with checkbox options
 * @param {string} type - Type of dropdown ('deities', 'directions', 'body')
 * @param {Array} options - Array of option values
 */
function populateDropdown(type, options) {
    const container = DOMElements[type + 'DropdownContent'];
    if (!container) return;
    
    let html = '';
    options.forEach(function(option) {
        const id = type + '_' + option.replace(/\s+/g, '_').replace(/[^a-zA-Z0-9_]/g, '');
        html += `
            <div class="dropdown-item" data-value="${escapeHtml(option)}" data-type="${type}">
                <input type="checkbox" class="dropdown-checkbox" id="${id}" data-value="${escapeHtml(option)}" data-type="${type}">
                <label for="${id}" class="dropdown-item-text">${escapeHtml(option)}</label>
            </div>
        `;
    });
    
    container.innerHTML = html;
    
    // Add event listeners to checkboxes
    container.addEventListener('change', function(e) {
        if (e.target.type === 'checkbox') {
            handleFilterChange(e.target.dataset.type, e.target.dataset.value, e.target.checked);
        }
    });
    
    // Prevent dropdown from closing when clicking inside
    container.addEventListener('click', function(e) {
        e.stopPropagation();
    });
}

/**
 * Toggle dropdown visibility
 * @param {string} type - Type of dropdown to toggle
 */
function toggleDropdown(type) {
    const content = DOMElements[type + 'DropdownContent'];
    const button = DOMElements[type + 'DropdownBtn'];
    
    if (!content || !button) return;
    
    // Close other dropdowns
    ['deities', 'directions', 'body'].forEach(function(otherType) {
        if (otherType !== type) {
            const otherContent = DOMElements[otherType + 'DropdownContent'];
            const otherButton = DOMElements[otherType + 'DropdownBtn'];
            if (otherContent && otherButton) {
                otherContent.classList.add('hidden');
                otherButton.classList.remove('active');
                otherButton.setAttribute('aria-expanded', 'false');
            }
        }
    });
    
    // Toggle current dropdown
    const isHidden = content.classList.contains('hidden');
    content.classList.toggle('hidden');
    button.classList.toggle('active');
    button.setAttribute('aria-expanded', isHidden ? 'true' : 'false');
}

/**
 * Close all open dropdowns
 */
function closeAllDropdowns() {
    ['deities', 'directions', 'body'].forEach(function(type) {
        const content = DOMElements[type + 'DropdownContent'];
        const button = DOMElements[type + 'DropdownBtn'];
        if (content && button) {
            content.classList.add('hidden');
            button.classList.remove('active');
            button.setAttribute('aria-expanded', 'false');
        }
    });
    
    // Close autocomplete
    if (DOMElements.autocompleteDropdown) {
        DOMElements.autocompleteDropdown.classList.add('hidden');
        DOMElements.searchInput.setAttribute('aria-expanded', 'false');
    }
}

/**
 * Update dropdown button text to show selection count
 * @param {string} type - Type of dropdown
 */
function updateDropdownLabel(type) {
    const mappedType = type === 'body' ? 'bodyParts' : type;
    const selectedArray = AppState['selected' + mappedType.charAt(0).toUpperCase() + mappedType.slice(1)];
    const textElement = DOMElements[type + 'SelectedText'];
    
    if (!textElement || !selectedArray) return;
    
    if (selectedArray.length === 0) {
        textElement.textContent = 'Select...';
    } else if (selectedArray.length === 1) {
        textElement.textContent = selectedArray[0];
    } else {
        textElement.textContent = `${selectedArray.length} selected`;
    }
}

/* ==========================================================================
   FILTER MANAGEMENT
   Handle filter selection and visual filter tags
   ========================================================================== */

/**
 * Handle filter checkbox changes
 * @param {string} type - Filter type ('deities', 'directions', 'body')
 * @param {string} value - Filter value
 * @param {boolean} checked - Whether checkbox is checked
 */
function handleFilterChange(type, value, checked) {
    const mappedType = type === 'body' ? 'bodyParts' : type;
    const selectedArray = AppState['selected' + mappedType.charAt(0).toUpperCase() + mappedType.slice(1)];
    
    if (checked) {
        if (selectedArray.indexOf(value) === -1) {
            selectedArray.push(value);
        }
    } else {
        const index = selectedArray.indexOf(value);
        if (index > -1) {
            selectedArray.splice(index, 1);
        }
    }
    
    // Update UI
    updateDropdownLabel(type);
    updateFilterTags();
    applyFiltersAndHighlights();
}

/**
 * Add a filter tag programmatically (from search autocomplete)
 * @param {string} type - Filter type
 * @param {string} value - Filter value
 */
function addFilterTag(type, value) {
    const mappedType = type === 'body' ? 'bodyParts' : type;
    const selectedArray = AppState['selected' + mappedType.charAt(0).toUpperCase() + mappedType.slice(1)];
    
    if (selectedArray.indexOf(value) === -1) {
        selectedArray.push(value);
        
        // Update corresponding checkbox in dropdown
        updateCheckboxInDropdown(type, value, true);
        updateDropdownLabel(type);
        updateFilterTags();
        applyFiltersAndHighlights();
    }
}

/**
 * Remove a filter tag
 * @param {string} type - Filter type
 * @param {string} value - Filter value
 */
function removeFilterTag(type, value) {
    const mappedType = type === 'body' ? 'bodyParts' : type;
    const selectedArray = AppState['selected' + mappedType.charAt(0).toUpperCase() + mappedType.slice(1)];
    
    const index = selectedArray.indexOf(value);
    if (index > -1) {
        selectedArray.splice(index, 1);
        
        // Update corresponding checkbox in dropdown
        updateCheckboxInDropdown(type, value, false);
        updateDropdownLabel(type);
        updateFilterTags();
        applyFiltersAndHighlights();
    }
}

/**
 * Update checkbox state in dropdown
 * @param {string} type - Filter type
 * @param {string} value - Filter value
 * @param {boolean} checked - Checked state
 */
function updateCheckboxInDropdown(type, value, checked) {
    const container = DOMElements[type + 'DropdownContent'];
    if (container) {
        const checkbox = container.querySelector(`input[data-value="${value}"]`);
        if (checkbox) {
            checkbox.checked = checked;
        }
    }
}

/**
 * Update visual filter tags display
 */
function updateFilterTags() {
    if (!DOMElements.activeFilters) return;
    
    let html = '';
    
    // Add deity tags
    AppState.selectedDeities.forEach(function(deity) {
        html += `
            <div class="filter-tag deity-tag">
                <span>${escapeHtml(deity)}</span>
                <button class="filter-tag-close" data-type="deities" data-value="${escapeHtml(deity)}" aria-label="Remove ${escapeHtml(deity)} filter">×</button>
            </div>
        `;
    });
    
    // Add direction tags
    AppState.selectedDirections.forEach(function(direction) {
        html += `
            <div class="filter-tag direction-tag">
                <span>${escapeHtml(direction)}</span>
                <button class="filter-tag-close" data-type="directions" data-value="${escapeHtml(direction)}" aria-label="Remove ${escapeHtml(direction)} filter">×</button>
            </div>
        `;
    });
    
    // Add body part tags
    AppState.selectedBodyParts.forEach(function(bodyPart) {
        html += `
            <div class="filter-tag body-tag">
                <span>${escapeHtml(bodyPart)}</span>
                <button class="filter-tag-close" data-type="body" data-value="${escapeHtml(bodyPart)}" aria-label="Remove ${escapeHtml(bodyPart)} filter">×</button>
            </div>
        `;
    });
    
    DOMElements.activeFilters.innerHTML = html;
    
    // Add click handlers to close buttons
    DOMElements.activeFilters.addEventListener('click', function(e) {
        if (e.target.classList.contains('filter-tag-close')) {
            const type = e.target.dataset.type;
            const value = e.target.dataset.value;
            removeFilterTag(type, value);
        }
    });
}

/* ==========================================================================
   SEARCH FUNCTIONALITY
   Enhanced search with autocomplete and filter integration
   ========================================================================== */

/**
 * Handle search input with autocomplete
 */
const handleSearch = debounce(function() {
    const searchTerm = DOMElements.searchInput.value.trim();
    AppState.searchTerm = searchTerm;
    
    if (searchTerm.length > 0) {
        showAutocomplete(searchTerm);
    } else {
        hideAutocomplete();
    }
    
    applyFiltersAndHighlights();
}, 300);

/**
 * Show autocomplete suggestions
 * @param {string} searchTerm - Current search term
 */
function showAutocomplete(searchTerm) {
    if (!DOMElements.autocompleteDropdown || searchTerm.length < 2) {
        hideAutocomplete();
        return;
    }
    
    const term = searchTerm.toLowerCase();
    const matches = AppState.searchableItems
        .filter(function(item) {
            return item.text.toLowerCase().indexOf(term) !== -1;
        })
        .slice(0, 8); // Limit to 8 suggestions
    
    if (matches.length === 0) {
        hideAutocomplete();
        return;
    }
    
    let html = '';
    matches.forEach(function(item) {
        html += `
            <div class="autocomplete-item" data-type="${item.type}" data-value="${escapeHtml(item.text)}">
                <span class="autocomplete-text">${escapeHtml(item.text)}</span>
                <span class="autocomplete-category ${item.type === 'body' ? 'body' : item.type.slice(0, -1)}">${item.category}</span>
            </div>
        `;
    });
    
    DOMElements.autocompleteDropdown.innerHTML = html;
    DOMElements.autocompleteDropdown.classList.remove('hidden');
    DOMElements.searchInput.setAttribute('aria-expanded', 'true');
    
    // Add click handlers to autocomplete items
    DOMElements.autocompleteDropdown.addEventListener('click', function(e) {
        const item = e.target.closest('.autocomplete-item');
        if (item) {
            const type = item.dataset.type;
            const value = item.dataset.value;
            
            // Clear search input
            DOMElements.searchInput.value = '';
            AppState.searchTerm = '';
            hideAutocomplete();
            
            // Add as filter instead
            addFilterTag(type, value);
        }
    });
}

/**
 * Hide autocomplete dropdown
 */
function hideAutocomplete() {
    if (DOMElements.autocompleteDropdown) {
        DOMElements.autocompleteDropdown.classList.add('hidden');
        DOMElements.searchInput.setAttribute('aria-expanded', 'false');
    }
}

/* ==========================================================================
   FILTERING AND HIGHLIGHTING
   Advanced OR-logic filtering with visual highlighting
   ========================================================================== */

/**
 * Apply filters and highlights to verses
 * Uses OR-logic: show verse if it matches ANY active filter
 */
function applyFiltersAndHighlights() {
    const verses = document.querySelectorAll('.verse');
    
    verses.forEach(function(verseElement, index) {
        const verse = VERSE_DATA[index];
        if (!verse) return;
        
        // Remove all highlight classes
        verseElement.classList.remove('highlight-deities', 'highlight-directions', 'highlight-body');
        
        // Check if any filters are active
        const hasActiveFilters = AppState.selectedDeities.length > 0 || 
                                AppState.selectedDirections.length > 0 || 
                                AppState.selectedBodyParts.length > 0;
        
        // Check for text search match
        const searchMatch = !AppState.searchTerm || 
            [verse.translation, verse.deities.join(' '), verse.directions.join(' '), verse.bodyParts.join(' ')]
            .join(' ').toLowerCase().indexOf(AppState.searchTerm.toLowerCase()) !== -1;
        
        let shouldShow = true;
        let highlightClasses = [];
        
        if (hasActiveFilters) {
            // Default to hide if filters are active
            shouldShow = false;
            
            // Check deity matches
            if (AppState.selectedDeities.length > 0) {
                const hasMatchingDeity = verse.deities.some(function(deity) {
                    return AppState.selectedDeities.indexOf(deity) !== -1;
                });
                if (hasMatchingDeity) {
                    shouldShow = true;
                    highlightClasses.push('highlight-deities');
                }
            }
            
            // Check direction matches
            if (AppState.selectedDirections.length > 0) {
                const hasMatchingDirection = verse.directions.some(function(direction) {
                    return AppState.selectedDirections.indexOf(direction) !== -1;
                });
                if (hasMatchingDirection) {
                    shouldShow = true;
                    highlightClasses.push('highlight-directions');
                }
            }
            
            // Check body part matches
            if (AppState.selectedBodyParts.length > 0) {
                const hasMatchingBodyPart = verse.bodyParts.some(function(bodyPart) {
                    return AppState.selectedBodyParts.indexOf(bodyPart) !== -1;
                });
                if (hasMatchingBodyPart) {
                    shouldShow = true;
                    highlightClasses.push('highlight-body');
                }
            }
        }
        
        // Apply search filter
        shouldShow = shouldShow && searchMatch;
        
        // Show/hide verse
        verseElement.style.display = shouldShow ? 'block' : 'none';
        
        // Apply highlight classes
        highlightClasses.forEach(function(className) {
            verseElement.classList.add(className);
        });
    });
}

/**
 * Clear all filters and search
 */
function clearAllFilters() {
    // Clear state
    AppState.clearAllFilters();
    
    // Clear UI elements
    DOMElements.searchInput.value = '';
    
    // Clear all checkboxes
    document.querySelectorAll('.dropdown-checkbox').forEach(function(checkbox) {
        checkbox.checked = false;
    });
    
    // Update dropdown labels
    updateDropdownLabel('deities');
    updateDropdownLabel('directions');
    updateDropdownLabel('body');
    
    // Clear filter tags
    updateFilterTags();
    
    // Clear highlights and show all verses
    document.querySelectorAll('.verse').forEach(function(verse) {
        verse.style.display = 'block';
        verse.classList.remove('highlight-deities', 'highlight-directions', 'highlight-body');
    });
    
    // Hide dropdowns and autocomplete
    closeAllDropdowns();
}

/* ==========================================================================
   DISPLAY FUNCTIONS
   Functions to handle text visibility toggles
   ========================================================================== */

/**
 * Toggle Sanskrit text visibility
 */
function toggleSanskrit() {
    AppState.showSanskrit = DOMElements.sanskritToggle.checked;
    updateDisplayClasses();
}

/**
 * Toggle transliteration text visibility
 */
function toggleTransliteration() {
    AppState.showTransliteration = DOMElements.transliterationToggle.checked;
    updateDisplayClasses();
}

/**
 * Update CSS classes on body element to control text visibility
 */
function updateDisplayClasses() {
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

/* ==========================================================================
   RENDERING FUNCTIONS
   Functions to generate and update the verse display
   ========================================================================== */

/**
 * Create HTML for category tags (deities, directions, body parts)
 * @param {Array} items - Array of category items
 * @param {string} type - Category type ('deity', 'direction', 'body')
 * @returns {string} - HTML string for tags
 */
function createTags(items, type) {
    if (!items || items.length === 0) return '';
    
    return items.map(function(item) {
        return `<span class="tag tag--${type}" title="${type}: ${escapeHtml(item)}">${escapeHtml(item)}</span>`;
    }).join('');
}

/**
 * Convert newlines to HTML line breaks
 * @param {string} text - Text with newlines
 * @returns {string} - Text with <br> tags
 */
function formatTextForHTML(text) {
    return escapeHtml(text).replace(/\n/g, '<br>');
}

/**
 * Create HTML for a single verse
 * @param {Object} verse - Verse data object
 * @returns {string} - HTML string for the verse
 */
function createVerseHTML(verse) {
    const deityTags = createTags(verse.deities, 'deity');
    const directionTags = createTags(verse.directions, 'direction');
    const bodyTags = createTags(verse.bodyParts, 'body');
    const allTags = deityTags + directionTags + bodyTags;
    
    return `
        <article class="verse" id="verse-${verse.number}" tabindex="0">
            <div class="verse-number">${verse.number}</div>
            
            <div class="sanskrit" lang="sa">${formatTextForHTML(verse.sanskrit)}</div>
            
            <div class="transliteration" lang="sa-Latn">${formatTextForHTML(verse.transliteration)}</div>
            
            <div class="translation" lang="en">${formatTextForHTML(verse.translation)}</div>
            
            ${allTags ? `<div class="tags">${allTags}</div>` : ''}
        </article>
    `;
}

/**
 * Render all verses to the DOM
 */
function renderVerses() {
    if (!DOMElements.versesContainer) {
        console.error('Verses container not found');
        return;
    }
    
    // Hide loading indicator
    if (DOMElements.loadingIndicator) {
        DOMElements.loadingIndicator.style.display = 'none';
    }
    
    // Generate HTML for all verses
    const versesHTML = VERSE_DATA
        .map(function(verse) {
            return createVerseHTML(verse);
        })
        .join('');
    
    // Update container content
    DOMElements.versesContainer.innerHTML = versesHTML;
}

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

        // Load verse data (single source of truth)
        await loadVerseData();

        // Initialize application state with loaded data
        AppState.init();

        // Cache DOM references
        cacheDOMElements();

        // Apply configuration now that config, state, and DOM are ready
        applyConfig();
        console.log('Version ' + CONFIG.app.version);

        // Populate dropdowns from the category registry (#8)
        CONFIG.categories.forEach(function(cat) {
            populateDropdown(cat.domKey, AppState[cat.allKey]);
        });
        
        // Set up event listeners
        initializeEventListeners();
        
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