# Code Quality Assessment — dmv-kavacham-study-tool

**Date:** 2026-07-18
**Scope:** Full re-run — code (`app.js`), docs (README/CHANGELOG/CLAUDE.md/comments), reference & data files (`data/`, `config.json`, `i18n/`), repo organization.
**Method:** Direct read of every source file at the paths below. Findings cite `file:line`. Line counts current as of this pass (`app.js` 1596, `styles.css` 1257, `index.html` 231).

---

## Executive Summary

**Overall grade: A− (strong).** This is a genuinely well-built no-build static app. The rearchitecture landed cleanly: a config layer, a category registry, single-source verse data, a hardened network-first-for-HTML service worker, self-hosted Devanāgarī, a theme-aware palette, and full en/ne/es i18n with disciplined key parity. Comments are issue-referenced and accurate; the data-validation guard is real and useful; the canonical-source provenance doc is exemplary.

The grade is held below A by one **functional regression** (translation search is silently broken), a **README that half-contradicts itself** (a stale embedded audit sitting under fresh feature docs), and two **event-listener accumulation smells**. None are architectural; all are contained fixes.

### Top 3 things to fix

1. **Full-text search over translations is broken.** `app.js:1007` still reads `verse.translation` (singular), but the `#25` i18n work renamed that field to `translations` (a locale map) in `data/verses.json`. The value is `undefined`, so search now matches only the canonical deity/direction/body tokens — never the translation prose the user is typing against. Fix + add a regression test (this is exactly the "bug → tripwire test" case).
2. **README is stale and self-contradictory.** The bottom half (lines ~118–275) is a frozen older audit — wrong line numbers, wrong line counts, a non-existent `UI` object, an "ES5-compatible" claim that is false, "draft" locale status that is now "accepted", a duplicated File-Structure block, and a Recommendations list asking for things already shipped (PWA, i18n, favicon, .gitignore).
3. **Two event-listener leaks.** `updateFilterTags` (`app.js:887`) and `showAutocomplete` (`app.js:954`) call `addEventListener` on a persistent container every time they run, with no bind-once guard — even though that exact guard already exists for dropdowns (`app.js:669`, `container.dataset.wired`). Handlers accumulate on every keystroke / filter change.

---

## 1. Code (`app.js`, `sw.js`, `index.html`, `styles.css`)

### GOOD — keep

