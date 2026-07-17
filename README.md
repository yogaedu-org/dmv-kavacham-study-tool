[**🌐 Live Demo**](https://yogaedu-org.github.io/dmv-kavacham-study-tool/) ← Click here to try it

> Served-only / installable PWA. The app fetches `data/verses.json`, so it must be served over HTTP(S) (GitHub Pages) — opening `index.html` directly via `file://` will not work.

# श्रीदशमहाविद्याकवचम् - Interactive Study Tool

An advanced web application for studying the Daśamahāvidyā Kavacam (Armor of the Ten Great Wisdom Goddesses). This tool provides multi-modal exploration through Sanskrit text, transliteration, translation, and intelligent filtering.

## 🌟 Features

### Text Display Options
- **Sanskrit Text**: Original Devanāgarī script with proper formatting
- **Transliteration**: IAST romanization for pronunciation guidance
- **Translation**: Complete prose translations — **English, नेपाली, Español**
- **Independent Toggles**: Show/hide Sanskrit and transliteration independently
- **Reader font size**: A− / A+ stepper scales the text (0.8×–2.5×) and remembers your choice
- **Self-hosted Devanāgarī**: Noto Serif Devanagari ships with the app, so Sanskrit renders identically everywhere

### Languages (i18n)
- **English / Nepali / Spanish** — switch from the toolbar; the choice persists and sets `<html lang>`
- Localized UI, deity names, directions and body parts (Nepali uses Devanāgarī forms; Spanish keeps IAST for Sanskrit proper nouns)
- **Sanskrit and transliteration are never localized** — they are the source text
- Anything missing in a locale falls back to English, so a partial locale can never blank the UI
- ⚠️ The Nepali and Spanish translations are currently **unreviewed drafts** (`status: draft` in `i18n/*.json`)

### Appearance & offline
- **Two themes**: "Manuscript at Dusk" (dark) and Manuscript (light), following your OS with a sun/moon toggle
- **Orientation glyph** per verse: a direction rosette (v1–4), a body figure — seated or standing (v5–11), or an all-around mandala (v12–14), drawn from each verse's own data
- **Installable PWA** with offline support via a cache-first service worker

### Advanced Filtering & Search
- **Multi-Category Filtering**: Filter by deities, directions, and body parts
- **OR-Logic Filtering**: Verses match if they contain ANY selected filter
- **Real-time Search**: Search across all verse content with autocomplete
- **Visual Filter Tags**: Active filters displayed as removable tags
- **Smart Autocomplete**: Type-ahead suggestions with category indicators

### Interactive Elements
- **Sticky Navigation**: Responsive search box that stays accessible while scrolling
- **Custom Dropdowns**: Multi-select dropdowns for each filter category
- **Highlight System**: Visual highlighting of verses matching active filters
- **Responsive Design**: Optimized for desktop and mobile viewing

### Study Features
- **Complete Coverage**: All 14 verses with structured metadata
- **Anatomical Mapping**: Systematic body part protection coverage
- **Directional Protection**: Eight directions plus comprehensive coverage
- **Deity Epithets**: Multiple names and forms for each goddess

## 🎯 Technical Architecture

### Data Structure
Each verse contains:
- **number**: Verse sequence (1-14)
- **sanskrit**: Devanāgarī text with HTML formatting
- **transliteration**: IAST romanization
- **translation**: English prose translation
- **deities**: Array of goddess names/epithets
- **directions**: Array of spatial orientations
- **bodyParts**: Array of anatomical terms

### Core Components
- **Data Layer**: `VERSE_DATA` array with structured verse objects
- **State Management**: `AppState` object with centralized application state
- **UI Layer**: `UI` object handling DOM interactions and rendering
- **Pure Implementation**: No external dependencies (HTML/CSS/JS only)

### CSS Framework
- **Glassmorphism Design**: Modern backdrop-filter effects
- **Color-Coded Categories**: Red (deities), teal (directions), orange (body parts)
- **Responsive Layout**: Mobile-first approach with smooth transitions
- **Accessibility**: High contrast, semantic HTML, keyboard navigation

## 🚀 Usage

### Text Study
1. **Toggle Display**: Use checkboxes to show/hide Sanskrit or transliteration
2. **Verse Navigation**: Each verse numbered and clearly separated
3. **Category Tags**: Visual indicators for deities, directions, and body parts

### Filtering & Search
1. **Dropdown Filters**: Select multiple items from each category
2. **Search Box**: Type to find specific terms with autocomplete
3. **Filter Tags**: Active filters shown as removable tags
4. **Clear Filters**: One-click reset of all filters

### Spatial Analysis
- **Directional Coverage**: Filter by compass directions (East, West, etc.)
- **Anatomical Study**: Explore protection by body parts (head, chest, etc.)
- **Deity Research**: Study specific goddesses across verses

## 📖 Content Overview

### Verse Structure
- **Verses 1-4**: Directional protection (8 directions + above + all-around)
- **Verses 5-11**: Anatomical coverage (head to toe protection)
- **Verses 12-14**: Comprehensive protection and completion

### Goddess Names
Contains multiple epithets and regional variations for:
- Kālī/Kālikā, Tārā, Tripurasundarī/Ṣoḍaśī
- Bhuvaneśvarī, Chinnamastā, Bhairavī
- Dhūmāvatī, Bagalāmukhī, Mātaṅgī
- Various regional and textual name variations

### Anatomical Coverage
Complete protection mapping:
- **Head Region**: Head, forehead, brows, eyes, ears, nose
- **Face/Neck**: Face, mouth, tongue, neck
- **Torso**: Chest, back, abdomen, hips
- **Limbs**: Arms, fingers, legs, thighs, toes
- **Internal**: Blood, flesh, bones, marrow

## 🔗 Live Demo

**Primary Access**: https://yogaedu-org.github.io/dmv-kavacham-study-tool/ (canonical `index.html`)

## 📊 Project Status & Quality Assessment

### Overall Quality: **9.2/10 - Excellent**

This is a well-crafted, professional educational tool with excellent architecture, clean code, and strong attention to detail.

### Code Quality Ratings

#### ✅ Architecture: A+
- Clean separation of concerns (HTML/CSS/JS in separate files)
- Single source of truth: verses load from `data/verses.json` only (the embedded fallback was removed in #6)
- Well-organized state management via `AppState` object (app.js:191-292)
- Proper modularization with logical code sections
- Enterprise-standard documentation throughout

#### ✅ JavaScript: A (1,264 lines - app.js)
- Excellent commenting and documentation
- Proper use of 'use strict' mode
- Good error handling: a failed data load renders a clear error state rather than failing silently
- Security-conscious (XSS prevention via `escapeHtml` at app.js:380-389)
- Debouncing for performance optimization (app.js:363-373)
- Clear function naming and organization

#### ✅ CSS: A (1,090 lines - styles.css)
- CSS custom properties for maintainable theming (styles.css:18-60)
- Logical section organization with clear headers
- Mobile-first responsive design (styles.css:926-1005)
- Accessibility features (focus indicators, reduced motion support at styles.css:1012-1037)
- Print styles included (styles.css:1044-1064)
- Compact mode with smooth transitions (styles.css:189-359)

#### ✅ HTML: A (204 lines - index.html)
- Semantic HTML5 structure
- Proper ARIA attributes throughout
- Good accessibility (screen reader support via .sr-only elements)
- Clean, well-commented markup

#### ✅ Data Structure: A (verses.json)
- Well-structured JSON with metadata
- Rich semantic data (deities, directions, bodyParts, themes)
- Proper IAST transliteration
- Designed for future expansion

### Security & Accessibility

**Security: Good**
- XSS prevention via `escapeHtml` function
- No obvious security vulnerabilities
- Safe DOM manipulation patterns
- No inline event handlers

**Accessibility: Excellent**
- ARIA attributes properly used
- Keyboard navigation supported
- Screen reader support (.sr-only utility class)
- Focus indicators for all interactive elements
- High contrast mode support
- Reduced motion support for vestibular disorders

### Performance

**Performance: Good**
- Cached DOM references (DOMElements object at app.js:303-337)
- Debounced event handlers for search
- Efficient filtering algorithms with OR-logic
- No external dependencies (fast initial load)
- Service worker caches the app shell for offline use (installable PWA)

### Known Issues

#### Minor Version Inconsistency
- app.js declares v2.1.0 (line 9)
- index.html declares v2.0.0 (line 33)
- CHANGELOG.md latest entry is v2.0.0

#### Git Status
- Currently on `rearchitecture` branch
- Modified files: app.js, index.html, styles.css (not yet committed)

### Recommendations

**Immediate:**
- Sync version numbers across all files to v2.1.0
- Update CHANGELOG.md for v2.1.0 release
- Commit current changes to rearchitecture branch
- Consider merging to main if stable

**Short Term:**
- Add `.gitignore` file for version control hygiene
- Add favicon (currently commented out in HTML)
- Consider basic unit tests for core functions
- Document browser compatibility requirements

**Long Term:**
- Consider build pipeline for minification/optimization
- Implement progressive web app (PWA) features
- Add offline support via service workers
- Consider internationalization (i18n) for non-English translations

## 🛠️ Development

### Current Version
**v2.1.0** (in development on `rearchitecture` branch)

### File Structure
```
├── app.js                         # Application logic (1,264 lines)
├── styles.css                     # Stylesheet (1,090 lines)
├── index.html                     # Main HTML structure
├── app.js                         # Application logic (config, i18n, filters, render, PWA)
├── styles.css                     # Theme tokens + all styling
├── config.json                    # App metadata, feature flags, locales, category registry
├── data/
│   └── verses.json                # Verse data — single source of truth (translations: {en,ne,es})
├── i18n/
│   ├── en.json                    # UI strings + term maps (source locale)
│   ├── ne.json                    # Nepali (DRAFT — unreviewed)
│   └── es.json                    # Spanish (DRAFT — unreviewed)
├── fonts/
│   └── NotoSerifDevanagari.woff2  # Self-hosted Devanāgarī face
├── icons/                         # PWA icons (192/512, maskable)
├── manifest.webmanifest           # PWA manifest
├── sw.js                          # Cache-first service worker (offline app shell)
├── tests/
│   └── validate-data.js           # Data + locale validation guard (node tests/validate-data.js)
├── tools/i18n/                    # Generator for the translation review board
├── reports/                       # Review reports + boards
├── CHANGELOG.md                   # Version history
└── README.md                      # This documentation
```

### Checks

```bash
node tests/validate-data.js   # verses.json + config.json + locale files
```

### Technology Stack
- **Pure Vanilla JavaScript** (ES5-compatible, no frameworks)
- **CSS3** with custom properties (CSS variables)
- **HTML5** with semantic markup
- **JSON** for structured data
- **No build process required** - runs directly in browser

### Extensibility
- **Add Verses**: Extend `VERSE_DATA` array with new verse objects (app.js:31-158)
- **New Categories**: Add metadata arrays and update filtering logic
- **UI Customization**: Modify CSS custom properties in styles.css:18-60
- **API Integration**: Build on state management layer (AppState object)
- **Data Loading**: Fetches `data/verses.json` (single source of truth); served-only, offline via the service worker

### Performance Features
- **Efficient DOM Manipulation**: Cached element references (app.js:303-337)
- **Minimal Re-rendering**: Targeted updates only
- **Event Delegation**: Optimized event handling
- **Debounced Search**: Prevents excessive function calls (app.js:724-735)
- **Responsive Caching**: Smart UI state management

## 📚 Cultural Context

The Daśamahāvidyā Kavacam is a traditional Sanskrit protective hymn invoking the ten great wisdom goddesses (Mahāvidyās) for comprehensive spiritual protection. This tool aids in:

- **Academic Study**: Textual analysis and comparison
- **Devotional Practice**: Memorization and recitation support
- **Cultural Education**: Understanding goddess traditions
- **Linguistic Learning**: Sanskrit and transliteration study

## 🎨 Design Philosophy

### Educational Focus
- **Multi-modal Learning**: Visual, textual, and interactive elements
- **Progressive Disclosure**: Information available at multiple levels
- **Cultural Sensitivity**: Respectful presentation of sacred texts

### User Experience
- **Intuitive Navigation**: Clear information hierarchy
- **Responsive Interaction**: Immediate feedback for all actions
- **Accessibility**: Compatible with screen readers and keyboard navigation
- **Performance**: Fast loading and smooth interactions
