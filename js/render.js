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

function bodyZoneSet(parts) {
    const has = function(w) { return parts.some(function(x) { return x.toLowerCase().indexOf(w) !== -1; }); };
    const s = {};
    if (has('head') || has('forehead') || has('crown')) { s.crown = 1; s.head = 1; }
    if (has('brow') || has('nose') || has('eye') || has('ear') || has('face') || has('mouth') || has('tongue') || has('speech')) s.head = 1;
    if (has('neck') || has('throat') || has('griva')) s.throat = 1;
    if (has('chest') || has('arm') || has('finger') || has('back') || has('hand')) s.chest = 1;
    if (has('hip') || has('abdomen') || has('belly') || has('navel') || has('blood') || has('flesh') || has('bone') || has('marrow')) s.core = 1;
    if (has('thigh') || has('leg') || has('shank') || has('knee') || has('loin')) s.legs = 1;
    if (has('toe') || has('foot') || has('feet')) s.feet = 1;
    return s;
}
/** True if any guarded part is at the waist or below (#22 — picks the figure). */
function hasLowerBody(parts) {
    const kw = ['hip', 'abdomen', 'belly', 'navel', 'waist', 'thigh', 'leg', 'shank', 'knee', 'loin', 'toe', 'foot', 'feet'];
    return parts.some(function(p) {
        const s = p.toLowerCase();
        return kw.some(function(k) { return s.indexOf(k) !== -1; });
    });
}

/* Zone helpers shared by both figures: lit = guarded (body colour), else faint. */
function _figColor(z, k) { return z[k] ? 'var(--color-body)' : 'currentColor'; }
function _figOpacity(z, k) { return z[k] ? '1' : '0.4'; }
function _figWidth(z, k) { return z[k] ? 2.6 : 1.6; }
function _figHead(z, cy) {
    return '<circle cx="30" cy="' + cy + '" r="4.6" fill="' + (z.head ? 'var(--color-body)' : 'none') +
        '" fill-opacity="' + (z.head ? '0.85' : '0') + '" stroke="' + _figColor(z, 'head') +
        '" stroke-opacity="' + _figOpacity(z, 'head') + '" stroke-width="1.8"/>';
}
function _figSeg(z, k, x1, y1, x2, y2) {
    return '<line x1="' + x1 + '" y1="' + y1 + '" x2="' + x2 + '" y2="' + y2 + '" stroke="' +
        _figColor(z, k) + '" stroke-opacity="' + _figOpacity(z, k) + '" stroke-width="' +
        _figWidth(z, k) + '" stroke-linecap="round"/>';
}

/** Standing figure (tāḍāsana) — waist-and-below verses (#22). */
function standingFigureSVG(parts) {
    const z = bodyZoneSet(parts);
    let p = _figHead(z, 9);
    p += _figSeg(z, 'throat', 30, 13.6, 30, 17);           // neck
    p += _figSeg(z, 'chest', 23, 19, 37, 19);              // shoulders
    p += _figSeg(z, 'chest', 23, 19, 21.5, 33);            // left arm
    p += _figSeg(z, 'chest', 37, 19, 38.5, 33);            // right arm
    p += _figSeg(z, 'chest', 30, 17, 30, 29);              // upper trunk
    p += _figSeg(z, 'core', 30, 29, 30, 35);               // lower trunk
    p += _figSeg(z, 'core', 25.5, 35, 34.5, 35);           // hips
    p += _figSeg(z, 'legs', 27, 35, 26, 53);               // left leg
    p += _figSeg(z, 'legs', 33, 35, 34, 53);               // right leg
    p += _figSeg(z, 'feet', 26, 53, 22.5, 54.8);           // left foot
    p += _figSeg(z, 'feet', 34, 53, 37.5, 54.8);           // right foot
    return '<svg viewBox="0 0 60 60">' + p + '</svg>';
}

/** Seated lotus figure (padmāsana) — upper-body-only verses (#22). */
function lotusFigureSVG(parts) {
    const z = bodyZoneSet(parts);
    let p = _figHead(z, 11);
    p += _figSeg(z, 'throat', 30, 15.6, 30, 19);           // neck
    p += _figSeg(z, 'chest', 23, 21, 37, 21);              // shoulders
    p += '<path d="M23 21 Q19 30 22 37" fill="none" stroke="' + _figColor(z, 'chest') +
        '" stroke-opacity="' + _figOpacity(z, 'chest') + '" stroke-width="' + _figWidth(z, 'chest') + '" stroke-linecap="round"/>';
    p += '<path d="M37 21 Q41 30 38 37" fill="none" stroke="' + _figColor(z, 'chest') +
        '" stroke-opacity="' + _figOpacity(z, 'chest') + '" stroke-width="' + _figWidth(z, 'chest') + '" stroke-linecap="round"/>';
    p += _figSeg(z, 'chest', 30, 19, 30, 30);              // upper trunk
    p += _figSeg(z, 'core', 30, 30, 30, 36);               // lower trunk
    // crossed-leg base — static, faint (upper-body verses don't light it)
    p += '<path d="M18 46 Q30 35 42 46 Q30 50 18 46 Z" fill="currentColor" fill-opacity="0.16" ' +
        'stroke="currentColor" stroke-opacity="0.4" stroke-width="1.4" stroke-linejoin="round"/>';
    return '<svg viewBox="0 0 60 60">' + p + '</svg>';
}

function bodyGlyphSVG(bodyParts) {
    return hasLowerBody(bodyParts) ? standingFigureSVG(bodyParts) : lotusFigureSVG(bodyParts);
}
function mandalaGlyphSVG() {
    let p = '';
    [22, 15].forEach(function(r) { p += '<circle cx="30" cy="30" r="' + r + '" fill="none" stroke="var(--color-sanskrit)" stroke-opacity="0.6" stroke-width="1.4"/>'; });
    for (let i = 0; i < 8; i++) { const a = i * Math.PI / 4; p += '<circle cx="' + (30 + Math.cos(a) * 22).toFixed(1) + '" cy="' + (30 + Math.sin(a) * 22).toFixed(1) + '" r="2" fill="var(--color-sanskrit)"/>'; }
    p += '<circle cx="30" cy="30" r="7" fill="var(--color-deity)" fill-opacity="0.9"/>';
    return '<svg viewBox="0 0 60 60">' + p + '</svg>';
}
function glyphForVerse(verse) {
    if (verse.bodyParts && verse.bodyParts.length) return bodyGlyphSVG(verse.bodyParts);
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
