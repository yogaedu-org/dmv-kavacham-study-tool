# Method: DMV Kavacham chant accuracy, 14 verses x 6 days (2026-11-11)

Question (KA): which verses were chanted with the fewest mistakes, where the slips are, which single day to use, and which alternate day to use for a verse that is messed up.

Inputs, all read-only: the 84 verse clips (`day1`, `day2`, `day4`, `day5`, `day6` folders plus `audio/verses/` for day 3) and `kavacham-verses.json` (14 verses) from this chant folder (the clips are release assets restored with `tools/fetch-rnd-audio.py`, not git files; they were only read). The existing per-day timings JSON supplied pada boundaries and the old align scores.

## Reference text to syllables
Each verse's Devanagari (NFC) is cut into aksharas (cluster + vowel; a word-final virama consonant joins the previous akshara; anusvara and visarga stay on their akshara). Each akshara has an IAST display form, an alignment spelling (a-z only: ś and ṣ become `sh`, anusvara `m`, visarga `h`, long vowels single) and a comparison spelling (aspirates, `sh`/`s`, `ch`/`c`, `w`/`v` collapsed; anusvara and visarga are wildcards that match m/n or h or nothing). Verse 14's closing line is allowed to repeat twice more at zero omission cost, because the repeat count varies by day (this is not a slip).

## Passes
- **signal (no GPU).** Per clip: duration against the verse median over the six days, 20 ms frame energy (silence below 28 dB under the 95th-percentile level, runs of 0.30 s or more, inside versus at the pada boundary), loud first or last 40 ms (cut mid-sound, threshold above -10 dB), broadband noise bursts, clipping, and an MFCC self-similarity score for restarts. Result: no noise bursts or clipping anywhere; no restart flagged by the MFCC measure (it was weak, since line 1 and line 2 are naturally similar); the usable outputs are duration, pauses and cut edges.
- **A: CTC forced alignment** (torchaudio `MMS_FA`, `F.forced_align` over the whole verse target, 20 ms frames). Per akshara: start, end, mean posterior. Flag when the posterior is more than 0.25 (or 3 MAD) below the same akshara on the other days after removing the clip's own median, and is under 0.30; or when the onset-to-onset interval is 2.0x or more (and 0.40 s longer) or 0.40x or less (and 0.25 s shorter) than the other days' median. Verse 14 line 1 is skipped for A (a variable repeat count makes single-pass alignment ambiguous). An akshara flagged by A on 3 or more days (v3 akshara 15 and 16) is treated as unstable alignment and dropped.
- **B: reference-free greedy CTC** from the same forward pass. MMS_FA's wildcard class `*` wins the argmax on every frame (measured: 585 of 585 on day 3 verse 3), so the decode drops `*`, renormalises over blank plus the 27 symbols and takes the argmax. The letter string is collapsed (doubled vowels to one, `sh`/aspirate collapse) and aligned to the reference by a weighted edit distance (vowel for vowel 0.5, b/v 0.3, nasal for nasal 0.4, voicing pairs 0.7, doubled consonant insertion 0.2, anusvara/visarga free). An akshara whose cost reaches 1.0 is a candidate; adjacent candidates merge.
- **C: faster-whisper large-v2** (Systran, float16, beam 5, temperature 0, no prompt, `language="hi"` so the output is Devanagari; `sa` looped on day 5 verse 9 in a probe). Its text is romanised with the same syllabifier and compared exactly like B. Day 6 verse 9 looped (text 8x too long): pass C is void for that clip.

## Merging
Candidates from A, B and C are clustered by reference akshara (adjacent within one; inserted material within three). `passes_agreeing` is the number of A/B/C present. Tiers: one listener = **listen and judge**; two or three = **probable slip**. A long energy-gated pause is a signal finding: probable only with timing agreement or 1.0 s or more. Kinds: substitution, omission, insertion, repeat/restart (the inserted letters mostly repeat the neighbouring reference), long pause, timing (A only), older-text variant (verse 10 insertions resembling `ugratara`: none found), audio defect.

**Model-habit rule.** If the same pass flags the same reference akshara on 4 or more of the 6 days (the task said "all six"; 4 is stricter against false alarms), the finding is called a likely model error and excluded from scores. It is still listed under each verse as "ignored", because a difference that is identical on most days is either the tool's habit or KA's regular way of saying the syllable, and only KA can tell which. 23 pass-level cases.

**Audio defects** are not chanting and are not scored: day 1 verses 1 and 2 (3.1 s and 4.4 s against about 12-13 s: the cut is wrong); an omission at the very start or end that coincides with a clip starting or ending mid-sound (day 1 verse 3); and 13 clips that end mid-sound (shown with a scissors mark, used only as a last tie-break).

## Score and recommendation
Per take: a probable slip counts weight x min(syllables, 3), weight 2 substitution/insertion, 3 omission, 4 restart, 1 pause/timing; a listen-and-judge finding counts a quarter of that. Clean = no probable slip and no whole-clip defect. Best day = most clean verses, ties by lower total score. Swaps = verses not clean on the best day, from the nearest clean day (adjacent first, for the voice). Alternates for every verse are listed in preference order in `results.json`.

## Calibration
Five slips were spliced into day 2 clips with known positions (2 omissions, 2 substitutions, 1 repeat of four syllables) and run through B and C. Both listeners flagged 4 of 5 at the right place; the repeat was seen by both but placed several syllables away. Five cases is a smoke test, not a measured recall rate. No false-alarm rate was measured against human-labelled clean takes; none exist. The day 1 clips (pre-registered defects) and the day 4 verse 6 restart (a 14.8 s clip against about 12 s on the other days; "bhrye gu bhruyuge" in both the CTC letters and Whisper) behaved as expected.

