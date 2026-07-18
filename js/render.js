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

/* Region renderer shared by both figures (#22 SVG upgrade): a filled outline
   shape per body zone, tinted in --color-body when that zone is guarded, faint
   otherwise. Manuscript-line-art style traced from the Gemini reference in design/. */
function _reg(z, k, d, fillOp) {
    const lit = !!z[k];
    return '<path d="' + d + '" fill="' + (lit ? 'var(--color-body)' : 'none') +
        '" fill-opacity="' + (lit ? (fillOp || 0.2) : 0) + '" stroke="' + (lit ? 'var(--color-body)' : 'currentColor') +
        '" stroke-opacity="' + (lit ? 1 : 0.42) + '" stroke-width="' + (lit ? 1.8 : 1.3) +
        '" stroke-linejoin="round" stroke-linecap="round"/>';
}
function _headEllipse(z, cy) {
    const lit = !!z.head;
    return '<ellipse cx="30" cy="' + cy + '" rx="4.3" ry="4.9" fill="' + (lit ? 'var(--color-body)' : 'none') +
        '" fill-opacity="' + (lit ? 0.28 : 0) + '" stroke="' + (lit ? 'var(--color-body)' : 'currentColor') +
        '" stroke-opacity="' + (lit ? 1 : 0.42) + '" stroke-width="' + (lit ? 1.8 : 1.3) + '"/>';
}

/** Standing figure (tāḍāsana) — waist-and-below verses (#22). */
function standingFigureSVG(parts) {
    const z = bodyZoneSet(parts);
    let p = _headEllipse(z, 8.5);
    p += _reg(z, 'throat', 'M27.6 12.6 L32.4 12.6 L31.7 16 L28.3 16 Z');                      // neck
    p += _reg(z, 'chest', 'M22 17.6 Q30 15.4 38 17.6 L36.4 29 Q30 31 23.6 29 Z');            // shoulders + upper torso
    p += _reg(z, 'chest', 'M22.6 18.4 Q17.8 25 18.7 33.2 Q19 34.9 20.7 34.4 Q20.4 26 26 20.4 Z'); // left arm+hand
    p += _reg(z, 'chest', 'M37.4 18.4 Q42.2 25 41.3 33.2 Q41 34.9 39.3 34.4 Q39.6 26 34 20.4 Z'); // right arm+hand
    p += _reg(z, 'core', 'M23.8 29 Q30 31 36.2 29 L34.6 38 Q30 40 25.4 38 Z');               // midsection / belly
    p += _reg(z, 'legs', 'M26 38 Q24.8 46 25 52.6 L26.8 52.6 Q28 46 29.2 38.6 Z');           // left leg
    p += _reg(z, 'legs', 'M34 38 Q35.2 46 35 52.6 L33.2 52.6 Q32 46 30.8 38.6 Z');           // right leg
    p += _reg(z, 'feet', 'M25 52.2 L26.9 52.2 L27 54.2 Q22.9 55 22.3 54 Z');                 // left foot
    p += _reg(z, 'feet', 'M35 52.2 L33.1 52.2 L33 54.2 Q37.1 55 37.7 54 Z');                 // right foot
    return '<svg viewBox="0 0 60 60">' + p + '</svg>';
}

/** Seated lotus figure (padmāsana) — upper-body-only verses (#22). */
function lotusFigureSVG(parts) {
    const z = bodyZoneSet(parts);
    let p = _headEllipse(z, 10.5);
    p += _reg(z, 'throat', 'M27.6 14.6 L32.4 14.6 L31.7 18 L28.3 18 Z');                      // neck
    p += _reg(z, 'chest', 'M22 19.6 Q30 17.4 38 19.6 L36.4 31 Q30 33 23.6 31 Z');            // shoulders + upper torso
    p += _reg(z, 'chest', 'M22.6 20.4 Q18 27 19.4 34 Q19.8 35.4 21.3 35 Q21 28 26 22.4 Z');  // left arm
    p += _reg(z, 'chest', 'M37.4 20.4 Q42 27 40.6 34 Q40.2 35.4 38.7 35 Q39 28 34 22.4 Z');  // right arm
    p += _reg(z, 'core', 'M23.8 31 Q30 33 36.2 31 L35 39 Q30 41 25 39 Z');                   // midsection
    // crossed-leg base — static faint (upper-body verses don't light it)
    p += '<path d="M17 47 Q30 37.5 43 47 Q30 52 17 47 Z" fill="currentColor" fill-opacity="0.14" ' +
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
