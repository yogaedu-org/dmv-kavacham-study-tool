# Design references (#22)

AI-generated **reference** images for the per-verse body-part glyph — not shipped assets.
The shipped glyph is a hand-authored inline SVG in `js/render.js` (`standingFigureSVG` /
`lotusFigureSVG`), traced from these for proportions/style so it stays tiny, theme-aware,
and per-region highlightable.

- `body-figure-ref.jpg` — single manuscript figure (Prompt A)
- `body-sprite-ref.jpg` — 12-cell sprite sheet, one body zone lit per cell (Prompt B)

Provider: **1min.ai → Gemini 3 Pro Image Preview** (`gemini-3-pro-image-preview`).
Cost measured live via `aiRecord.teamUser.usedCredit`: Prompt A ≈ 60k credits, Prompt B
≈ 407k. The sprite sheet has one imperfect cell (an arm + opposite hand both lit) — left
as-is since the raster is only a reference. Downscaled to ~1200px for the repo.
