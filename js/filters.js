'use strict';

import { AppState, DOMElements, VERSE_DATA } from './state.js';
import { escapeHtml, debounce } from './util.js';
import { categoryByDomKey, term, t } from './i18n.js';

/* ==========================================================================
   DROPDOWN FUNCTIONALITY
   Custom dropdown creation and management
   ========================================================================== */

/**
 * Populate a dropdown with checkbox options
 * @param {string} type - Type of dropdown ('deities', 'directions', 'body')
 * @param {Array} options - Array of option values
 */
export function populateDropdown(type, options) {
    const container = DOMElements[type + 'DropdownContent'];
    if (!container) return;
    
    // Labels are localized (#25); data-value stays canonical so filtering still matches.
    const cat = categoryByDomKey(type);
    const field = cat ? cat.dataField : type;
    const selected = (cat && AppState[cat.stateKey]) || [];

    let html = '';
    options.forEach(function(option) {
        const id = type + '_' + option.replace(/\s+/g, '_').replace(/[^a-zA-Z0-9_]/g, '');
        const checked = selected.indexOf(option) !== -1 ? ' checked' : '';
        html += `
            <div class="dropdown-item" data-value="${escapeHtml(option)}" data-type="${type}">
                <input type="checkbox" class="dropdown-checkbox" id="${id}" data-value="${escapeHtml(option)}" data-type="${type}"${checked}>
                <label for="${id}" class="dropdown-item-text">${escapeHtml(term(field, option))}</label>
            </div>
        `;
    });

    container.innerHTML = html;

    // Bind once. This function re-runs on a locale change, and these listeners sit on
    // the container (which survives innerHTML), so re-binding would double-fire (#25).
    if (container.dataset.wired === '1') return;
    container.dataset.wired = '1';

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
export function toggleDropdown(type) {
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
export function closeAllDropdowns() {
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
export function updateDropdownLabel(type) {
    // Registry-driven (#8) + localized (#25) — no more body↔bodyParts string munging.
    const cat = categoryByDomKey(type);
    const selectedArray = cat ? AppState[cat.stateKey] : null;
    const textElement = DOMElements[type + 'SelectedText'];

    if (!textElement || !selectedArray) return;

    if (selectedArray.length === 0) {
        textElement.textContent = t('filters.select');
    } else if (selectedArray.length === 1) {
        textElement.textContent = term(cat.dataField, selectedArray[0]);
    } else {
        textElement.textContent = selectedArray.length + ' ' + t('filters.selectedSuffix');
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
export function handleFilterChange(type, value, checked) {
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
export function addFilterTag(type, value) {
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
export function removeFilterTag(type, value) {
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
export function updateCheckboxInDropdown(type, value, checked) {
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
export function updateFilterTags() {
    if (!DOMElements.activeFilters) return;
    
    let html = '';
    
    // Add deity tags
    AppState.selectedDeities.forEach(function(deity) {
        html += `
            <div class="filter-tag deity-tag">
                <span>${escapeHtml(term('deities', deity))}</span>
                <button class="filter-tag-close" data-type="deities" data-value="${escapeHtml(deity)}" aria-label="Remove ${escapeHtml(deity)} filter">×</button>
            </div>
        `;
    });
    
    // Add direction tags
    AppState.selectedDirections.forEach(function(direction) {
        html += `
            <div class="filter-tag direction-tag">
                <span>${escapeHtml(term('directions', direction))}</span>
                <button class="filter-tag-close" data-type="directions" data-value="${escapeHtml(direction)}" aria-label="Remove ${escapeHtml(direction)} filter">×</button>
            </div>
        `;
    });
    
    // Add body part tags
    AppState.selectedBodyParts.forEach(function(bodyPart) {
        html += `
            <div class="filter-tag body-tag">
                <span>${escapeHtml(term('bodyParts', bodyPart))}</span>
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
export const handleSearch = debounce(function() {
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
export function showAutocomplete(searchTerm) {
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
export function hideAutocomplete() {
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
export function applyFiltersAndHighlights() {
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
        
        // Check for text search match.
        // #25 replaced the old singular translation field with a verse.translations
        // locale map; search across ALL locales so an English query matches while viewing ne/es.
        const translationsText = verse.translations
            ? Object.keys(verse.translations).map(function (k) { return verse.translations[k]; }).join(' ')
            : '';
        const searchMatch = !AppState.searchTerm ||
            [translationsText, verse.deities.join(' '), verse.directions.join(' '), verse.bodyParts.join(' ')]
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
export function clearAllFilters() {
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

/**
 * Create HTML for category tags (deities, directions, body parts)
 * @param {Array} items - Array of category items
 * @param {string} type - Category type ('deity', 'direction', 'body')
 * @returns {string} - HTML string for tags
 */
export function createTags(items, type, field) {
    if (!items || items.length === 0) return '';

    return items.map(function(item) {
        // Display is localized (#25); data-value stays canonical so filtering still matches.
        const label = term(field, item);
        return `<span class="tag tag--${type}" data-value="${escapeHtml(item)}" title="${type}: ${escapeHtml(label)}">${escapeHtml(label)}</span>`;
    }).join('');
}
