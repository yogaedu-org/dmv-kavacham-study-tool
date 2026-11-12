# Follow-along (karaoke) analysis: what transfers from the Sundarkand viewer (#61)

Written 2026-11-12 from the builder's findings. Source read: `kaanchan/sundarkand-viewer`, `site/js/player.js` (read-only).

## How the Sundarkand viewer does it

- Granularity is one line. Cues are `[unit, pass, start, end, flag]`.
- `cueAt` does a binary search; `sync()` toggles `is-playing` on the line's rows.
- It runs on `timeupdate` (about 4 Hz) plus a requestAnimationFrame loop (sundarkand-viewer#51).
- Seek calls `sync` at once. Pause keeps the highlight. Playback rate is irrelevant because it reads media time.
- Scroll uses a calm zone with an eased 240 ms glide, instant under reduced motion, and `stopFollow` on any reader scroll.
- On `loadedmetadata` it checks the clip duration (within 3 s).
- Only the test names in `check_player_features.py` were skimmed, not the tests themselves.

## What was reused

The rAF loop, the binary-search lookup, the reduced-motion handling, the "leave a scrolling reader alone" rule, the duration guard and the repeated-line `pass` field.

## What changed for the study tool

- There are no row elements, so aksharas are wrapped lazily at play start and the markup is restored on stop.
- Cues are per akshara and never split a conjunct.
- The highlight clears on pause, stop and end.
- The akshara gets a tint, an underline and ink colour; the word gets a tint; there is no weight change.
- Scroll happens only when the lit akshara is off-screen.
- Timings come from the manifest's `timings` path, then the bundled copy, then none (plays without highlighting).
- This app has no word-by-word or padaccheda layer yet (#36), so there is nothing to highlight at that level.

## Data gap

- Verse 14's closing line repeats 3 times; the #55 analysis smeared it over 18 s, so it was re-aligned.
- Re-alignment posteriors for 1/2/3/4 repeats were 0.469 / 0.469 / 0.470 / 0.372; 3 was chosen from the passes' matching rhythm and the clip ending. Hypothesis until KA listens.
- CTC ends are peaky, so the app holds an akshara until the next one starts, at most 0.6 s past its own end.
- Text differences between the #55 analysis and the displayed text were matched by position in verses 2, 4, 8, 10 and 11 (verse 11 `दीन्` merged from two analysed aksharas). Open question for KA: verse 4 `ऊ` (analysis had `उ`) and verse 11 `दीन्` (analysis had `दीन`).
- The alignment is not ear-checked. Measured sync is highlight against `timings.json` (worst lag 19 ms on verse 1, 21 ms on verse 14), not against the voice.
