# Player + accuracy review as linked tabs (#55)

Two pages in this chant folder, one tab bar, links both ways:

| page | what it is |
|---|---|
| `../player.html` | listen to each day's take, verse by verse; per verse a badge (clean / N findings, confidence) and "See the accuracy review for this verse" |
| `../review.html` | the automatic accuracy review (which day to use per verse, where the slips are, KA's Right/Wrong/Unsure marks); per finding "Open in player" |

Method and numbers: `METHOD.md` (this folder). The review is a lead to listen to, not a verdict.

## Files, and which are generated

| file | generated? | from what |
|---|---|---|
| `../chant.json` | no (edited by hand) | the ONE config per chant: title, favicon, verses file, sets (days) with labels / timings / audio location, results file, recommended set (the player opens on it and marks it), tabs |
| `../player.html` | yes | `python rnd/kavacham-audio-alignment/scripts/gen_kavacham_player.py [chant folder]` from `chant.json` + the per-day `kavacham-verse-timings*.json` |
| `../review.html` | yes | `python scripts/build_review.py [chant folder]` from `scripts/review_template.html` + `chant.json` (only the title is filled in; the page reads `chant.json` and `results.json` at run time) |
| `../results.json` | yes (analysis output) | `scripts/step3_merge.py`; `build_review.py` merges the known-slip calibration (`synth_*`) into it and adds `fconf`, the confidence of each finding (formula in `METHOD.md`) |
| `../synth_conf.json`, `../synth_fa.json` | yes | `scripts/synth_conf.py`, `scripts/synth_fa.py` (known-slip calibration) |
| `scripts/*.py` | no | the analysis pipeline, in order: `step0_decode.py` (mp3 to 16 kHz wav), `step1_prescreen.py` (signal), `step2ab_ctc.py` (CTC alignment + greedy decode, GPU), `step2c_whisper.py` (Whisper, GPU), `step3_merge.py` (merge, confidence), `synth_make.py` / `synth_gpu.py` / `synth_fa.py` / `synth_check.py` / `synth_conf.py` (calibration), `build_review.py` |
| `work/` | scratch, gitignored | wavs, pass outputs; `$DMV_REVIEW_WORK` moves it |

The pipeline needs the clips (`python tools/fetch-rnd-audio.py`), ffmpeg, torch/torchaudio, faster-whisper and a GPU, and was last run 2026-11-11 on KA's machine; this PR only moved it into the repo and made its paths relative. `build_review.py` (CPU only) was re-run and reproduces `results.json` byte for byte.

Shared code (any chant folder uses it): `../../shared/chant-nav.js` (tab bar, deep links, results access), `chant-nav.css`, `chant-player-link.js` (the player's half of the links).

## Deep-link scheme (one, in the URL hash)

```
player.html#verse=7&day=2&t=4.2&s=15-16
review.html#verse=7&day=2&t=4.2
```

`verse` 1-based; `day` a set id from `chant.json` `sets`; `t` seconds into that verse's clip (the player starts `lead_in_s` = 1 s earlier and offers a Play button, because browsers do not autoplay a fresh tab); `s` akshara index range as in `results.json` `syllables` (the player names the flagged akshara in its notice; it has no per-akshara display to highlight). All keys optional. A link naming a verse, day, time or range that does not exist shows a plain message at the top of the page. The review opens that verse and take and outlines the finding nearest `t`.

## KA's saved marks

Stored in the browser under `dmvChantReview.v1` (`chant.json` `review_storage_key`), unchanged shape: `{"<day>.<verse>.<kind>.<t_start>": {v, n, m}}`. localStorage is per address: marks made at the old preview address are not visible at a new one. Press "Copy answers as JSON" there and use "Import answers" here; import merges and never overwrites an answer already given.

## A second chant

Create `rnd/kavacham-audio-alignment/<chant>/` with `chant.json`, the verses and timings JSON, and `results.json` (same schema), then run `gen_kavacham_player.py <folder>` and `build_review.py <folder>`. A third tab (for example the lab/book under `rnd/57-chant-lab/`) is one more entry in `chant.json` `tabs`: `{"id": "lab", "label": "Lab / book", "href": "../../57-chant-lab/index.html"}`. That folder is not in this branch, so no tab is added yet.
