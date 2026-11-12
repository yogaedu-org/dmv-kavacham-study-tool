# Chant lab (dmv #57)

A small textbook with an interactive lab: how a machine can tell whether a verse was chanted like a reference, with seven chapters, three lab pages, sources and a glossary. Plain HTML, CSS and ES modules. No build, no CDN, no npm. R&D test page: the live app does not link to it and nothing here is wired into it.

## Run it

```
python rnd/57-chant-lab/tools/copy-clips.py            # copies Day 2 and Day 5 clips into the gitignored local-audio/
python rnd/57-chant-lab/tools/serve.py --port 8772     # serves the repo root; open /rnd/57-chant-lab/index.html
python -I -m pytest rnd/57-chant-lab/tests/test_chant_lab.py -q -p no:cacheprovider
```

It must be served from the repo root over http://localhost (the microphone needs a secure context): it mounts `../56-audio-sources/` and the bundled font in `/fonts/`.

## What is where

- `DESIGN.md`: palette, type, layout, the akshara ribbon.
- `chant.json`: the one file with everything chant-specific (verses, per-syllable reference timings, day sets, clips location, measured evidence). Built by `tools/build-chant-json.py` from the #55 analysis output.
- `js/ribbon.js`: the akshara ribbon, used on every page. `js/chrome.js`: bar, previous/next, Keep/Improve/Drop feedback (localStorage, exported as JSON from the footer).
- The aligner, the audio-source chain and the calibration damage function are the #56 modules in `../56-audio-sources/`, mounted unchanged (`compare.js`, `audio-source.js`, `calibration.js`, `record.js` for decoding).
- `research/`: copies of the two research reports, the method note and the two probe outputs the pages cite.
- `shots/`: Playwright screenshots at 1280 and 390 px.

## Reuse for another chant

Write a `chant.json` of the same shape for the new chant (verses with `syllables` and `syl_t` per syllable, `sets`, `reference_set`, `clips`, `evidence`), put its clips under `local-audio/<set>/verseNN.mp3`, and copy this folder. Chapter text is about the method, but chapters 1, 3 and 6 and the start page also quote this chant's measured numbers in prose (the three sentences, the tables); those must be rewritten by hand. Charts and the lab pages read their numbers from `chant.json`.
