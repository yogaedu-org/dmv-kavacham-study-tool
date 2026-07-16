# Architecture, Configurability & Maintainability Review
**Repo:** dmv-kavacham-study-tool · **Branch:** rearchitecture · **Date:** 2026-07-15
**Mode:** PROPOSE-ONLY — nothing in the app was changed. Every item below is a proposal gated on your approval.
**Reviewer:** deep-pass (code-review-org-assessment skill)

---

## Executive summary

The `rearchitecture` branch did the right first move: it split the 1,419-line monolith
(`dmv-kavacham-interactive.html`) into `index.html` + `app.js` + `styles.css` +
`data/verses.json`. Concerns are separated, the CSS is already tokenized with custom
properties, and the JS is well-commented with strict mode and XSS-safe rendering.

The rearchitecture is **~70% complete**. What's missing is the payoff of the split:

1. **One source of truth for the verse data** — it currently lives in *three* places and has already drifted.
2. **A configuration layer** — the thing you explicitly asked for. Right now app identity, feature flags, and the category taxonomy are hardcoded across HTML/JS/CSS.
3. **Actual deployment of the new architecture** — the public "live demo" still serves the legacy monolith.

None of these are hard to fix. Below, each finding carries a **severity**, a **confidence**
label, and a **file:line** so it can go straight into an issue.

---

## Correctness / must-address (P0–P1)

