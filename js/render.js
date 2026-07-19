'use strict';

import { escapeHtml, DIR_ANGLES } from './util.js';
import { DOMElements, VERSE_DATA, I18N } from './state.js';
import { verseTranslation } from './i18n.js';
import { createTags } from './filters.js';

/* ==========================================================================
   RENDERING FUNCTIONS
   Functions to generate and update the verse display
   ========================================================================== */

/**
 * Convert newlines to HTML line breaks
 * @param {string} text - Text with newlines
 * @returns {string} - Text with <br> tags
 */
function formatTextForHTML(text) {
    // Non-breaking space before daṇḍa (।/॥) and IAST pipe daṇḍa (|/||) so the mark
    // never wraps away from its word when the reader font size grows (#23).
    return escapeHtml(text)
        .replace(/ ([।॥]|\|+)/g, ' $1')
        .replace(/\n/g, '<br>');
}

/* ==========================================================================
   ORIENTATION GLYPHS (#17)
   Each verse's glyph is drawn from its own data: a direction rosette (which
   quarters it guards), a body axis (which region), or an all-around mandala.
   Static SVG built from trusted verse data — no user input.
   ========================================================================== */

function compassGlyphSVG(directions) {
    const R = 20, all = directions.indexOf('All sides') !== -1, above = directions.indexOf('Above') !== -1;
    let p = '<circle cx="30" cy="30" r="23" fill="none" stroke="currentColor" stroke-opacity="0.35" stroke-width="1"/>';
    Object.keys(DIR_ANGLES).forEach(function(name) {
        const a = DIR_ANGLES[name] * Math.PI / 180, on = all || directions.indexOf(name) !== -1;
        const x = (30 + Math.cos(a) * R).toFixed(1), y = (30 + Math.sin(a) * R).toFixed(1);
        const col = on ? 'var(--color-direction)' : 'currentColor', op = on ? '1' : '0.4';
        p += '<line x1="30" y1="30" x2="' + x + '" y2="' + y + '" stroke="' + col + '" stroke-opacity="' + op + '" stroke-width="' + (on ? 2 : 1) + '" stroke-linecap="round"/>';
        p += '<circle cx="' + x + '" cy="' + y + '" r="' + (on ? 3.2 : 2) + '" fill="' + col + '" fill-opacity="' + op + '"/>';
    });
    const c = above || all;
    p += '<circle cx="30" cy="30" r="' + (c ? 4 : 3) + '" fill="' + (c ? 'var(--color-sanskrit)' : 'transparent') + '" stroke="var(--color-sanskrit)" stroke-width="1.3"/>';
    return '<svg viewBox="0 0 60 60">' + p + '</svg>';
}

/* Body-part glyph (#22): a per-verse illustration keyed to the primary guarded
   region, exported from the Gemini 3 Pro Image sprite sheet (see design/). The
   figure's matching zone glows. Priority-ordered keyword -> figures/body-<zone>.webp. */
var _ZONE_KW = [
    ['toe', 'feet'], ['foot', 'feet'], ['feet', 'feet'],
    ['thigh', 'legs'], ['shank', 'legs'], ['knee', 'legs'], ['leg', 'legs'],
    ['hip', 'hips'], ['waist', 'hips'], ['loin', 'hips'],
    ['behind', 'back'], ['back', 'back'], ['prishtha', 'back'],
    ['navel', 'belly'], ['belly', 'belly'], ['abdomen', 'belly'],
    ['blood', 'belly'], ['flesh', 'belly'], ['bone', 'belly'], ['marrow', 'belly'],
    ['finger', 'hands'], ['hand', 'hands'], ['arm', 'hands'],
    ['chest', 'chest'],
    ['neck', 'neck'], ['throat', 'neck'], ['griva', 'neck'],
    ['tongue', 'face'], ['mouth', 'face'], ['brow', 'face'], ['eye', 'face'],
    ['ear', 'face'], ['nose', 'face'], ['face', 'face'], ['speech', 'face'],
    ['forehead', 'head'], ['crown', 'head'], ['head', 'head']
];
function bodyZoneFor(parts) {
    for (var i = 0; i < parts.length; i++) {
        var s = parts[i].toLowerCase();
        for (var j = 0; j < _ZONE_KW.length; j++) {
            if (s.indexOf(_ZONE_KW[j][0]) !== -1) return _ZONE_KW[j][1];
        }
    }
    return 'chest';
}
function bodyGlyphImg(bodyParts) {
    var zone = bodyZoneFor(bodyParts);
    return '<img class="verse-glyph-img" src="figures/body-' + zone + '.webp" alt="" loading="lazy" width="200" height="329">';
}
function mandalaGlyphSVG() {
    let p = '';
    [22, 15].forEach(function(r) { p += '<circle cx="30" cy="30" r="' + r + '" fill="none" stroke="var(--color-sanskrit)" stroke-opacity="0.6" stroke-width="1.4"/>'; });
    for (let i = 0; i < 8; i++) { const a = i * Math.PI / 4; p += '<circle cx="' + (30 + Math.cos(a) * 22).toFixed(1) + '" cy="' + (30 + Math.sin(a) * 22).toFixed(1) + '" r="2" fill="var(--color-sanskrit)"/>'; }
    p += '<circle cx="30" cy="30" r="7" fill="var(--color-deity)" fill-opacity="0.9"/>';
    return '<svg viewBox="0 0 60 60">' + p + '</svg>';
}
function glyphForVerse(verse) {
    if (verse.bodyParts && verse.bodyParts.length) return bodyGlyphImg(verse.bodyParts);
    if (verse.directions && verse.directions.length) return compassGlyphSVG(verse.directions);
    return mandalaGlyphSVG();
}

/**
 * Create HTML for a single verse
 * @param {Object} verse - Verse data object
 * @returns {string} - HTML string for the verse
 */
function createVerseHTML(verse) {
    const deityTags = createTags(verse.deities, 'deity', 'deities');
    const directionTags = createTags(verse.directions, 'direction', 'directions');
    const bodyTags = createTags(verse.bodyParts, 'body', 'bodyParts');
    const allTags = deityTags + directionTags + bodyTags;
    
    return `
        <article class="verse" id="verse-${verse.number}" tabindex="0">
            <div class="verse-glyph" aria-hidden="true">${glyphForVerse(verse)}</div>
            <div class="verse-number">${verse.number}</div>

            <div class="sanskrit" lang="sa">${formatTextForHTML(verse.sanskrit)}</div>
            
            <div class="transliteration" lang="sa-Latn">${formatTextForHTML(verse.transliteration)}</div>
            
            <div class="translation" lang="${I18N.locale}">${formatTextForHTML(verseTranslation(verse))}</div>
            
            ${allTags ? `<div class="tags">${allTags}</div>` : ''}
        </article>
    `;
}

/**
 * Render all verses to the DOM
 */
export function renderVerses() {
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
