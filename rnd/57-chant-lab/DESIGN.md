# Design plan: the chant-lab book (dmv #57)

> A small textbook with a lab, for one reader: a yoga teacher and chanter on a laptop or a phone. It explains how a machine can tell whether a verse was chanted like the reference, and lets the reader try each idea on real takes. It borrows the study tool's own look ("Manuscript at Dusk") and adds one new thing: the akshara ribbon.

## What this belongs to

The book sits beside the live study tool and must feel like the same house. It reuses, unchanged:

- the tool's tokens from `reports/assets/dusk-study-tool-prototype.html` and `styles.css` (dusk dark by default, "manuscript" light, `data-theme` plus the OS preference, same toggle behaviour);
- the bundled Devanagari face `fonts/NotoSerifDevanagari.woff2`, loaded by a relative path, no CDN;
- the tool's Latin stack (Iowan Old Style, Palatino, Georgia for reading; the system UI font for controls). The repo bundles no Latin web font, so none is added.

## Palette (named, from the tool)

Dark (dusk) / light (manuscript). Chart colours are the same names, so a chart never needs its own palette.

| Name | Dark | Light | Used for |
|---|---|---|---|
| Dusk | `#141019` | `#efe9e4` | page ground |
| Ash | `#1e1926` | `#faf6f1` | raised surfaces: the lab stage, the ribbon |
| Ink | `#ece7ef` | `#241f2b` | text |
| Goldleaf | `#e4b25a` | `#8f6221` | Devanagari, links, your take, the playhead (light value is darker than the tool's `#a9772f` so small text passes 4.5:1) |
| Indigo | `#7d9bd0` | `#3f5480` | the reference: its pitch curve and energy |
| Kumkum | `#d9615a` | `#a8352f` | differences and flags, nothing else |

Muted text (`#a99fb2` / `#635c6b`) and hairlines come from the tool unchanged. Rule: gold is "you", indigo is "the reference", kumkum is "look here". A flag is never colour alone: it also has a bar under the cell and a word.

## Type roles

| Role | Face | Size |
|---|---|---|
| Sanskrit (verse text, ribbon cells) | Noto Serif Devanagari, NFC, `line-height` 1.9 | 1.4 to 1.95 rem fluid, as in the tool |
| Reading | Iowan Old Style / Palatino / Georgia | 1.0625 rem, line-height 1.65, measure 64 characters (`max-width: 64ch`) |
| Headings | same serif, weight 600, sentence case | h1 clamp(1.9rem, 5vw, 2.6rem); h2 1.45rem |
| Controls, numbers, labels | system UI, tabular figures | 0.95 rem, 44 px minimum touch height |
| IAST under Devanagari | the reading serif, italic | 0.8 rem |

No all-caps labels, no letter-spaced small print, no eyebrows above headings.

## Layout concept

One column of reading (64ch) centred, with the interactive "stage" allowed to widen to 62rem. A slim bar at the top shows where you are; a footer on each chapter holds the try-it and previous/next. The ribbon is the only decorated thing on any page.

```
+--------------------------------------------------------------------+
| Chant lab   1  2  3  4  5  6  7 | Lab  . Sources . Glossary   (sun) |  <- where-am-I bar: current page
|             ^ current chapter filled gold, visited ones outlined    |     is filled, aria-current
+--------------------------------------------------------------------+
|                                                                    |
|   Did I chant this verse the way the reference does,               |  <- h1, 64ch column
|   and where did I drift?                                           |
|                                                                    |
|   (three-sentence answer)                                          |
|                                                                    |
| +- stage (62rem) ------------------------------------------------+|
| | [Play verse 1]  verse [1 v]  Day 2 reference     source: offline ||
| |  ॐ   प्रा  च्यां  र  क्ष  तु  मे  ता  रा  का ...                 ||  <- THE AKSHARA RIBBON
| |  oṁ  prā  cyāṁ  ra  kṣa tu  me  tā  rā  kā                       ||     cells sit along time
| |  ~~~~~~~~/\~~~~__/\/~~~~~  pitch curve over the cells  ~~~~~~~    ||     pitch + energy band
| |  ▔▔▔▔▔▔▔▔▔▔▔▔▔▔ (kumkum bar + word under a flagged cell)         ||     marks row
| | Summary in words for anyone not seeing the picture.              ||
| +------------------------------------------------------------------+|
|                                                                    |
|   Chapters: 1 What "correct" can mean  - one-line promise          |  <- plain list, not a card grid
|             2 Hearing the verse as data - ...                      |
|                                                                    |
|   Keep / Improve / Drop line under each interactive element        |
+--------------------------------------------------------------------+
| Previous: Chapter 2          Try it: Lab 1            Next: Ch 4   |
+--------------------------------------------------------------------+
```

The ribbon, in detail:

- one row per line (pada) of the verse; each row fits the stage width and scrolls sideways on a phone;
- a cell is one akshara, left edge at its measured onset; its width follows the time to the next onset, with a floor of 30 px so a Devanagari conjunct and its IAST stay readable (so the time axis is elastic where syllables are very short, and says so in the summary);
- above the cells the Devanagari, then the IAST; below, a band where the energy is a soft indigo area and the pitch is a line (reference in indigo, your take in gold), both drawn on the same elastic time axis;
- the row under the band is the marks row: a kumkum bar under any flagged cell, with a one-word label ("shorter", "held longer", "pitch higher", "heard as ś");
- during playback the playhead is a thin ink line and the current cell is tinted gold; cells already played keep a faint tint. Nothing moves otherwise;
- every cell is a button: press it to play from that akshara; arrow keys move between cells; the focus ring is the tool's `--ring`.

## Three principles

1. **One idea per page, ending in an action.** A chapter is short enough to read in a few minutes and ends with a "try it" that opens the lab at the matching tool. The lab pages never explain; they point back to the chapter.
2. **The ribbon is the only ornament; the data is the decoration.** No cards in a grid, no icons for decoration, no numbering except the chapter order, no motion except in answer to a press or tied to audio. Everything else stays quiet so the ribbon reads.
3. **Say how sure we are, in words, next to the number.** Every score carries a confidence, every chart has a text summary, and anything the reports call a hypothesis or unmeasured is called that on the page, in the same word. Errors say what happened and what to do.

## Accessibility and behaviour rules (checked by tests where marked)

- Body text 17 px, comfortable at 360 px wide; no horizontal page scroll (the ribbon scrolls inside its own box). Checked in the 390 px screenshots.
- `prefers-reduced-motion: reduce` removes the playhead smoothing and any scroll animation; playback sync stays because it is the audio itself.
- Light and dark both tested by screenshot; charts use the named colours via CSS variables, drawn from the page's computed style so a theme switch redraws them.
- Every chart and the ribbon have a text summary next to them (`data-summary`). Checked: every `canvas`/`svg` chart has one.
- Visible keyboard focus on every control.
- Error messages name the source tried ("No audio found: looked in the offline folder `local-audio/day2/verse01.mp3`") and say the next step.

## Review against the brief (done before building)

| Brief item | In this plan? | Change made |
|---|---|---|
| Build from the tool's identity, no CDN | Yes: tokens, bundled Devanagari face, system Latin stack | Added the darker light-theme gold so small gold text passes contrast |
| One memorable element: the ribbon, hero of the start page, same component everywhere | Yes, one `ribbon.js` used by every chapter and lab | Cell widths are elastic with a floor (pure time scale makes 0.1 s syllables unreadable); summary says so |
| Measure under 75 characters | 64ch | None |
| No eyebrows, no all-caps, no card grid, no arrows on links, no fade-in | None used; chapter list is a plain ordered list | Dropped the idea of icon tiles for chapters |
| Chapter numbers only decoration | Yes; numbers are the sequence in the where-am-I bar | None |
| Motion only on action or audio | Playhead only | Removed hover transitions other than focus |
| Charts readable in light and dark, text summary each | Yes | Added "summary checked by test" |
| Phone at 360 px | Ribbon scrolls inside its box; labs stack | Stage padding 16 px |
| Feedback line per element, exportable | Planned as one shared component | Placed under each interactive element, export in the footer of every page |

Revision after the first pass: the ribbon's marks row was going to sit above the cells. It moved below the pitch band so the Devanagari row stays clean and the eye goes cell, then curve, then difference, which is the order a chanter checks a verse.