### A1 — Verse data is triplicated and has already drifted · HIGH · CONFIRMED
The 14 verses exist in **three** copies:
- `data/verses.json` (canonical, rich: `themes`, `notes`, `metadata`)
- `FALLBACK_VERSE_DATA` in [app.js:31-158](app.js#L31-L158) (lite: no `themes`/`notes`)
- `dmv-kavacham-interactive.html` (the legacy monolith, a full third copy)

**Drift already present (verified):** verse 2 and verse 3 in `data/verses.json`
run the two half-lines together with `।` and **no `\n`** (e.g. `...भुवनेश्वरी ।वायव्यां...`
at [data/verses.json:25](data/verses.json#L25)), while the app.js fallback keeps the
`\n` line-break ([app.js:43](app.js#L43)). The rendered layout differs depending on
which data path loads — and the fallback loads whenever the page is opened over
`file://` (no server), which is the common "double-click the HTML" case.

**Why it matters:** every future text correction must be made in 2–3 places or the
copies diverge further. This is the single biggest maintainability liability.

**Proposed fix (pick one):**
- **(a) Fetch-only + document it.** Delete `FALLBACK_VERSE_DATA`; require the app be
  served (GitHub Pages already serves it). Simplest; loses double-click-to-open.
- **(b) Build-time inline.** A tiny build step reads `verses.json` and writes the
  fallback array into `app.js` (or a generated `data.js`) so the two can never drift.
- **(c) Keep fallback, add a drift guard.** A test asserts `FALLBACK_VERSE_DATA`
  deep-equals `verses.json.verses` (minus the rich fields). Catches drift in CI.

Recommendation: **(b)** if you want offline/double-click to keep working, else **(a)**.
A PWA service worker (see the responsive/PWA report) makes **(a)** painless because the
SW caches `verses.json` for offline use.

### A2 — The published "live demo" is the legacy monolith, not the rearchitecture · HIGH · CONFIRMED
[README.md:1](README.md#L1) and [README.md:100](README.md#L100), plus `og:url` at
[index.html:39](index.html#L39), point users at
`.../dmv-kavacham-interactive.html`. The clean split you built isn't what anyone sees.
**Proposed:** decide the canonical entry (`index.html`), update README + OG tags, and
either delete the monolith or leave a one-line redirect stub. Retiring it also removes
the third data copy from A1.

### A3 — Version numbers disagree across files · MED · CONFIRMED
`app.js` banner + `window.DMVKavacham.version` = **2.1.0** ([app.js:1262](app.js#L1262));
`index.html` meta = **2.0.0** ([index.html:33](index.html#L33)); `verses.json` metadata
= **1.0** ([data/verses.json:8](data/verses.json#L8)); `CHANGELOG.md` latest = **2.0.0**.
**Proposed:** one authoritative version (in `config.json`, see C1) surfaced everywhere;
keep data versioning (`verses.json`) separate and intentional from app versioning.

---

## Configurability — the "highly configurable from a config file" ask (P1)

### C1 — There is no config layer; app identity + behavior are hardcoded across three files · MED · CONFIRMED
Values that a maintainer would reasonably want to change without touching code are
currently scattered:

| Concern | Where it's hardcoded today |
|---|---|
| Title / subtitle | [index.html:57-58](index.html#L57-L58) **and** `verses.json.metadata` **and** app.js banner |
| Author / links (yogaedu.org, GH) | [index.html:60-61](index.html#L60-L61), OG tags, README |
| Default toggles (show Sanskrit/translit) | `AppState` [app.js:193-194](app.js#L193-L194) + `checked` attrs in HTML |
| Study-notes copy | [index.html:187-193](index.html#L187-L193) |
| Category taxonomy + colors | CSS vars + JS type strings (see C2) |
| Breakpoints (768 / 480) | magic numbers in `styles.css` |

**Proposed — `config.json` (or `config.js` for `file://` support):**
```jsonc
{
  "app":      { "title": "श्रीदशमहाविद्याकवचम्", "subtitle": "The Armor of the Ten Great Wisdom Goddesses",
                "author": "YogaEdu.org", "version": "2.1.0",
                "links": { "org": "https://github.com/yogaedu-org" } },
  "features": { "showSanskritDefault": true, "showTransliterationDefault": true,
                "enableSearch": true, "enableCompactMode": true, "enableFilters": true },
  "display":  { "breakpoints": { "tablet": 768, "mobile": 480 } },
  "categories": [
    { "key": "deities",   "dataField": "deities",   "label": "Deities",    "color": "#ff6b6b" },
    { "key": "directions","dataField": "directions","label": "Directions", "color": "#4ecdc4" },
    { "key": "bodyParts", "dataField": "bodyParts", "label": "Body",       "color": "#fb8500" }
  ]
}
```
Header text, notes, feature flags, and the category set all read from this one file.
The header can also be driven from `verses.json.metadata` to remove the duplicate title.

### C2 — The category taxonomy is hardcoded in three layers; adding a category means editing three files · MED · CONFIRMED
The three categories (`deity/direction/body`) are baked into:
- **JS behavior:** the `type === 'body' ? 'bodyParts' : type` string-munge is repeated
  ~8× ([app.js:562](app.js#L562), [589](app.js#L589), [615](app.js#L615),
  [635](app.js#L635), [657](app.js#L657) …) — fragile and easy to get wrong.
- **JS state keys:** `selectedDeities / selectedDirections / selectedBodyParts`
  ([app.js:200-202](app.js#L200-L202)) built by capitalized string concatenation.
- **CSS/markup:** `--color-deity/-direction/-body`, `.tag--deity` classes, three
  fixed dropdown blocks in [index.html:120-160](index.html#L120-L160).

**Proposed:** the `categories` registry from C1 becomes the single driver. Dropdowns,
tag colors (as CSS custom props injected from config), state keys, and the filter logic
all iterate the registry. Result: **add a category = one config entry**, no code edits.
Eliminates the `body`↔`bodyParts` special-case entirely.

---

## Modularity / structure (P2)

### M1 — `app.js` is one 1,264-line flat file of globals; no ES modules · MED · HYPOTHESIS (design opinion, not a bug)
All functions are global; the public surface is a hand-maintained `window.DMVKavacham`
object ([app.js:1239](app.js#L1239)). This works but doesn't realize the "modular"
intent. **Proposed ES-module split** (`<script type="module">`, no bundler needed for
modern browsers):

```
js/
  config.js     – loads config.json, exposes CONFIG
  data.js       – loadVerseData(), VERSE_DATA (fetch + optional fallback)
  state.js      – AppState + derived selectors (searchableItems, category values)
  dom.js        – cacheDOMElements(), DOMElements
  filters.js    – filter selection, tags, applyFiltersAndHighlights (registry-driven)
  search.js     – debounced search + autocomplete
  render.js     – createVerseHTML, renderVerses, createTags
  controls.js   – compact/pin/scroll, custom dropdowns
  main.js       – initializeApp wiring
```
Tradeoff to decide: ES modules + `fetch` both require the page be **served** (not
`file://`). This is fine on GitHub Pages and is resolved offline by a service worker,
but it makes the "double-click the file" workflow stop working — the same tradeoff as
A1(a). Keep this decision paired with A1.

### M2 — No automated tests guard the data or the pure logic · MED · CONFIRMED (absence verified)
Pure, testable logic with named failure modes exists and is untested:
- OR-logic filter matching ([app.js:810-885](app.js#L810-L885))
- search/autocomplete matching ([app.js:724-793](app.js#L724-L793))
- `escapeHtml` ([app.js:380-389](app.js#L380-L389))
- the `body`↔`bodyParts` mapping (the exact thing most likely to break under C2)

Per project policy (regression test per fixed bug; preempt named failures), I propose a
**small, targeted** suite — not test-for-tests'-sake:
- a **JSON-schema validation** of `verses.json` (every verse has the 7 fields; arrays
  are arrays; `number` is 1–14 and unique) — guards the data you're about to correct
  from the corroboration report;
- a **drift guard** for A1(c) if the fallback is kept;
- **characterization tests** pinning current filter + search output *before* any
  refactor (M1/C2), so the refactor can't silently change behavior.

### M3 — `overflow-x: hidden` on `body` can mask real horizontal-overflow bugs on mobile · LOW · HYPOTHESIS
[styles.css:87](styles.css#L87). It hides symptoms rather than fixing layout overflow;
worth a check at 320px width (see responsive report) rather than relying on the clip.

---

## Prioritized backlog (this report)

| ID | Severity | Title | Effort |
|----|----------|-------|--------|
| A1 | HIGH | De-duplicate verse data → one source of truth | S–M |
| A2 | HIGH | Point live demo at rearchitecture; retire/redirect monolith | S |
| C1 | MED  | Introduce `config.json` app/feature/display layer | M |
| C2 | MED  | Config-driven category registry (kills 3-layer coupling) | M |
| A3 | MED  | Single authoritative version number | S |
| M1 | MED  | ES-module split of app.js (decide `file://` tradeoff w/ A1) | M |
| M2 | MED  | Targeted tests: JSON schema + drift guard + characterization | M |
| M3 | LOW  | Verify/remove `overflow-x:hidden` masking | S |

**Machine-readable change set** (for a later, separately-approved implementation pass):
```
A1: remove-or-generate FALLBACK_VERSE_DATA; single verse source
A2: canonical=index.html; update README+OG; retire dmv-kavacham-interactive.html
C1: add config.(json|js); read app/features/display/categories
C2: refactor filters/search/render/state to iterate CONFIG.categories
A3: version from CONFIG.app.version everywhere
M1: split app.js into js/*.js ES modules (paired with A1 file:// decision)
M2: add test/ with schema-validate + drift-guard + characterization
```
