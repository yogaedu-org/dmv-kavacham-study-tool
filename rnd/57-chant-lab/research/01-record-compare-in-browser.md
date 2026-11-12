# Record-and-compare chanting in the browser: pass 1 of 2

Date: 2026-11-12. Repo: `yogaedu-org/dmv-kavacham-study-tool` (static PWA, MIT, `index.html` + `js/` + `sw.js`, no build). Issue: none matched `gh issue list --search "record compare browser"` at 13:04 NST, so it is **issue B** here. KA steer 13:13 folded in (SOTA pronunciation scoring, browser, desktop and phone; one platform is not a blocker). Protocol gaps: one agent, no Agent tool, so no lens workers and no Opus `REVIEW.md`; pass 2 should do both.

## Answer
Two tiers, both measured on KA's own takes this session.
- **Stage 1 (no download):** AudioWorklet PCM → MFCC+delta → DTW against stored Day 2 features → Day 2 akshara boundaries projected onto the user take → per-akshara cost, duration ratio, pauses, pitch in cents.
- **Stage 2 (SOTA tier, about 70 MB once):** [ZIPA-small CR-CTC](https://huggingface.co/anyspeech/zipa-small-crctc-500k) multilingual phone recogniser (CC-BY-4.0, int8 ONNX 70.7 MB, IPA tokens incl. retroflex, aspiration, length) → CTC forced alignment to the verse's known IPA → per-akshara GOP drop vs the reference take. Native CPU RTF 0.042 on one laptop thread.

On 26 spliced slips both tiers place the top flag on the slip (DTW 26/26, ZIPA 25/26) at similar margins. ZIPA's case is speaker-independence and phone-level diagnosis; both are untested cross-speaker (**HYPOTHESIS**).

## Local evidence (measured 2026-11-12)
Inputs: `results.json` (`syllables[verse]`, `takes["2.v"].syl_t` pass-A times) and the Day 2/5 MP3s of [dmv#55](03-chant-accuracy-METHOD.md). Scripts and JSON in `.claude/tmp/dmv-research/` (`dtw_probe.py`, `zipa_probe.py`, `zipa_gop_probe.py`). Splices: verses 1-13 of **Day 5**, 2 aksharas omitted, or replaced by the 2 aksharas 6 later, random position (seed 20261112), plus the 13 untouched takes as controls; reference = Day 2.

| Test | DTW (stage 1) | ZIPA GOP (stage 2) |
|---|---|---|
| Top-scoring akshara within -1..+2 of the slip | omissions 13/13, substitutions 13/13 | omissions 12/13, substitutions 13/13 |
| ...and above the worst control | 11/13, 8/13 (control max 4.49, median 3.17) | 0/26 vs max (one control spikes 6.87 nats at akshara 0); above the 2nd-worst control (2.79): 12/13, 8/13 |
| Boundary transfer: Day 2 onsets → 63 other takes vs their pass-A onsets (2,025) | median 9 ms, p90 27 ms, 99.2 % within 100 ms | n/a |
| Compute | 0.22 s per verse pair (NumPy) | 0.55 s per 13.2 s verse, 1 thread (RTF 0.042); 0.28 s on 4 threads (onnxruntime 1.27 CPU) |

ZIPA greedy output for Day 2 verse 1 (prācyāṁ rakṣatu me tārā...): `hoːmmkratʃtʃaːmrakʃaːt̪umeːtaːrakaːmaruːpaːnivaːsiːni...` — recognisable, but ś and ṣ both came out `ʃ` and *dhū* as `d̪oː` (aspiration lost) on the 2 clips read.

Caveats: same chanter throughout; hard splices leave edges real slips lack; pass-A onsets are an algorithm, not ground truth. #55 found MMS_FA's wildcard winning 585/585 frames and Whisper large-v2 looping on 2 clips.

## 1. Recording
- `getUserMedia` needs a secure context (HTTPS or localhost; GitHub Pages is HTTPS; standard knowledge, not re-verified).
- Request `echoCancellation`, `noiseSuppression`, `autoGainControl` `false` as plain booleans (best effort; `{exact:…}` throws `OverconstrainedError`, [MDN](https://developer.mozilla.org/en-US/docs/Web/API/MediaTrackConstraints/autoGainControl), fetched 2026-11-12); store `track.getSettings()` with the take. AGC/NS damage to sustained chant pitch: **HYPOTHESIS** ([discuss-webrtc](https://groups.google.com/g/discuss-webrtc/c/PDZYMzAI-_Y) reports level drops on sustained tones).
- Safari: constraints ignored on iOS 11 ([WebKit 179411](https://bugs.webkit.org/show_bug.cgi?id=179411)); Safari 26 stereo despite `channelCount:1` ([addpipe](https://blog.addpipe.com/getusermedia-audio-constraints.md)).
- Capture through an **AudioWorklet** (lossless PCM at the real `audioContext.sampleRate`, resampled to 16 kHz). MediaRecorder is for the stored copy only: `audio/webm;codecs=opus` on Safari 18.4+, `audio/mp4` on 14.1-18.3 ([addpipe](https://blog.addpipe.com/record-high-quality-audio-in-safari-with-alac-and-pcm-support-via-mediarecorder/), secondary).

## 2. Production pronunciation scoring (server-side yardsticks)
- **GOP.** Classic Goodness of Pronunciation = log posterior of the expected phone over its aligned frames vs the best competing phone. 2025 work fits it to CTC models: self-alignment and alignment-free GOP ([Cao et al., arXiv 2507.16838](https://arxiv.org/abs/2507.16838), July 2025), and substitution-aware GOP restricted to plausible confusions ([Parikh et al., Interspeech 2025, arXiv 2506.02080](https://arxiv.org/abs/2506.02080)).
- **MDD** (mispronunciation detection and diagnosis) on L2-ARCTIC: wav2vec2 F1 0.610 ([Xu et al. 2021](https://www.isca-archive.org/interspeech_2021/xu21k_interspeech.pdf)), 69.6 % for a training-free retrieval method ([arXiv 2511.20107](https://arxiv.org/abs/2511.20107v1), Nov 2025; splits differ, not a leaderboard).
- **Duolingo.** No public description of the in-app speaking scorer was found. The Duolingo English Test scorer ([blog 2025-07-30](https://blog.englishtest.duolingo.com/new-research-in-language-learning-a-pronunciation-scoring-model-built-around-intelligibility-not-imitation); [Language Learning, doi 10.1111/lang.70000](https://onlinelibrary.wiley.com/doi/full/10.1111/lang.70000)) is a deep model over segmental and suprasegmental features, trained on thousands of human-rated responses, Spearman 0.82 with experts, beating GOP, Whisper confidence and a Microsoft tool (authors' comparison).
- **Azure Pronunciation Assessment** ([docs, updated 2026-07-03](https://learn.microsoft.com/en-us/azure/ai-services/speech-service/how-to-pronunciation-assessment)): `AccuracyScore` (phoneme, word, full text; syllable en-US only), `FluencyScore`, `CompletenessScore` (pronounced words / reference words), `ProsodyScore` (en-US only), weighted `PronScore`; `ErrorType` Omission/Insertion/Mispronunciation via `EnableMiscue`.
- **Speechace** ([API docs](https://api-docs.speechace.com/)): 0-100 quality per phone, syllable and word, stress, fluency (words correct per minute, pauses, articulation rate). **ELSA** claims 93.88 % agreement within ±1 CEFR band ([efficacy page](https://elsaspeak.com/en/efficacy), method unpublished).

What "good" means for us: per-akshara accuracy (GOP), completeness (omissions/insertions), fluency (pauses, rate), prosody (pitch contour). None of these vendors lists Sanskrit.

## 3. SOTA that runs in the browser
| Model | Size (int8 unless noted) | Licence | Indic / Sanskrit phones | Browser fit |
|---|---|---|---|---|
| [ZIPA-small CR-CTC 500k](https://huggingface.co/anyspeech/zipa-small-crctc-500k) (64M, Zipformer, ACL 2025, [arXiv 2505.23170](https://arxiv.org/abs/2505.23170)) | **70.7 MB**; fp16 131.6 MB; fp32 260.3 MB (repo updated 2026-10-06) | CC-BY-4.0 | 127 IPA tokens incl. ʈ ɖ ɳ ʂ ɕ ʰ ɦ ː ɲ ŋ and nasal tilde; trained on Hindi, Marathi, Bengali, Telugu, Tamil and others, **no Sanskrit** | input 80-dim Kaldi fbank (needs a JS port); **recommended** |
| ZIPA-large (300M) | not checked (**HYPOTHESIS** about 4.7x small) | CC-BY-4.0 | same | desktop only |
| [wav2vec2-lv-60-espeak-cv-ft](https://huggingface.co/onnx-community/wav2vec2-lv-60-espeak-cv-ft-ONNX) | 317.7 MB; q4 241.7 MB; fp16 632.3 MB | Apache-2.0 | eSpeak IPA, multilingual | transformers.js-ready; desktop only on size |
| [speako](https://huggingface.co/robg/speako-phoneme-recognizer) (xls-r-300m TIMIT) | 355.2 MB | Apache-2.0 | English phones only | reject |
| [vakyansh Sanskrit](https://huggingface.co/Harveenchadha/vakyansh-wav2vec2-sanskrit-sam-60) | 377.8 MB fp32; about 95 MB int8 by analogy (**HYPOTHESIS**) | **none stated** | Devanagari letters, 67 tokens | blocked on licence |
| MMS_FA / Whisper tiny | 631.5 MB fp16 NC / 40.8 MB | NC / MIT | romanised / transcribes, loops | reject |

PFER (phone feature error rate, lower better) on seen languages, from the ZIPA paper: Allosaurus 22.33, wav2vec2-phoneme xlsr-53 11.88, ZIPA-large 2.70. ZIPA-small's own figure was not read (**gap**). [POWSM](https://arxiv.org/abs/2510.24992) (Oct 2025) claims parity with ZIPA plus G2P; its size was not checked.

**Sanskrit coverage and GOP.** No phone model was trained on Sanskrit. ZIPA's Hindi/Marathi phones are the practical proxy. GOP against a **known** akshara sequence avoids Sanskrit ASR: the verse's IAST maps to IPA by a fixed table (the probe used about 40 rules), forced alignment only needs frame posteriors, and scoring the **drop vs KA's reference take** cancels sounds the model always hears differently (controls: median drop 1.34 nats). Weak contrasts (ś/ṣ, aspiration) remain a model limit (observed on 2 clips; general claim **HYPOTHESIS**).

**Runtime and platforms.**
- [onnxruntime-web 1.31.1](https://www.npmjs.com/package/onnxruntime-web) (MIT, npm 2026-11-11) runs WASM (SIMD, threads need cross-origin isolation, unavailable on GitHub Pages without a service-worker header shim: **HYPOTHESIS**) or WebGPU.
- WebGPU ([web.dev, 2025-11-25](https://web.dev/blog/webgpu-supported-major-browsers)): Chrome/Edge 113+ desktop; Chrome 121+ on Android 12+ with Qualcomm/ARM GPUs; Firefox 141+ Windows, 145+ Apple-silicon macOS, not Android/Linux; Safari 26 on iOS, iPadOS, macOS.
- Browser RTF for ZIPA was **not measured**. **HYPOTHESIS**: WASM 2-3x slower than native ORT, so 1-2 s per 12 s take on a laptop and a few seconds on a phone. Int8 kernels on WebGPU are less mature, so the plan is WASM int8 first and fp16 on WebGPU second (**HYPOTHESIS**).
- iOS memory: "Only ~300 MB of RAM is reliably available to WebAssembly pages" ([WebKit 269777](https://bugs.webkit.org/show_bug.cgi?id=269777), closed as duplicate 2024-02-22). The tab is killed rather than an allocation failing. ZIPA-small int8 fits; the 240-630 MB models do not, so they are desktop-only.

## 4. Candidate pipeline (stage 2)
1. PCM 16 kHz → 80-dim Kaldi fbank in JS. Test: max abs difference vs `torchaudio.compliance.kaldi.fbank` on 3 clips.
2. ZIPA-small int8 in onnxruntime-web (WASM; WebGPU where present) → log-probs (T×127, 50 frames/s).
3. Verse IAST → IPA tokens with akshara ownership.
4. CTC Viterbi forced alignment in JS: about 80 IPA tokens × 650 frames per verse, a plain DP.
5. Per akshara:
   - GOP = mean(log p(expected) − max log p);
   - drop = GOP(reference) − GOP(user), with reference posteriors precomputed and shipped (about 650×127 fp16 ≈ 165 KB per verse; calculated);
   - duration;
   - pitch from stage 1.
6. Greedy decode of a flagged span shows what was heard (e.g. `t` for `tʰ`).

Fallback tiers: no WebGPU, low memory or a declined download → stage 1 (DTW + pitch) only. Desktop-only: ZIPA-large or wav2vec2-espeak for a second opinion.

## 5. Pitch and timing
- **Pitch.** [pitchy 4.1.0](https://github.com/ianprime0509/pitchy) (McLeod MPM, MIT, ES module, npm 2024-01-04) for stage 1. [SwiftF0](https://github.com/lars76/swift-f0) (MIT, v0.3.0 2026-09-25, `model.onnx` 135,090 B, 46.9-2,093.8 Hz, 16 ms hop, about 180x real time per author) if pitchy jitters on low chant (**HYPOTHESIS**). pitchfinder is GPL-3.0 and essentia.js AGPL-3.0, both unfit for this MIT repo.
- **Pitch display.** Cents relative to each take's median F0 (tonic-invariant), warped by the DTW path, ±600-cent octave fold.
- **Timing.** Pauses use the #55 energy rule: 28 dB below p95, 0.30 s or longer, inside a pada vs at its boundary. Per-akshara duration ratio from the path; under 0.35x scored as an omission in the probe; flags at 0.4x or less and 2.0x or more as in #55. A run of low ratios across a pada means rushing.

## 6. What others built
- [Tarteel](https://tarteel.ai/blog/introducing-mistake-detection/) (2022-01-04): word-level missed/wrong/extra only, closed.
- [Quran-muaalem](https://arxiv.org/abs/2509.00094) (2025-08-27): open multi-level CTC, 848 h, Tajweed F1 75.8 %. This is the closest analogue: a recitation-specific phone model.
- [OpenPronounce](https://github.com/Halleck45/OpenPronounce): wav2vec2 + DTW, English.
- No open-source browser Vedic-chant comparer was found.

## 7. Privacy and storage
Takes stay in IndexedDB as Blobs plus result JSON and `getSettings()`. A 12 s take is about 48 KB as Opus 32 kbps, 384 KB as int16 16 kHz (calculated). The model is cached by `sw.js` (about 71 MB) only on opt-in.

Safari deletes script-writable storage after 7 days without interaction ([web.dev](https://web.dev/articles/storage-for-the-web)). The Home Screen exemption and `persist()` are unreliable on iOS ([Apple forum](https://developer.apple.com/forums/thread/710157)). **Export** (audio + JSON) is required.

## Staged plan
**Stage 1: no download** (DTW + pitch + timing; about 3 ES modules).
- **Promote** if the live calibration locates at least 80 % of deliberate slips within ±1 akshara with at most 1 false flag per clean verse.
- **Demote** to a timing/pitch-only view if the cross-speaker locate rate is under 50 %.

**Stage 2: ZIPA GOP tier** (opt-in 71 MB).
- **Promote** if, cross-speaker, it beats stage 1 by 15 points or more on substitutions, or names the wrong phone correctly in at least 60 % of hits.
- It must also run under 10 s per take on KA's phone and its JS fbank must match Python.
- **Kill** if it is no better than DTW cross-speaker or crashes iOS Safari.
- Edge rule learned in the probe: ignore akshara 0 and the last akshara unless the clip starts or ends mid-sound (the 6.87-nat control spike).

**Calibration.**
1. Splices (done): DTW 26/26 and ZIPA 25/26 located.
2. Live test: 3 chanters (at least 1 not KA, 1 of the other sex) × 5 verses, each recorded clean and from a card with one pre-declared slip each:
   - omission;
   - `tha`→`ta`;
   - ś→s;
   - insertion;
   - 1 s pause;
   - half-length rushed pada.

   Report N of M located per type and false flags per clean verse; thresholds fixed on 2 chanters, tested on the third.

## Top risk
Cross-speaker scoring is untested for both tiers. MFCC-DTW carries voice timbre. ZIPA should be more speaker-robust but merges ś/ṣ and drops aspiration on KA's voice. Both are **HYPOTHESIS** until the live test.

## Fetch log (NST, 2026-11-12)
- Web: 13:05:38-13:09:00 and 13:13:52-13:15:22.
- npm metadata: 55 s.
- ZIPA int8 download: 7 s (13:15:54-13:16:01).
- DTW probe: 18.3 s.
- ZIPA GOP probe: 31.2 s.
