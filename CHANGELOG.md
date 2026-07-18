# Changelog

All notable changes to the Daśamahāvidyā Kavacam Interactive Study Tool will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased] — on branch `fix/10-es-modules` (ships together on merge)

### 🏗️ Architecture (#10)
- **Split `app.js` into ES modules** under `js/` (`state`/`util`/`config`/`i18n`/`controls`/`filters`/`render`/`main`), loaded via `<script type="module">`. Parity-verified (search, theme, font, language, 14 verses). A Vite single-file bundle that also runs from `file://` is tracked in #33.
- Added a **module-graph test guard** (every `js/` import must resolve to a real export) — catches refactor drift where a renamed export silently breaks the app.

### 🐛 Fixed (#32, #34)
- Keep the **gear + pin buttons right-most** in the minimal/pinned control bar (#34)
- **Event-listener leaks**: the filter-tag close handler and autocomplete handler were re-bound on every render/keystroke — now bound once (#32)

### 📝 Docs (#32)
- Added **LICENSE** (MIT); rewrote the stale README (removed a frozen point-in-time audit; documented the module structure)

## [2.1.1] - 2026-07-18

### 📜 Content & provenance (#28, #4)
- Removed the erroneous **repeated उग्रतारा** in verse 10 (a dittography in the original data, not a variant) — confirmed against the chant slide + 3 published editions
- Verse 6 chant text **नील→निल** to match the global editorial consensus (translations keep the meaningful "Nīla/blue" name)
- Committed the **canonical source** (`data/canonical-source.md`) + provenance in `verses.json.metadata` — closing the source-of-truth gap that let the verse-10 error ship

### 🐛 Fixed (#1, #11, #16, #9, #27)
- **Translation search was broken** — it searched the pre-#25 singular field, so translation prose never matched; now searches across all locale translations
- Checkbox **tap targets 20→24px** (small-screen audit)
- Synced the banner version and declared `<meta name="version">` the single source (#9)
- **Hardened the service worker**: network-first navigation + tolerant precache (#27)

### ✨ Added (#30, #11)
- Subtle **footer build stamp** (`Last updated · <date> · <commit>`) + deploy protocol (`tools/stamp-version.py`) — the honest "what's live now" marker
- Extended **test guards**: verse-10 no-repeat, verse-6 निल, ॥N॥ format, i18n key-parity, translation-search drift — each **mutation-verified** to fail on its named failure

## [2.1.0] - 2026-07-17

### 🌐 Internationalization (#25)
- **Nepali + Spanish support**: `translation` (string) → `translations` (locale map); `i18n/{en,ne,es}.json` carry UI strings and term maps
- Language switcher (persists, sets `<html lang>`); localized UI, deity names, directions, body parts
- Fallback chain (locale → default → raw value) so a partial locale can never blank the UI
- Sanskrit + transliteration are never localized
- ⚠️ Nepali/Spanish content is an **unreviewed draft** (`status: draft`); review board at `reports/assets/i18n-review-board.html`

### 📖 Readability & accessibility (#13, #14, #16, #23)
- Self-hosted **Noto Serif Devanagari** — Sanskrit had been falling back to an OS font (Georgia has no Devanāgarī glyphs)
- Fluid `clamp()` type scale — Sanskrit now **grows** on small screens instead of shrinking
- **A− / A+ reader font-size stepper** (0.8×–2.5×, persisted)
- 44px minimum tap targets
- Non-breaking space before every daṇḍa (।/॥) and IAST pipe so the mark never wraps away from its word

### 🎨 Design (#17, #22)
- **"Manuscript at Dusk"** theme-aware palette (dusk/manuscript) with a sun/moon toggle
- Per-verse **orientation glyph**: direction rosette, seated/standing body figure, or all-around mandala — generated from each verse's data
- Fixed light-mode washout (surfaces were hardcoded white overlays) and a stale invalid `rgba(var(--color-primary), .95)` control background

### 🏗️ Architecture (#6, #8, #9, #12, #15, #11, #7)
- **Single source of truth**: removed the embedded verse-data fallback; fetch-only (served-only)
- **`config.json`** layer: app metadata, feature flags, breakpoints, category registry; single authoritative version
- Category registry drives dropdowns + colors; removed the `body`↔`bodyParts` munging
- **PWA**: manifest + cache-first service worker + maskable icons
- **Data validation guard** (`tests/validate-data.js`) covering verses, config, and locale files
- Retired the legacy single-file monolith; `index.html` is canonical

### 📜 Content (#3, #5)
- Verse corrections corroborated by 3 independent sources: V1 `āgneyāṃ`→`āgneyyāṃ`, V5 `स्वयं`→`स्वयम्`, V6 `śarvaṇī`→`śarvāṇī`, V13 metadata typo
- Restored the missing half-line breaks in verses 2–14 (only verse 1 had one)

### 🖱️ Controls (#23)
- **Pin now means "keep it slim"** (previously it froze the controls fully expanded, covering the screen); the gear is the deliberate expand
- Collapsed the phantom empty active-filters band; uniform padding — control panel roughly halved

## [2.0.0] - 2025-01-28

### 🏗️ Major Architecture Changes
- **BREAKING**: Complete rearchitecture to enterprise-standard modular design
- Separated CSS into external stylesheet (`styles.css`)
- Simplified JavaScript to essential functionality only
- Removed complex dropdown filtering system in favor of simple search
- Eliminated over-engineered state management system

### ✨ Added
- CSS custom properties (CSS variables) for consistent theming
- Comprehensive CSS documentation and comments
- Enterprise-standard file organization
- Accessibility enhancements (focus indicators, reduced motion support)
- Print styles for offline study
- Mobile-first responsive design
- High contrast mode support
- Version tracking system
- This changelog file

### 🎨 Improved
- Clean, semantic HTML structure
- Maintainable CSS architecture with logical sections
- Performance improvements through simplified codebase
- Better separation of concerns
- Enhanced code comments and documentation

### 🗑️ Removed
- Complex autocomplete dropdown system
- Over-engineered filtering mechanisms
- Excessive glassmorphism effects
- Unnecessary state management complexity
- Inline CSS and JavaScript (moved to separate files)
- Redundant event handling systems

### 🔧 Technical Improvements
- Modern CSS Grid and Flexbox layouts
- CSS custom properties for theming
- Improved accessibility features
- Better browser compatibility
- Reduced JavaScript complexity from 1400+ lines to essential functions only

---

## [1.0.0] - 2025-01-27

### ✨ Initial Release
- Interactive Sanskrit study tool
- Complete 14-verse Daśamahāvidyā Kavacam content
- Sanskrit/transliteration toggle functionality
- Complex filtering system with autocomplete
- Responsive design with glassmorphism effects
- Single-file HTML application with embedded CSS/JS

### 📝 Content
- All 14 verses with Sanskrit, transliteration, and English translation
- Deity categorization and tagging
- Directional protection mapping
- Anatomical coverage system
- Cultural context and usage notes

---

## Versioning Strategy

- **Major version** (X.0.0): Breaking changes, major rearchitecture
- **Minor version** (0.X.0): New features, significant improvements
- **Patch version** (0.0.X): Bug fixes, minor improvements

## Categories

- **🏗️ Architecture**: Major structural changes
- **✨ Added**: New features
- **🎨 Improved**: Enhancements to existing features
- **🐛 Fixed**: Bug fixes
- **🗑️ Removed**: Removed features
- **🔧 Technical**: Technical improvements
- **📝 Content**: Content updates
- **🔒 Security**: Security improvements
- **📚 Documentation**: Documentation changes