- **Clean, layered startup.** `initializeApp()` (`app.js:1475`) sequences config → i18n → data → state → DOM → render with a single try/catch that renders a real error state (`app.js:1521-1534`). Failure is loud and user-visible, not silent.
- **Config + category registry are the backbone.** `DEFAULT_CONFIG` (`app.js:48`) is shallow-merged over `config.json` (`loadConfig`, `app.js:81`) so a missing/partial file can't break the app. The category registry (`app.js:67-71`) drives dropdown population, labels, and CSS colors from one place (`categoryByDomKey` `app.js:263`, `applyCategoryColors` `app.js:147`).
- **i18n fallback chain is correct and safe.** `t()` (`app.js:258`), `term()` (`app.js:268`), `verseTranslation()` (`app.js:277`) all fall back locale → default → raw value, so a partial locale can never blank the UI. Canonical `data-value` is preserved on tags/checkboxes while only the *label* is localized (`populateDropdown` `app.js:648-660`, `createTags` `app.js:1154-1156`) — filtering keeps matching after a language switch.
- **XSS discipline.** `escapeHtml` (`app.js:528`) is applied consistently to every interpolated value across `createTags`, `populateDropdown`, `updateFilterTags`, `showAutocomplete`. The SVG glyph generators build only from trusted verse data, correctly documented as such (`app.js:1176-1178`).
- **Service worker is genuinely hardened.** Network-first for navigations, cache-first for assets, `Promise.allSettled` precache so one missing asset can't abort an update (`sw.js:33-42`), old-cache cleanup on activate (`sw.js:44-51`). This is the right shape for a Pages PWA.
- **Bind-once guard done right for dropdowns.** `populateDropdown` re-runs on locale change but guards its container listeners with `container.dataset.wired` (`app.js:669`) — the correct pattern. (See the WEAK note: it just wasn't applied in two sibling spots.)
- **Accessibility basics are present.** `aria-expanded` maintained on dropdowns (`app.js:703-712`), Escape closes dropdowns and clears search (`app.js:1360-1367`, `1403-1407`), `.sr-only` help text and labels in markup, focusable verse articles (`index.html:1298` `tabindex="0"`), `aria-live="polite"` on the active-filters band (`index.html:185`). CSS backs this with `:focus-visible` outlines, `prefers-contrast: high`, `prefers-reduced-motion: reduce`, and print styles (`styles.css:1181-1233`).

### WEAK — concrete issues

- **[P1] Broken translation search — stale field name.** `app.js:1007`:
  `[verse.translation, verse.deities.join(' '), ...]` — `verse.translation` no longer exists (renamed to the `translations` map in `#25`). `Array.join` coerces the `undefined` to empty, so there is no crash, but the translation prose is silently unsearchable. Regression introduced by the i18n rename. Also note the search compares against canonical tokens (e.g. `Tara`, `East`), not the displayed IAST/localized labels, so typing `Tārā` won't match — secondary, but worth deciding on.
- **[P2] Event-listener accumulation (two sites).**
  - `updateFilterTags` (`app.js:887`) attaches a `click` handler to `DOMElements.activeFilters` every time it runs (every filter add/remove/clear/locale-switch). The container persists across `innerHTML` swaps, so handlers pile up.
  - `showAutocomplete` (`app.js:954`) attaches a `click` handler to the autocomplete dropdown on *every* rendered keystroke.
  The bugs are currently masked because the actions are idempotent (removing an already-removed tag / adding an already-added filter are no-ops), but this is the same class the code already solved for dropdowns with `dataset.wired` (`app.js:669`). Apply the same guard, or bind these once at init via delegation.
- **[P2] Autocomplete has no keyboard path.** The dropdown is `role="listbox"` (`index.html:92`) but items are rendered without `role="option"`, there is no `aria-activedescendant`, and no Arrow/Enter handling — selection is mouse/tap only. Dropdown checkboxes likewise sit in a `role="listbox"` (`index.html:149`) without `role="option"` on the items. Screen-reader/keyboard users can't drive suggestions.
- **[P3] Residual `body`↔`bodyParts` string-munging.** `handleFilterChange` (`app.js:769-770`), `addFilterTag` (`app.js:795-796`), and `removeFilterTag` (`app.js:815-816`) still hand-derive the state key by capitalizing a munged type string — the very munging the CHANGELOG (`CHANGELOG.md:32`) says was "removed" via the registry. The registry (`categoryByDomKey` + `stateKey`) already provides this; these three functions were not migrated. Harmless but contradicts the changelog and re-introduces the mapping the refactor meant to delete.
- **[P3] Positional DOM↔data coupling.** `applyFiltersAndHighlights` maps `.verse` elements to `VERSE_DATA[index]` by position (`app.js:993-994`). It works only because verses render in order and hidden verses stay in the DOM (`display:none`). Fragile if rendering ever filters the DOM set; a `data-index`/`id` lookup would decouple it.
- **[P3] Stale debug export.** `window.DMVKavacham.VERSE_DATA` (`app.js:1559`) captures the empty array reference at load; `loadVerseData` reassigns `VERSE_DATA` (`app.js:38`), so the exported handle stays `[]`. The `version` field has the same load-time-capture issue but is patched later in `applyConfig` (`app.js:131`); `VERSE_DATA` is not. Minor, debug-only.
- **[P3] `createVerseHTML` uses `<br>` inside translated prose** via `formatTextForHTML` (`app.js:1165-1171`) — fine for the Sanskrit/IAST, but the translation strings are single-line prose, so the daṇḍa-nbsp substitution there is a harmless no-op. Not a defect; noting only that the helper is applied uniformly.
- **[P3] `createTags` JSDoc drift.** The doc block (`app.js:1145-1149`) documents `(items, type)` but the signature is `(items, type, field)` — the `field` param is undocumented.

### Dead code / smells
No genuinely dead functions found. `getElementById` (`app.js:497`) shadows the native with a warn-wrapper — intentional and used. `LOCALE_NAMES` (`app.js:213`) duplicates the `nativeName` already in each `i18n/*.json`, a minor second source of truth for language display names.

---

## 2. Docs (README, CHANGELOG, CLAUDE.md, comments)

### GOOD — keep
- **CLAUDE.md is current and load-bearing.** The per-turn issue-tag protocol and the `#30` deploy/stamp protocol (`CLAUDE.md:25-42`) match reality (`tools/stamp-version.py`, the `index.html:220-221` build stamp).
- **CHANGELOG 2.1.0 is accurate and well-organized** (`CHANGELOG.md:8-44`) — the i18n, readability, design, and architecture buckets map to what shipped.
- **Inline comments are a strength.** Issue-referenced (`#8/#17/#23/#25`), explain *why* not just *what* (e.g. the pin-means-slim rationale `app.js:558-569`, the bind-once note `app.js:667-669`, the daṇḍa-nbsp reason `app.js:1166-1167`). `sw.js` header (`sw.js:1-13`) accurately describes the strategy.

### WEAK — concrete issues
- **[P1/P2] README is half-fresh, half-frozen and contradicts itself.** The top (features/i18n/PWA) is current; the bottom is an old embedded audit that is now wrong:
  - **Wrong metrics:** "app.js (1,264 lines)" / "styles.css (1,090 lines)" / "index.html (204 lines)" (`README.md:133,141,149`) vs actual 1596 / 1257 / 231. The File-Structure block even lists `app.js` and `styles.css` **twice** with conflicting descriptions (`README.md:224-227`).
  - **Wrong/rotted line references:** `app.js:191-292`, `app.js:31-158` (VERSE_DATA "array to extend"), `app.js:303-337`, `app.js:380-389`, `app.js:363-373`, `app.js:724-735` (`README.md:130-273`) — none map to current code. `VERSE_DATA` is fetched, not an editable inline array.
  - **Non-existent construct:** references a `UI` object "handling DOM interactions" (`README.md:65`) — there is no `UI` object in `app.js`.
  - **Stale schema:** "translation: English prose translation" (`README.md:58`) — now `translations` locale map.
  - **False tech claim:** "Pure Vanilla JavaScript (ES5-compatible)" (`README.md:256`). `app.js` uses arrow functions, template literals, spread, `const`/`let`, `async/await`, `Array.from` — ES2017, not ES5.
  - **Stale design copy:** "Glassmorphism Design", "teal (directions)" (`README.md:68-71`) — the theme is "Manuscript at Dusk" and the direction color is blue `#7d9bd0`.
  - **Contradicts shipped state:** the Recommendations block (`README.md:197-215`) asks to "Add .gitignore" (exists), "Add favicon" (exists), "Implement PWA / offline via service workers" (shipped), "Consider i18n for non-English" (shipped). And it embeds transient session state — "on rearchitecture branch, modified files not committed" (`README.md:186-196`) — which does not belong in a README.
  - **Draft vs accepted mismatch:** README says Nepali/Spanish are "unreviewed drafts (`status: draft`)" (`README.md:24`) but the files declare `"status": "accepted"` (`i18n/ne.json:6`, `i18n/es.json:6`).
- **[P2] CHANGELOG minor staleness.** "removed the `body`↔`bodyParts` munging" (`CHANGELOG.md:32`) is only partially true (see Code P3). The 2.1.0 note calls ne/es an "unreviewed draft (`status: draft`)" (`CHANGELOG.md:15`) — now accepted.

---

## 3. Reference & data files (`data/verses.json`, `data/canonical-source.md`, `config.json`, `i18n/*`)

### GOOD — keep
- **i18n key parity is excellent.** en/ne/es carry an identical set of 24 `ui` keys and identical `terms` key sets (41 deities, 11 directions, 28 body parts) — verified by read. Only the *values* differ; no missing keys, no orphans. Nepali uses Devanāgarī deity forms; Spanish keeps IAST proper nouns — a deliberate, documented choice (`i18n/es.json:7`).
- **`data/verses.json` is schema-disciplined** and passes its own guard: sequential `number` 1–14, `metadata.totalVerses` = 14, `translations` a locale map with `en` always present, canonical array fields. Every deity/direction/body value used in a verse has a matching glossary key across all three locales.
- **`validate-data.js` is a real guard** (`tests/validate-data.js`): checks verse shape, sequential numbering, the required default-locale translation, config category required-keys, and locale-file presence — and correctly treats missing draft translations as an informational *gap*, not a failure (`tests/validate-data.js:67-68,107-116`). No dependencies, plain Node.
- **`canonical-source.md` is exemplary provenance.** Two verbatim-agreeing witnesses, a three-edition third-party cross-check, an explicit authority rule (Devanāgarī > IAST), and per-spot reconciliation notes tied to `#28`. This is the gold standard for a sacred-text data source.
- **`config.json` mirrors `DEFAULT_CONFIG` exactly**, so the fallback path is faithful.

### WEAK — concrete issues
- **[P2] Verse-6 "Nīla/Nila" inconsistency across files.** `data/verses.json` verse 6 writes निल / `nilasarasvatī` — short *i* — in both Sanskrit and IAST (`data/verses.json:98-99`), which matches the editions per `canonical-source.md:105-110`. But the glossary term maps display the long form: `"Nilasarasvati": "Nīlasarasvatī"` / `"नीलसरस्वती"` in all three locales (`i18n/en.json:61`, `ne.json:62`, `es.json:61`). So the verse text (short *i*) and the displayed tag/label (long *ī*) disagree. Additionally, `canonical-source.md:108` narrates the app as *still* carrying नील (long) — so the doc's prose is slightly behind the reconciled verse data. Pick one form and align verse text, glossary, and the doc note.
- **[P3] Verse-10 body tags not fully text-corroborated.** `bodyParts` includes `"Knees"` and `"Legs"` (`data/verses.json:167`) but the verse text names jaṅghā (shanks) + ūru (thighs) then guda/muṣka/meḍhra/nābhi — no distinct knee/leg term. These read as editorial inferences rather than text-anchored tags. Low stakes (they only affect filter/glyph coverage), but inconsistent with the otherwise tight text-to-tag mapping.
- **[P3] Two version axes, no cross-file guard.** `verses.json` `metadata.version` is `"1.0"` (a data-schema version) while the app is `2.1.0` — legitimate as separate axes, but nothing documents or checks the relationship. (App-version unification is the known-deferred `#9`.)
- **[P3] `validate-data.js` doesn't assert i18n key parity.** It checks each locale has `ui`/`terms` objects (`tests/validate-data.js:101-104`) but not that ne/es cover the same keys as `en`, nor that every verse `deities/directions/bodyParts` value has a glossary entry. Parity is currently correct by hand; a check would keep it that way. (Broader test coverage is the known-deferred `#11`.)

---

## 4. Repo organization / structure

### GOOD — keep
- **Layout is clean and conventional.** Root holds the app shell; `data/`, `i18n/`, `fonts/`, `icons/`, `tools/`, `tests/`, `reports/` each hold exactly what their name says. Nothing is misfiled.
- **`reports/` is a well-kept, dated audit trail** with a `reports/assets/` subdir for boards — this new report drops in cleanly.
- **`tools/` is sensible:** `stamp-version.py` (deploy stamp, `#30`) and `tools/i18n/` (review-board generator). `.github/ISSUE_TEMPLATE/translation-correction.yml` matches the `feedbackUrl` wired in `config.json:9`.
- **Naming is consistent** (kebab-case files, clear IDs), and the CSS is sectioned with 19 labeled headers (`styles.css`) mirroring the JS section banners.

### WEAK — concrete issues
- **[P3] No `LICENSE` file.** MIT is declared in the `app.js:11` header and the `index.html:9` banner, but there is no top-level `LICENSE`. For a public educational repo, add one so the declared license is enforceable/attributable.
- **[P3] `index.html:7` banner still says "Version: 2.0.0"** while every other surface says 2.1.0 (`app.js:9`, `index.html:33`, `config.json:6`). A stale straggler that the single-version-number effort (`#9`) should sweep up.
- **[P3] README File-Structure block is the only genuinely confusing doc artifact** (duplicate entries, stale counts) — a repo-map defect that lives in the docs, addressed by the §2 P1/P2 README fix.

---

## Prioritized Recommendations

| # | Pri | Area | Action | Evidence |
|---|-----|------|--------|----------|
| 1 | **P1** | Code | Fix translation search: read from the localized `verseTranslation(verse)` (or `verse.translations`), not `verse.translation`. **Add a regression test** asserting a translation-only substring returns its verse. | `app.js:1007` |
| 2 | **P1/P2** | Docs | Rewrite README: delete the embedded stale audit (lines ~118–275), fix line counts/refs, drop the false "ES5-compatible" and "UI object" claims, fix "glassmorphism/teal", align draft→accepted, and de-duplicate the File-Structure block. | `README.md:58,65,118-275` |
| 3 | **P2** | Code | Apply the existing `dataset.wired` bind-once guard (or init-time delegation) to `updateFilterTags` and `showAutocomplete`. | `app.js:887,954` vs `669` |
| 4 | **P2** | Code | Add keyboard + `role="option"`/`aria-activedescendant` support to the autocomplete (and `role="option"` to dropdown items). | `index.html:92,149`; `app.js:940-968` |
| 5 | **P2** | Data | Resolve the verse-6 Nīla/Nila form across `verses.json`, the glossary term maps, and the `canonical-source.md` note. | `verses.json:98-99`; `i18n/*:~61`; `canonical-source.md:108` |
| 6 | **P3** | Code | Migrate `handleFilterChange`/`addFilterTag`/`removeFilterTag` to the registry `stateKey` and finish removing the `body`↔`bodyParts` munging (as the changelog claims). | `app.js:769-770,795-796,815-816` |
| 7 | **P3** | Test | Extend `validate-data.js` to assert i18n key parity vs `en` and verse-value→glossary coverage. | `tests/validate-data.js:101-104` |
| 8 | **P3** | Repo | Add `LICENSE`; fix the `index.html:7` "2.0.0" banner (folds into `#9`); fix `createTags` JSDoc; refresh the stale debug `VERSE_DATA` export. | `index.html:7`; `app.js:1145,1559` |

### Known-deferred (not counted against the grade)
- **ES-module split** — `#10`, deferred on purpose. `app.js` at 1596 lines in one file is acceptable for a no-build app; the internal section structure is clear.
- **Single version number** — `#9`. Recommendation 8 (the `index.html:7` banner) is the same theme.
- **Test coverage** — `#11`, partial. The data guard exists; no JS unit tests yet. Recommendations 1 and 7 add the two highest-value tests (a real regression guard + a parity guard).
