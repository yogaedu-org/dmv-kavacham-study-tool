# #56 / #57 side test page: swappable audio sources + record and compare

> TL;DR: a plain test harness (not linked from the app, not deployed) for two ideas before they touch the live page: (1) one player that plays each verse from a swappable source (cloud, offline folder, or your own files), (2) record your chanting and see where it differs from the Day 2 reference. Refs #56, #57.

Reports behind it (copied from the research agents, dated 2026-11-12): [research/02-swappable-audio-sources.md](research/02-swappable-audio-sources.md), [research/01-record-compare-in-browser.md](research/01-record-compare-in-browser.md).

## Run it
Audio is never in git (#48). Populate the two gitignored folders from the local Day 2 clips, then start two servers (two ports = two origins, so "cloud" is a real cross-origin fetch):

```
python rnd/56-audio-sources/tools/populate-local-audio.py
python rnd/56-audio-sources/tools/serve.py --root rnd/56-audio-sources --port 8770
python rnd/56-audio-sources/tools/serve.py --root rnd/56-audio-sources/local-audio/cloud --port 8771 --cors
```
Open `http://127.0.0.1:8770/index.html`. `serve.py` supports HTTP Range, `--cors`, and `--map URLPATH=FILE`. Tests: `node --test rnd/56-audio-sources/tests/audio-source.test.mjs` and `python -I -m pytest rnd/56-audio-sources/tests -q` (Playwright for Python; the first file uses synthetic tones, the second needs the populated clips and ffmpeg and skips otherwise).

## Part 1: swappable audio (`audio-source.js`)
_In the app PR (#56 wiring) this module lives at `js/audio-source.js` and the page imports it from `../../js/`: one copy, used by the live app and by this page._

The player calls one function: `resolve(verseId, {mode, kinds}) -> {url, source, label, duration, setLabel, sha256, tried} | {missing: true, tried: [{kind, label, url, reason}]}`. It walks the chain **custom > offline > cloud** (or one kind when `mode` is set) and returns the first URL the browser can load. A missing file never fails silently: `tried` names every source and why it was skipped (`HTTP 404`, `no custom file for verse 8`, `verse 14 is not in the config`).

`createAudioSource(config, {probe, baseHref})` returns `{resolve, candidates, setConfig, getConfig, setCustomFiles, clearCustom, customIds}`. `setConfig(next)` is the swap.

Manifest / config (`audio-config.json` is the example):
```
{ "version": 1,
  "set": { "id": "day2", "label": "Day 2, recommended by the #55 analysis" },
  "sources": [ { "kind": "custom" },
               { "kind": "offline", "base": "local-audio/offline/", "label": "offline folder" },
               { "kind": "cloud",   "base": "https://host/dir/",   "label": "cloud", "crossOrigin": null } ],
  "order": ["custom", "offline", "cloud"],
  "verses": [ { "id": 1, "file": "verse01.mp3" | { "cloud": "day2__verse01.mp3", "offline": "verse01.mp3" },
                "sha256": "...", "bytes": 0, "duration": 13.24, "set": "Day 2" } ] }
```
- `cloud`: any http(s) base URL **with CORS**. Delivery is `blob` by default: `resolve()` fetches the whole clip (about 200 KB), checks its `sha256` against the manifest when one is given (a mismatch is an error naming the file and the clip is never played; `verified: true|false|null` is returned, `false` = this context has no SubtleCrypto), and returns a `blob:` URL for the shared `<audio>`. Reason: the Cloudflare Pages host ignores `Range` (200 + full body, no `Accept-Ranges`, measured by the deploy agent), and Safari refuses `<audio src>` from such a server; a blob also seeks and is the hook for a later offline cache. Clips are cached per set and the object URLs are revoked on `setConfig` (a set switch). `delivery: "stream"` on a source gives the plain URL.
- `offline`: a same-origin relative folder. It is also where a later service-worker or Cache Storage copy would be served.
- `custom`: the user's files from `<input type=file multiple>` or drag and drop, matched to verses by a number in the file name (`verse-07.mp3`, `07.wav`, `Take2_verse14.m4a`: a `verse` marker wins, else the last digit run; out-of-range or number-less names are listed as not used). Held as object URLs for the session only.
- Swapping audio = swapping the config (`?config=other.json`) or a `base`. No player code changes.

`resolve()` also returns `sourceUrl` (the network URL behind a `blob:` URL), `delivery` and `verified`. Not verified: Safari playback (no iOS device here; the blob path is the mitigation, unproven on a device).

## Part 2: record and compare (#57, stage 1 of report 01)
Importable modules, no page assumptions (the textbook lab can mount them):
- `recorder.js`: `startRecording({constraints, onSettings}) -> {settings, stop()}`; `stop() -> {pcm, sampleRate, blob, mimeType, settings, seconds}`. `decodeToPcm(arrayBuffer) -> Float32Array` (mono 16 kHz). Asks for echoCancellation, noiseSuppression and autoGainControl **off** and returns what the browser reports it applied.
- `compare.js`: `compare(take, reference, verse) -> {aksharas:[{i, deva, iast, line, timingRatio, pitchCents|null, cost, matchZ, levelDb, flags, flagged, confidence, confidenceParts}], lines:[{line, score, confidence, flagged}], verse:{score, confidence, flagged, of}, overall:{score, confidence, note}, tempo, keyOffsetCents, durRatio, details}`. `take` and `reference` are `{pcm}` or bare `Float32Array`s (16 kHz mono); `verse` is one entry of `page-data.json` (`syllables`, `syl_t`, `analysis_span`). A confidence (0-100) is present at every level. Lower-level: `features`, `f0Track`, `dtwAlign`, `compareTake`.
- `calibration.js`: `runCalibration({pageData, loadRef, loadOther?, onProgress?, verses?}) -> {silence, replace, controls, others, trials, text}`.

Method: 12 MFCCs per 10 ms frame (mean/variance normalised per clip), DTW of the reference excerpt against the take (open at both ends of the take), the #55 per-akshara spans projected through the path, then per akshara: timing ratio relative to the whole-take tempo, spectral mismatch (robust z), level change, pitch deviation in cents relative to the whole-take key offset. No model download. Verse 14 compares line 1 only (its closing line repeats a variable number of times).

### Calibration (run in the page, button "Run the calibration check"; also asserted by `test_record_compare.py`)
Each of the 14 Day 2 clips, two positions per verse, one akshara-length region silenced or replaced by another akshara of the same clip, fed back as the "take":
- silenced: right akshara flagged **28 of 28**, and it was the single worst akshara 28 of 28, 0 other aksharas flagged;
- replaced: **28 of 28** and 28 of 28, 0 other flagged;
- unmodified clip against itself: 0 flagged over 14 verses;
- Day 5 take of the same verse against Day 2 (no ground truth, a false-alarm hint): 13 of 434 aksharas flagged (3 percent), page with the mock cloud;
- a take recorded through a fake microphone from the Day 2 verse 1 clip (Opus round trip): 99/100, confidence 93, 0 of 33 flagged.

**This is an easy case.** Same voice, mic and room, hard edits, thresholds chosen by me on this same material. It is not a recall rate on real mistakes. Report 01 sets the promote bar for stage 1 (at least 80 percent located, at most 1 false flag per clean verse) and requires a cross-speaker test (3 chanters, one not KA, one of the other sex) that has NOT been run: cross-speaker behaviour of MFCC-DTW is a hypothesis.

### What this can and cannot tell you (also in the page)
Everything about thresholds is a hypothesis: none was fitted to human right/wrong judgements. A flag means "differs from the Day 2 clip", not "chanted wrongly". Confidence = how much evidence the number rests on (akshara length, voiced frames, match quality), not a probability. Pitch is relative to the take's own key; an octave change is not told apart from a key change.

## What is NOT done
- Persistence of custom audio: no OPFS, IndexedDB or folder picker (session object URLs only). Next step: copy the chosen files into IndexedDB (report 02).
- Offline download button / Cache Storage / service-worker range slicing: not here (live app untouched).
- Stage 2 of report 01 (ZIPA phone model + GOP, about 70 MB download): not tried. Next step: only after stage 1 passes the cross-speaker test.
- Cross-speaker calibration with real mistakes (above); Safari/iOS recording behaviour (report 01 lists known constraint problems); recording is chromium-tested only.
- Release assets as a cloud source: report 02 measured no CORS headers and a draft release answers 404, so no config points at them.

## Open questions for KA (each with my recommendation, from report 02)
1. **Where should cloud audio live?** KA prefers Cloudflare. Report 02 ranks same-origin hosting on the Pages site first (clips are about 3 MB per set, free, CORS-free), a separate Pages media repo second, R2 third (needs a custom domain for production). Recommendation: a Cloudflare Pages project for the clips; the app only needs the one `audio.cloudBase` value (see the app PR for the data layout).
2. **How should custom audio persist?** Recommendation: copy the bytes into IndexedDB, keep no file handles (one code path on every browser; Safari may evict after 7 days unless installed), plus an export button for takes.
3. **Manifest fields `reciter` and `licence`**: not known to this repo; who is the reciter and under what licence may the clips be published?

## Hosting record
[audio-hosting/DEPLOYMENT.md](audio-hosting/DEPLOYMENT.md) is the deploy agent's log for the Cloudflare Pages project `dmv-kavacham-audio` (public, Day 2 only, no Range support).
