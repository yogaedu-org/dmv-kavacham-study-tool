[**🌐 Live Demo**](https://yogaedu-org.github.io/dmv-kavacham-study-tool/) ← Click here to try it

> Served-only / installable PWA. The app `fetch()`es `data/verses.json` and loads ES modules, so it must be served over HTTP(S) (GitHub Pages) — opening `index.html` directly via `file://` will not work. (A self-contained single-file build that *does* run from `file://` is tracked in #33.)

# श्रीदशमहाविद्याकवचम् — Interactive Study Tool

A web application for studying the Daśamahāvidyā Kavacam (Armor of the Ten Great Wisdom Goddesses). It offers multi-modal exploration through Sanskrit text, IAST transliteration, translations in three languages, and category filtering/search — with an offline-capable PWA shell and a "Manuscript at Dusk" theme.

## 🌟 Features

### Text & reading
- **Sanskrit** in Devanāgarī, **IAST transliteration**, and **translations** in **English, नेपाली, Español**
- Independent show/hide toggles for Sanskrit and transliteration
- **Reader font size**: A− / A+ stepper (0.8×–2.5×), remembered across visits
- **Self-hosted Devanāgarī** (Noto Serif Devanagari) so Sanskrit renders identically everywhere

### Languages (i18n)
- Switch English / Nepali / Spanish from the toolbar; the choice persists and sets `<html lang>`
- Localized UI, deity names, directions, and body parts (Nepali in Devanāgarī; Spanish keeps IAST for Sanskrit proper nouns)
- **Sanskrit and transliteration are never localized** — they are the source text
- Missing strings fall back to English, so a partial locale can never blank the UI
- Translations are **accepted** (an AI-assisted first pass; a footer disclaimer invites native-speaker corrections via the GitHub issue form)

### Appearance & offline
- **Two themes** — "Manuscript at Dusk" (dark) and Manuscript (light) — follow the OS with a sun/moon toggle
- **Orientation glyph** per verse: a direction rosette (v1–4), a body figure (v5–11), or an all-around mandala (v12–14), drawn from each verse's own data
- **Installable PWA**: a service worker serves the app shell offline (network-first for the page, cache-first for assets)
- Streamlined **compact / pinned** control bar for small screens

### Filtering & search
- Multi-select filtering by **deities**, **directions**, and **body parts** (OR-logic: match ANY selected filter)
- Real-time **search** across Sanskrit, transliteration, all translations, and category terms, with type-ahead **autocomplete**
- Active filters shown as removable tags; one-click **Clear filters**

## 🏗️ Architecture

No build step for the hosted app — plain ES modules served directly. (A Vite single-file build is tracked in #33.)

### Data
- **`data/verses.json`** is the single source of truth. Each verse: `number`, `sanskrit`, `transliteration`, `translations` (a `{en, ne, es}` locale map), `deities[]`, `directions[]`, `bodyParts[]`, `themes[]`, `notes`.
- **`data/canonical-source.md`** records the authoritative chant text + provenance (see #28); `verses.json.metadata.source` points at it.
- **`config.json`** holds app metadata, feature flags, locales, and the category registry (key/dataField/color/cssVar …), which drives filtering and theming.
- **`i18n/{en,ne,es}.json`** hold `ui` strings + `terms` maps (deities/directions/bodyParts).

### Code (`js/` ES modules, entry `js/main.js`)
| Module | Responsibility |
|---|---|
| `state.js` | `AppState`, `DOMElements`, `VERSE_DATA`/`CONFIG` (live bindings + setters), data load |
| `util.js` | `debounce`, `escapeHtml`, DOM helpers, lookup maps |
| `config.js` | config load/apply, category colors, theme toggle |
| `i18n.js` | locale load, `t()`/`term()`/`verseTranslation()`, language switcher |
| `controls.js` | font-size stepper, compact/pin toggles, scroll behavior, display toggles |
| `filters.js` | dropdowns, filter tags, search, autocomplete, highlight/show-hide |
| `render.js` | verse HTML, glyph SVGs, `renderVerses()` |
| `main.js` | DOM caching, event wiring, init, `window.DMVKavacham` export |

Security: user-facing values pass through `escapeHtml` (XSS-safe DOM building). No external runtime dependencies.

## 🚀 Usage

- **Toggle** Sanskrit/transliteration with the checkboxes; scale text with A− / A+.
- **Filter** via the dropdowns (deities / directions / body parts); combine freely (OR-logic).
- **Search** to find a term across text, translations, and categories; pick an autocomplete suggestion to turn it into a filter.
- **Clear filters** resets everything.

## 📖 Content

- **Verses 1–4**: directional protection (eight directions + above + all-around)
- **Verses 5–11**: anatomical coverage (head to toe)
- **Verses 12–14**: comprehensive protection and completion

Goddesses invoked include Kālī/Kālikā, Tārā, Tripurasundarī/Ṣoḍaśī, Bhuvaneśvarī, Chinnamastā, Bhairavī, Dhūmāvatī, Bagalāmukhī, and Mātaṅgī, with regional/textual epithets.

## 🛠️ Development

### Checks
```bash
node tests/validate-data.js   # schema + content-regression + i18n key-parity + drift guards
```

### Deploy (GitHub Pages, from `main`)
Every deploy MUST refresh the footer build stamp — see `CLAUDE.md` "Deploy protocol (#30)":
```bash
python tools/stamp-version.py           # stamps date + commit into index.html
git commit -am "chore(deploy): stamp version" && git push origin main
```

### File structure
```
├── index.html                     # Shell; loads js/main.js as a module + the build stamp
├── styles.css                     # Theme tokens + all styling
├── js/                            # ES modules (see the Architecture table)
│   ├── main.js  state.js  util.js  config.js
│   └── i18n.js  controls.js  filters.js  render.js
├── config.json                    # App metadata, feature flags, locales, category registry
├── data/
│   ├── verses.json                # Verse data — single source of truth (translations: {en,ne,es})
│   └── canonical-source.md        # Authoritative chant text + provenance (#28)
├── i18n/{en,ne,es}.json           # UI strings + term maps
├── fonts/NotoSerifDevanagari.woff2 # Self-hosted Devanāgarī face
├── icons/                         # PWA icons (192 / 512)
├── manifest.webmanifest           # PWA manifest
├── sw.js                          # Service worker (network-first page, cache-first assets)
├── tests/validate-data.js         # Validation + regression guards
├── tools/                         # stamp-version.py + i18n review-board generator
├── reports/                       # Review reports + decision boards
├── CHANGELOG.md
└── LICENSE                        # MIT
```

### Technology
Vanilla JavaScript (ES modules), CSS3 custom properties, semantic HTML5, JSON data. No framework, no build step for the hosted app.

## 📚 Cultural context

The Daśamahāvidyā Kavacam is a traditional Sanskrit protective hymn invoking the ten Mahāvidyās for comprehensive spiritual protection. This tool supports academic study, devotional practice/recitation, and Sanskrit/transliteration learning — presenting a sacred text with care.

## 📄 License

MIT — see [LICENSE](LICENSE). © 2025–2026 YogaEdu.org.
