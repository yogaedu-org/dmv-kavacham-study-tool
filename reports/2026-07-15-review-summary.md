# Deep-Pass Review — Executive Summary
**Repo:** dmv-kavacham-study-tool · **Branch:** rearchitecture · **Date:** 2026-07-15
**Mode:** PROPOSE-ONLY — no application files were changed. Every item is a proposal gated on your approval.
**Tracking epic:** [#2](https://github.com/yogaedu-org/dmv-kavacham-study-tool/issues/2)

This is the index for three companion reports in this folder:
- `2026-07-15-architecture-config-maintainability.md`
- `2026-07-15-responsive-pwa-design.md`
- `2026-07-15-text-corroboration.md`

---

## What was reviewed
Against your five asks: (1) web-app compliance & maintainability, (2) modular
extraction & the intended direction + gaps, (3) config-file-driven configurability,
(4) small-screen + PWA readiness (the readability complaint), (5) design/aesthetic
proposals — plus (6) online corroboration of the Sanskrit text.

## The intention, as I read it
The `rearchitecture` branch set out to convert a 1,419-line single-file app into a
maintainable multi-file structure (HTML / CSS / JS / JSON) with tokenized CSS and a
clean state layer. **That direction is sound and ~70% done.** The gaps are all in the
"finish the job" category, not "start over."

## The four things that matter most (in order)

1. **Finish the data split (one source of truth).** The verses live in three copies and
   have already drifted. → [#6](https://github.com/yogaedu-org/dmv-kavacham-study-tool/issues/6)
2. **Deploy what you built.** The public demo still serves the legacy monolith. →
   [#7](https://github.com/yogaedu-org/dmv-kavacham-study-tool/issues/7)
3. **Fix small-screen readability at the root:** load a real Devanāgarī webfont, then
   make type *grow* on mobile instead of shrinking. → [#13](https://github.com/yogaedu-org/dmv-kavacham-study-tool/issues/13), [#14](https://github.com/yogaedu-org/dmv-kavacham-study-tool/issues/14)
4. **Add the config layer you asked for**, with a category registry that removes the
   hardcoded 3-layer coupling. → [#12](https://github.com/yogaedu-org/dmv-kavacham-study-tool/issues/12), [#8](https://github.com/yogaedu-org/dmv-kavacham-study-tool/issues/8)

## Text corroboration — verdict
**Broadly and strongly corroborated** against Sanskrit Documents (gold standard) and
Devshoppe, in the standard 14-verse count and order. Only **4 confirmed small fixes**
(3 transliteration/orthography + 1 metadata typo); several other differences are
**legitimate recension variants that must NOT be "fixed."** One caveat: the *Toḍala
Tantra* provenance is widely repeated but could not be independently confirmed here.
→ [#3](https://github.com/yogaedu-org/dmv-kavacham-study-tool/issues/3), [#4](https://github.com/yogaedu-org/dmv-kavacham-study-tool/issues/4), [#5](https://github.com/yogaedu-org/dmv-kavacham-study-tool/issues/5)

---

## Prioritized backlog (P1 → P3)

### P1 — do first
| Issue | Title |
|---|---|
| [#6](https://github.com/yogaedu-org/dmv-kavacham-study-tool/issues/6)  | De-duplicate verse data → single source of truth |
| [#7](https://github.com/yogaedu-org/dmv-kavacham-study-tool/issues/7)  | Ship rearchitecture as live demo; retire monolith |
| [#13](https://github.com/yogaedu-org/dmv-kavacham-study-tool/issues/13) | Load & declare a Devanāgarī webfont (readability root cause) |
| [#14](https://github.com/yogaedu-org/dmv-kavacham-study-tool/issues/14) | Fluid `clamp()` type scale — grow Sanskrit on mobile |

### P2 — soon
| Issue | Title |
|---|---|
| [#12](https://github.com/yogaedu-org/dmv-kavacham-study-tool/issues/12) | Introduce `config.json` app/feature/display layer |
| [#8](https://github.com/yogaedu-org/dmv-kavacham-study-tool/issues/8)  | Config-driven category registry |
| [#3](https://github.com/yogaedu-org/dmv-kavacham-study-tool/issues/3)  | Verse text corrections — 4 confirmed |
| [#9](https://github.com/yogaedu-org/dmv-kavacham-study-tool/issues/9)  | Single authoritative version number |
| [#10](https://github.com/yogaedu-org/dmv-kavacham-study-tool/issues/10) | Split app.js into ES modules |
| [#11](https://github.com/yogaedu-org/dmv-kavacham-study-tool/issues/11) | Targeted tests: schema + drift guard + characterization |
| [#15](https://github.com/yogaedu-org/dmv-kavacham-study-tool/issues/15) | PWA shell — manifest + service worker + icons |
| [#16](https://github.com/yogaedu-org/dmv-kavacham-study-tool/issues/16) | Small-screen audit — tap targets, px→rem, overflow |

### P3 — nice-to-have / decisions
| Issue | Title |
|---|---|
| [#5](https://github.com/yogaedu-org/dmv-kavacham-study-tool/issues/5)  | Verses 2 & 3 missing line-break (cosmetic) |
| [#4](https://github.com/yogaedu-org/dmv-kavacham-study-tool/issues/4)  | Editorial variant decisions — do-NOT-fix log |
| [#17](https://github.com/yogaedu-org/dmv-kavacham-study-tool/issues/17) | Design direction — "Manuscript at Dusk" (optional) |

---

## Suggested sequencing (if you act on it later — separate approved pass)
1. **Data & deploy foundation:** #6 → #7 (removes the drift risk and ships the split).
2. **Readability quick wins:** #13 → #14 (directly answers the user complaint; low effort, high impact).
3. **Config + registry:** #12 → #8 (unlocks "highly configurable"; #9 folds in).
4. **PWA + module split:** #15 + #10 (pair the `file://` decision with #6).
5. **Text corrections + tests:** #3 under #11's schema guard.
6. **Optional identity:** #17.

Nothing here has been applied. Recommend confirming scope/priority before any
implementation pass; text corrections (#3) should get your scholarly sign-off first.
