# Small-Screen Readability, PWA Readiness & Design Direction
**Repo:** dmv-kavacham-study-tool · **Branch:** rearchitecture · **Date:** 2026-07-15
**Mode:** PROPOSE-ONLY — nothing changed. Proposals gated on your approval.
**Motivating feedback:** *"fonts weren't readable on small screens."*

---

## Part 1 — Why the fonts are hard to read on small screens (root causes)

This is not one bug; it's four compounding causes. The first is the biggest and the
least obvious.

### R1 — No Devanāgarī webfont is loaded; Sanskrit renders in an OS fallback · HIGH · CONFIRMED
[styles.css:32](styles.css#L32) sets the primary family to `'Georgia', serif`. **Georgia
contains no Devanāgarī glyphs**, so every `.sanskrit` line ([styles.css:473](styles.css#L473),
`font-family` inherited) is drawn by whatever the device silently substitutes:
- Windows → *Nirmala UI* (thin at small sizes)
- Android → *Noto Sans Devanagari* or an OEM face (varies by vendor)
- iOS → *Devanagari Sangam MN*

So the same verse looks different — and often thin/cramped — on every phone, entirely
outside the app's control. **This is the primary readability defect.**

**Proposed:** load a real Devanāgarī face and declare it explicitly for Sanskrit:
- **Noto Serif Devanagari** (matches the Georgia serif register; excellent conjunct
  rendering) for `.sanskrit`, or **Noto Sans Devanagari** for a cleaner screen look.
- Self-host the woff2 (offline-friendly, no third-party request, PWA-cacheable) rather
  than a CDN link. Declare: `.sanskrit { font-family: 'Noto Serif Devanagari', serif; }`
  and add the face to `:root --font-family-devanagari`.
- Pair with a Latin/IAST face that renders combining diacritics well (Georgia already
  does; keep it for translation/translit).

### R2 — Type shrinks on small screens instead of holding or growing · HIGH · CONFIRMED
Devanāgarī needs *more* size on a phone, not less. Today:
- `.sanskrit` drops from `1.4rem` to `1.2rem` at ≤768px ([styles.css:931-933](styles.css#L931-L933))
  with **no floor** below that.
- Controls fall to `13px` and `11px` at ≤480px ([styles.css:993](styles.css#L993),
  [styles.css:998](styles.css#L998)) — below comfortable reading size.
- Dozens of fixed-`px` sizes throughout (`12px`, `14px`) ignore the user's browser
  font-size preference.

### R3 — No fluid typography; two hard breakpoints only · MED · CONFIRMED
All sizing is stepped at 768/480. Between and below those, text doesn't adapt.
**Proposed fluid scale using `clamp()`** (grows with viewport, never below a legible
floor, Sanskrit floor set *higher* than Latin):
```css
:root {
  --fs-sanskrit:  clamp(1.35rem, 1.1rem + 2.2vw, 1.9rem); /* floor ≈ 21.6px */
  --fs-translit:  clamp(1.05rem, 0.95rem + 1.2vw, 1.3rem);
  --fs-translation: clamp(1rem, 0.95rem + 0.8vw, 1.15rem);
  --fs-control:   clamp(0.9rem, 0.85rem + 0.4vw, 1rem);   /* floor 14.4px, never 11px */
}
.sanskrit { font-size: var(--fs-sanskrit); line-height: 1.9; } /* generous for conjuncts */
```

### R4 — Tap targets and base sizing below mobile minimums · MED · HYPOTHESIS (verify by measuring)
Compact controls at `6px` padding + `11px` font ([styles.css:997-999](styles.css#L997-L999))
are likely under the 44×44px minimum (WCAG 2.5.5 / Apple HIG). The `html` base is a
fixed `16px` ([styles.css:34](styles.css#L34), [styles.css:77](styles.css#L77)); moving
descendants to `rem` restores respect for user zoom/preference. **Recommend a real
measurement pass** (Playwright at 320/360/390px widths) before finalizing numbers —
findings above are correct in direction; exact px should be measured, not asserted.

### R5 — Color contrast on the dark theme — verify · LOW · HYPOTHESIS
Sanskrit gold `#ffbe0b` on the navy background is comfortably above 4.5:1, but
transliteration orange `#fb8500` ([styles.css:26](styles.css#L26)) on the translucent
navy is borderline. Run a contrast check at the actual composited background before
sign-off rather than assuming pass/fail.

**Verification note:** R1–R3 are structural and confirmed from the CSS. R4–R5 are
directionally correct but their exact thresholds should be *measured* on a rendered
page (a small-screen audit pass) before being turned into fixes — flagged HYPOTHESIS
per the review discipline.

---

## Part 2 — Progressive Web App readiness

Current state: **not a PWA.** Lighthouse "Installable" would fail. Missing:

| PWA requirement | Status | File |
|---|---|---|
| Web app manifest | ❌ absent | — |
| Service worker / offline | ❌ absent | — |
| App icons (192/512, maskable) | ❌ absent | favicon commented out [index.html:48](index.html#L48) |
| `theme-color` meta | ❌ absent | [index.html:27-33](index.html#L27-L33) |
| `apple-mobile-web-app-*` metas | ❌ absent | — |
| HTTPS + served | ✅ (GitHub Pages) | — |
| Responsive viewport | ✅ present | [index.html:29](index.html#L29) |

**Why PWA matters for *this* app specifically:** it's a devotional recitation aid —
used during practice, often offline or on poor signal, ideally launched from the home
screen like an app. Offline caching also neutralizes the `file://` fallback problem
(report A1): once the service worker has cached `verses.json`, the embedded fallback is
no longer needed.

**Proposed PWA shell (P1):**
1. `manifest.webmanifest` — `name`, `short_name` ("Kavacam"), `display: standalone`,
   `start_url: "./"`, `theme_color`, `background_color`, and 192/512 + maskable icons
   derived from a yantra glyph.
2. `sw.js` — **cache-first** service worker precaching the app shell (`index.html`,
   `app.js`/modules, `styles.css`, `data/verses.json`, the Devanāgarī woff2). Small,
   dependency-free. Register only when served over https.
3. Head metas: `theme-color`, `apple-mobile-web-app-capable`,
   `apple-mobile-web-app-status-bar-style`, `apple-touch-icon`.
4. Real favicon (retire the commented-out placeholder).

---

## Part 3 — Design direction (frontend-design)

> The current look — dark navy glassmorphism with acid teal/coral/orange accents — is
> one of the common "AI-default" palettes (near-black + bright accents) and doesn't
> speak the subject's own visual language. Below is a grounded alternative. This is a
> **proposal**; the readability fixes (Part 1) are the priority regardless of whether
> the identity changes.

**Subject, pinned:** a Sanskrit *kavacam* — a spoken suit of armor that maps ten wisdom
goddesses first onto the **ten directions** (8 compass + above + all-around) and then
**head-to-toe onto the body**. Audience: practitioners and students memorizing/reciting.
The page's one job: make each verse legible, locatable (which direction / which body
part), and recitable.

### Direction: "Manuscript at Dusk — the armor as a body-map"

**Palette (4–6 named hex):**
```
--ink-night     #14121C  /* deep aubergine-black, warmer than the current navy */
--ash           #2A2733  /* card surface, like palm-leaf shadow */
--goldleaf      #E4B25A  /* aged gold — Sanskrit text (not the neon #ffbe0b) */
--kumkum        #C6413A  /* vermilion — deities / verse index (sacred red, muted) */
--indigo-cool   #6C8CBF  /* directions — a calm cool that reads as "space/orientation" */
--sandal        #C9A886  /* body parts — warm sandalwood neutral */
```
Warm, earthen, manuscript-derived — distinct from the neon-on-navy default, and each
category color now *means* something (red=deity/sacred, cool=direction/space,
sandal=body).

**Typography (roles):**
- *Display* (title): a Devanāgarī serif with presence — **Noto Serif Devanagari** at
  heavy weight, used only for the śīrṣaka/title, tracked open.
- *Sanskrit body:* Noto Serif Devanagari regular, the fluid `--fs-sanskrit` scale, line-
  height 1.9 (R1/R3).
- *IAST + translation:* a humanist serif with clean diacritics (Georgia is acceptable;
  or "Spectral" for more character).
- *Utility/labels:* a quiet grotesk (system-ui / Inter) for controls and tags.

**Layout concept:** single reading column, verse cards as "leaves." The header is not a
big glass panel but a quiet colophon. On mobile the controls collapse to a single sticky
search + a filter sheet (bottom-sheet pattern), so the verse text owns the screen.

**Signature element (the one memorable, *earned* thing):** a small **orientation glyph**
per verse — an 8-point direction rosette that lights the quarter(s) that verse protects
(verses 1–4), morphing into a **body-silhouette marker** for the anatomical verses
(5–11). It encodes real content (this is literally what the kavacam *does*) rather than
decorating. Everything else stays quiet so this one device carries the identity.

**Mobile wireframe (≤480px):**
```
┌───────────────────────────┐
│   श्रीदशमहाविद्याकवचम्        │  ← display Devanagari, gold, fluid
│  Armor · Ten Wisdom …     │  ← subtitle, small caps sandal
├───────────────────────────┤
│ 🔍 Search…            ⚙︎   │  ← sticky, single row; filters → bottom sheet
├───────────────────────────┤
│ ⟡ ①            [E][SE][S] │  ← orientation glyph + index + direction chips
│ ॐ प्राच्यां रक्षतु मे तारा…   │  ← Sanskrit, LARGE (clamp floor ~21px)
│ oṃ prācyāṃ rakṣatu me…    │  ← IAST, italic
│ May Tārā, who dwells…     │  ← translation
├───────────────────────────┤
│ 🜨 ⑤          [head][brow] │  ← body-marker for anatomical verses
│ …                         │
└───────────────────────────┘
```

**Restraint check (Chanel's mirror):** keep the orientation glyph as the single risk;
drop glassmorphism blur, drop the hover-lift transform on touch, respect
`prefers-reduced-motion` (already present at [styles.css:1029](styles.css#L1029)).

---

## Prioritized backlog (this report)

| ID | Severity | Title | Effort |
|----|----------|-------|--------|
| R1 | HIGH | Load & declare a Devanāgarī webfont (self-hosted) | S |
| R2/R3 | HIGH | Fluid `clamp()` type scale; Sanskrit grows on mobile, floors on controls | M |
| PWA | P1 | Manifest + cache-first service worker + icons + theme metas | M |
| R4 | MED | Measure & fix tap targets / rem-ize sizing (Playwright small-screen pass) | M |
| R5 | LOW | Verify color contrast on composited dark bg | S |
| Design | P2 | Adopt "Manuscript at Dusk" identity + orientation-glyph signature | L (optional) |

**Machine-readable change set:**
```
R1:  add fonts/NotoSerifDevanagari.woff2; --font-family-devanagari; .sanskrit family
R2R3: add clamp() fluid scale vars; apply to sanskrit/translit/translation/controls
PWA: add manifest.webmanifest + sw.js (cache-first) + icons/ + head metas
R4:  small-screen audit at 320/360/390; enforce 44px targets; px→rem
R5:  contrast-check translit/deity colors on composited bg
DESIGN: (optional) new palette + Devanagari display face + orientation glyph
```
