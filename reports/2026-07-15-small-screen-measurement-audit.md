# Small-Screen Measurement Audit (rendered evidence)
**Repo:** dmv-kavacham-study-tool · **Branch:** rearchitecture · **Date:** 2026-07-15
**Method:** app served locally, driven with Playwright at 320 / 390 px, computed styles + tap-target
rects measured on the live DOM. Turns issue #16 hypotheses into hard numbers.
**Screenshots (first fold):** `reports/assets/viewport-320px.jpeg`, `reports/assets/viewport-390px.jpeg`

---

## Measured values (worst-case widths)

| Element | 390 px | 320 px | WCAG/HIG target | Verdict |
|---|---|---|---|---|
| `.sanskrit` (Devanāgarī) | **19.2 px**, computed family "Georgia" | **19.2 px** | Devanagari wants ≥ ~22–24px on phones | ⚠️ small + wrong font |
| `.transliteration` | 17.6 px | 17.6 px | — | OK |
| `.translation` | 17.6 px | 17.6 px | ≥16px | OK |
| `.verse-number` (badge) | 40×40 px | — | 44×44 min touch | ⚠️ borderline |
| `.search-input` | h **47 px** | — | 44 min | OK |
| `.dropdown-button` | h **33 px** | h 33 px | 44 min | ❌ under |
| `.clear-btn` | h **33 px** | h 33 px | 44 min | ❌ under |
| `.compact-toggle` ⚙️ | **32×32 px** | 32×32 | 44 min | ❌ under |
| `.pin-toggle` 📌 | **32×32 px** | 32×32 | 44 min | ❌ under |
| `.checkbox-group input` | **18×18 px** | 18×18 | 44 min | ❌ well under |
| `.tag` (non-interactive) | h 30 px | h 30 px | n/a | OK |
| Horizontal overflow @320 | — | **none** (scrollWidth = clientWidth = 305) | — | ✅ clean |

Base document font: 16px. `bodyClasses` = `show-sanskrit show-transliteration` (both visible).

---

## What the numbers confirm

1. **The Devanāgarī font problem is real and measurable (#13).** Computed `font-family`
   resolves to **"Georgia"** for `.sanskrit` — a face with **no Devanagari glyphs** — so
   the actual script is drawn by a silent OS substitute. The app has no control over the
   Sanskrit letterforms today. This is the primary readability defect, now confirmed on
   a rendered page, not just from the CSS.

2. **Sanskrit doesn't shrink *below* 480px — but it's stuck small.** It holds at 19.2px
   (1.2rem) from 480px down to 320px. The problem isn't runaway shrinking; it's that
   19.2px in a thin fallback face is **too small for conjunct-heavy Devanāgarī** on a
   phone. The fix (#14) should push the Sanskrit floor *up* to ~22–24px, not merely
   stop it shrinking.

3. **Tap targets fail across the control row (#16).** Every interactive control except
   the search box is **under the 44×44px minimum**: dropdowns and Clear at 33px tall,
   the ⚙️/📌 toggles at 32×32, and the checkboxes at a tiny 18×18. On a phone these are
   hard to hit accurately.

4. **No horizontal overflow at 320px (#M3 / #16).** The `overflow-x:hidden` on `body`
   is not masking a layout bug at 320px — content genuinely fits (305/305). This
   de-prioritizes the overflow concern; the clip can stay for now.

## Recommended concrete numbers (feeds #14 / #16 fixes — not applied)
- `.sanskrit`: `clamp(1.4rem, 1.15rem + 2vw, 1.9rem)` → floor **≈22.4px**, up from 19.2.
- Interactive controls: `min-height: 44px; min-width: 44px;` on `.dropdown-button`,
  `.clear-btn`, `.compact-toggle`, `.pin-toggle`; enlarge the checkbox hit-area
  (wrap label+input as a 44px-tall clickable row, or `transform: scale(1.4)` + padding).
- Keep the base at 16px but move fixed-px control sizes to `rem`.

_All measured read-only. Nothing in the app was changed._