## What is hypothesis
Every finding is a hypothesis until KA listens. The two model families share a limitation (trained on speech, not chanting) and the reference text is assumed to be what KA intended to chant. "Clean" means nothing was found by two independent listeners, not that the chanting is flawless; a slip that all listeners miss, or that sits inside a model-habit syllable, is invisible. Day 4's lower scores in the old timings JSON may be recording quality as much as chanting; the pipeline only reports a day 4 slip where two listeners agree on an akshara.

## Versions
torch 2.11.0+cu128, torchaudio 2.11.0+cu128 (conda env `langseg`), faster-whisper 1.2.1 with CTranslate2, model `Systran/faster-whisper-large-v2` from a local Hugging Face cache, ffmpeg n8.1.2 (16 kHz mono), Python 3.12, RTX GPU idle with 16 GB free, one process at a time (gpu-guard: no foreign GPU process, free-VRAM check, ping, per-clip deadline, lock file).
Code adapted from SYP-ajna-analysis `scripts/forced_align_chant.py` at commit `37a23875e4a0d4a694530438bb7de1d4745a6aa2` and shruti-transcript `bench/align.py` at commit `596c47937ad5dca2cce2d3db108f7a99ca1b6ea8` (read only; nothing imported from those clones). Scripts are in `scripts/`.

## Files
`review.html` (now generated by `scripts/build_review.py`; open it next to `player.html`), `results.json`, `review/work/out/` (prescreen.json, passAB.json, passC.json, synthetic_calibration.json: analysis scratch, gitignored), `scripts/`. See `review/README.md` for which file is generated from what.

## Confidence that a line was chanted as written (added 2026-11-11, KA's request)
An **estimate, not a measured probability**, 0 to 100, per line (pada), per take. A pada is one half of the verse (the text up to the danda, then the rest).

Components, each 0 to 1:
- **P, timing fit.** Mean pass-A alignment posterior of the pada's syllables, minus that day's own median pada posterior (so a noisy day such as day 4 is not punished for being noisy), minus the median of the same pada over the other days. `P = clamp(0.75 + that difference / 0.40, 0, 1)`: same as the other days = 0.75, 0.10 better = 1, 0.30 worse = 0. Not computed for verse 14's closing line (a variable number of repeats makes single-pass alignment ambiguous); its weight moves to the other two components.
- **D, decode agreement.** `1 - (sum of min(1, edit cost) of the pada's syllables) / (number of syllables)`, computed separately against the CTC letters (B) and Whisper (C), then averaged. Syllables set aside as "same on most days" cost nothing unless KA marks them "how I say it".
- **N, clean passes.** The share of the passes that ran (A, B, C; only B and C for verse 14 line 2) that found nothing in the pada.

`confidence = clamp(100 * (0.35 P + 0.35 D + 0.30 N) - penalty, 0, 95)`, with `penalty = min(60, 25 * probable slips + 8 * listen-and-judge findings)` in the pada. The 95 cap is deliberate: the listeners are imperfect. Verse = mean of its two padas (the weakest pada is shown too). Day = mean of the verse numbers over verses that have one, plus the count of verses whose weakest pada is at least 70. Bands: 85+ high, 70-84, 50-69, under 50.

**n/a, never a made-up number**: the clip is cut wrongly (day 1 verses 1 and 2); the Whisper pass looped (day 6 verse 9); or the pada overlaps syllables missing because the clip starts or ends mid-sound (day 1 verse 3 line 1).

**Weights are my choice, not fitted.** No human-labelled correct/incorrect takes exist, so the weights (0.35/0.35/0.30, penalties 25 and 8, the 0.75 midpoint) were set so a clean line lands at about 90, a line with one probable slip at about 30-55 and one with a single listen-and-judge item at about 70-80. They would change if KA's Right/Wrong answers were used to fit them.

**Calibration.** Five slips spliced into day 2 lines, scored with the same formula (pass A assumed clean for the spliced clips, which makes the check generous): omission v7 line 1: 91 to 32; repeat v9 line 1: 91 to 91 (not caught); substitution v11 line 1: 90 to 64; omission v3 line 2: 91 to 34; substitution v5 line 2: 91 to 35. So 4 of 5 known slips pulled the line well below 70; a repeated stretch can still score high. Five clips is a smoke test.

**"Same on most days" syllables (decide by ear).** Each such syllable (flagged by the same pass on 4 or more days) shows the expected text, what the CTC letters and Whisper heard on each day, and a 1.5 s play button per day around the syllable. KA chooses "That's the tool" (stays excluded) or "That's how I say it" (the syllable then counts like a listen-and-judge finding, plus its decode disagreement, in every day's pada that contains it, and every confidence number on the page is recomputed live in the browser). The answers are stored with the other verdicts and are in Copy JSON as `ign.<verse>.<syllable index>`.

Where the numbers live: `results.json` (`takes[day.verse].padas[]` has the components, `conf`, and `na`; `day_conf`; `conf_params`; `synth_conf`). The browser recomputes them with the same formula; a test compared all 168 pada values and the 14 day values between the page and the Python output (no differences above rounding).

Recommended day after the confidence numbers: unchanged, Day 2 (mean confidence 89.6, 14 of 14 verses with every line at 70 or more; next Day 5 and Day 6 at 85.5, Day 1 86.1 over 11 scored verses, Day 3 85.3, Day 4 80.2).

Outputs of this update are `results.json`, `synth_conf.json`, `synth_fa.json` and `review.html` in the chant folder (#55 moved them into the repo, beside the player).
